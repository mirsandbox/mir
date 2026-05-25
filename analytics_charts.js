/**
 * analytics_charts.js
 * Version: 1.0.0
 *
 * Lightweight canvas-based charting for MIR Platform.
 * Zero external dependencies. Pure Canvas 2D API.
 *
 * Exports:
 *   renderRadarChart(canvasId, labels, datasets, opts)
 *   renderSparkline(canvasId, values, opts)
 *   renderAffinityHeatmap(canvasId, agents, matrixData, opts)
 *   renderWeightHistory(canvasId, history, opts)
 *   initAgentCharts(db)   — main entry: renders all agent 6D charts
 *   destroyChart(canvasId)
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// COLOUR PALETTE (mirrors CSS variables)
// ═══════════════════════════════════════════════════════════════════════════
const COLOURS = {
  green:   '#00ff88',
  cyan:    '#00d4ff',
  amber:   '#ffab00',
  crimson: '#ff2244',
  violet:  '#a855f7',
  dim:     '#2a3f55',
  border:  '#1a2535',
  bg:      '#070f1a',
  text:    '#8ba3cc',
};

const AGENT_COLOURS = {
  resident: COLOURS.green,
  macro:    COLOURS.amber,
  cyber:    COLOURS.crimson,
  geo:      COLOURS.violet,
};

const DIM_LABELS = ['Geo', 'Econ', 'Cyber', 'Hist', 'Cred', 'Urgency'];

// ═══════════════════════════════════════════════════════════════════════════
// CHART REGISTRY — track active canvases for cleanup
// ═══════════════════════════════════════════════════════════════════════════
const _registry = new Map();  // canvasId → { animFrameId, cleanup }

export function destroyChart(canvasId) {
  const entry = _registry.get(canvasId);
  if (!entry) return;
  if (entry.animFrameId) cancelAnimationFrame(entry.animFrameId);
  if (entry.cleanup) entry.cleanup();
  _registry.delete(canvasId);
  const canvas = document.getElementById(canvasId);
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════
function _dpr() { return Math.min(window.devicePixelRatio || 1, 2); }

function _setupCanvas(canvas, w, h) {
  const dpr = _dpr();
  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return ctx;
}

function _hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function _ensureCanvas(containerId, canvasId, w, h) {
  let canvas = document.getElementById(canvasId);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = canvasId;
    const container = document.getElementById(containerId);
    if (container) container.appendChild(canvas);
  }
  return canvas;
}

// ═══════════════════════════════════════════════════════════════════════════
// RADAR CHART — 6D semantic weight polygon
// ═══════════════════════════════════════════════════════════════════════════

export function renderRadarChart(canvasId, labels, datasets, opts = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const W = opts.size || 180;
  const H = opts.size || 180;
  const ctx = _setupCanvas(canvas, W, H);

  const cx     = W / 2;
  const cy     = H / 2;
  const radius = (Math.min(W, H) / 2) * 0.72;
  const sides  = labels.length;
  const step   = (Math.PI * 2) / sides;
  const offset = -Math.PI / 2;  // start at top

  function angleFor(i) { return offset + step * i; }
  function pointAt(r, i) {
    return {
      x: cx + r * Math.cos(angleFor(i)),
      y: cy + r * Math.sin(angleFor(i)),
    };
  }

  // Background
  ctx.fillStyle = opts.bg || COLOURS.bg;
  ctx.fillRect(0, 0, W, H);

  // Grid rings (5 levels)
  for (let ring = 1; ring <= 5; ring++) {
    const r = radius * (ring / 5);
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const p = pointAt(r, i);
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.strokeStyle = ring === 5 ? COLOURS.border : _hexToRgba(COLOURS.border, 0.4);
    ctx.lineWidth   = 0.5;
    ctx.stroke();
  }

  // Axis spokes
  for (let i = 0; i < sides; i++) {
    const outer = pointAt(radius, i);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(outer.x, outer.y);
    ctx.strokeStyle = _hexToRgba(COLOURS.dim, 0.5);
    ctx.lineWidth   = 0.5;
    ctx.stroke();
  }

  // Axis labels
  ctx.font      = `${opts.fontSize || 9}px "Share Tech Mono", monospace`;
  ctx.textAlign = 'center';
  for (let i = 0; i < sides; i++) {
    const lp = pointAt(radius * 1.18, i);
    ctx.fillStyle = COLOURS.text;
    ctx.fillText(labels[i], lp.x, lp.y + 4);
  }

  // Data polygons
  datasets.forEach(ds => {
    const colour = ds.colour || COLOURS.cyan;
    const values = ds.values;   // array of 0..1
    if (!values || values.length !== sides) return;

    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const r = radius * Math.max(0, Math.min(1, values[i]));
      const p = pointAt(r, i);
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fillStyle   = _hexToRgba(colour, 0.12);
    ctx.fill();
    ctx.strokeStyle = colour;
    ctx.lineWidth   = 1.5;
    ctx.shadowColor = colour;
    ctx.shadowBlur  = 4;
    ctx.stroke();
    ctx.shadowBlur  = 0;

    // Data point dots
    values.forEach((v, i) => {
      const r = radius * Math.max(0, Math.min(1, v));
      const p = pointAt(r, i);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = colour;
      ctx.fill();
    });
  });

  // Centre dot
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fillStyle = _hexToRgba(COLOURS.dim, 0.6);
  ctx.fill();
}

// ═══════════════════════════════════════════════════════════════════════════
// SPARKLINE — weight history over time (mini line chart)
// ═══════════════════════════════════════════════════════════════════════════

export function renderSparkline(canvasId, values, opts = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (!values || values.length < 2) return;

  const W = opts.width  || 120;
  const H = opts.height || 32;
  const ctx = _setupCanvas(canvas, W, H);
  const colour = opts.colour || COLOURS.cyan;
  const pad = 2;

  ctx.clearRect(0, 0, W, H);

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 0.001;
  const norm = v => 1 - (v - min) / range;

  const xs = values.map((_, i) => pad + (i / (values.length - 1)) * (W - pad * 2));
  const ys = values.map(v => pad + norm(v) * (H - pad * 2));

  // Fill area
  ctx.beginPath();
  ctx.moveTo(xs[0], H);
  xs.forEach((x, i) => ctx.lineTo(x, ys[i]));
  ctx.lineTo(xs[xs.length-1], H);
  ctx.closePath();
  ctx.fillStyle = _hexToRgba(colour, 0.08);
  ctx.fill();

  // Line
  ctx.beginPath();
  xs.forEach((x, i) => i === 0 ? ctx.moveTo(x, ys[i]) : ctx.lineTo(x, ys[i]));
  ctx.strokeStyle = colour;
  ctx.lineWidth   = 1.2;
  ctx.lineJoin    = 'round';
  ctx.shadowColor = colour;
  ctx.shadowBlur  = 3;
  ctx.stroke();
  ctx.shadowBlur  = 0;

  // Last value dot
  ctx.beginPath();
  ctx.arc(xs[xs.length-1], ys[ys.length-1], 2, 0, Math.PI*2);
  ctx.fillStyle = colour;
  ctx.fill();
}

// ═══════════════════════════════════════════════════════════════════════════
// AFFINITY HEATMAP — inter-agent relationship matrix
// ═══════════════════════════════════════════════════════════════════════════

export function renderAffinityHeatmap(canvasId, agents, matrixData, opts = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const n    = agents.length;
  const cell = opts.cellSize || 48;
  const pad  = opts.pad || 36;
  const W    = pad + n * cell;
  const H    = pad + n * cell;
  const ctx  = _setupCanvas(canvas, W, H);

  ctx.fillStyle = COLOURS.bg;
  ctx.fillRect(0, 0, W, H);

  // Row/col labels
  ctx.font = `9px "Share Tech Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  agents.forEach((ag, i) => {
    ctx.fillStyle = AGENT_COLOURS[ag.id] || COLOURS.text;
    ctx.fillText(ag.id.slice(0,3).toUpperCase(), pad/2, pad + i * cell + cell/2);
    ctx.fillText(ag.id.slice(0,3).toUpperCase(), pad + i * cell + cell/2, pad/2);
  });

  // Cells
  agents.forEach((rowAg, r) => {
    agents.forEach((colAg, c) => {
      const val  = r === c ? 100 : (matrixData[rowAg.id]?.[colAg.id] ?? 50);
      const norm = val / 100;
      const x    = pad + c * cell;
      const y    = pad + r * cell;

      // Background heat colour
      const base = r === c ? COLOURS.violet : val > 65 ? COLOURS.green : val < 35 ? COLOURS.crimson : COLOURS.amber;
      ctx.fillStyle = _hexToRgba(base, r === c ? 0.2 : norm * 0.5);
      ctx.fillRect(x, y, cell-1, cell-1);

      // Border
      ctx.strokeStyle = _hexToRgba(base, 0.3);
      ctx.lineWidth   = 0.5;
      ctx.strokeRect(x, y, cell-1, cell-1);

      // Value text
      ctx.fillStyle = r === c ? COLOURS.violet : base;
      ctx.font = `bold 10px "Share Tech Mono", monospace`;
      ctx.fillText(r === c ? '●' : String(Math.round(val)), x + cell/2, y + cell/2);
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// WEIGHT HISTORY BAR CHART — all 6 dims for one agent
// ═══════════════════════════════════════════════════════════════════════════

export function renderWeightBars(canvasId, weights, agentColour, opts = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const W       = opts.width  || 200;
  const H       = opts.height || 80;
  const ctx     = _setupCanvas(canvas, W, H);
  const colour  = agentColour || COLOURS.cyan;
  const n       = weights.length;
  const barW    = (W - 8) / n;
  const maxH    = H - 20;

  ctx.clearRect(0, 0, W, H);

  weights.forEach((v, i) => {
    const barH = maxH * Math.max(0, Math.min(1, v));
    const x    = 4 + i * barW;
    const y    = H - 16 - barH;

    // Bar fill
    const grad = ctx.createLinearGradient(0, y, 0, y + barH);
    grad.addColorStop(0, _hexToRgba(colour, 0.9));
    grad.addColorStop(1, _hexToRgba(colour, 0.2));
    ctx.fillStyle = grad;
    ctx.fillRect(x + 1, y, barW - 3, barH);

    // Label
    ctx.font      = '7px "Share Tech Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = _hexToRgba(colour, 0.7);
    ctx.fillText(DIM_LABELS[i]?.slice(0,3) || i, x + barW/2, H - 4);

    // Value label on bar
    ctx.fillStyle = colour;
    ctx.fillText(Math.round(v * 100), x + barW/2, y - 2);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ENTRY — render all agent charts into the agents-grid
// ═══════════════════════════════════════════════════════════════════════════

export function initAgentCharts(db) {
  if (!db?.agents) return;

  const agents = Object.values(db.agents);
  if (!agents.length) return;

  // ── 1. Agent Cards with 6D Radar ─────────────────────────────────────────
  const grid = document.getElementById('agents-grid');
  if (grid) {
    grid.innerHTML = '';
    const frag = document.createDocumentFragment();

    agents.forEach(agent => {
      const colour = AGENT_COLOURS[agent.id] || COLOURS.cyan;
      const sw     = agent.semanticWeights || [0.5,0.5,0.5,0.5,0.5,0.5];
      const frs    = agent.frs || 50;
      const status = agent.status || 'idle';

      const card = document.createElement('div');
      card.className = 'card';
      card.style.cssText = 'display:flex;flex-direction:column;gap:0.6rem';

      card.innerHTML = `
        <div class="card-hd">
          <div>
            <div class="card-title" style="color:${colour}">${agent.name || agent.id}</div>
            <div class="card-sub">${agent.type || 'analyst'} · FRS ${frs}</div>
          </div>
          <span class="tbadge" style="border-color:${colour};color:${colour};text-transform:uppercase;font-size:0.55rem">${status}</span>
        </div>
        <div style="display:flex;gap:0.6rem;align-items:center">
          <canvas id="radar-${agent.id}" style="flex-shrink:0"></canvas>
          <div style="flex:1;min-width:0">
            <div style="font-size:0.6rem;color:var(--txt-dim);margin-bottom:0.3rem;letter-spacing:0.06em">6D SEMANTIC WEIGHTS</div>
            <canvas id="bars-${agent.id}" style="width:100%;display:block"></canvas>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.3rem;font-size:0.58rem;color:var(--txt-dim)">
          ${DIM_LABELS.map((lbl,i)=>`<div style="display:flex;justify-content:space-between;padding:0.12rem 0.3rem;background:rgba(0,0,0,0.3);border-radius:2px"><span>${lbl}</span><span style="color:${colour}">${Math.round(sw[i]*100)}</span></div>`).join('')}
        </div>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;font-size:0.6rem;color:var(--txt-dim)">
          <span>Trust <span style="color:${colour}">${Math.round((agent.emotionalVector?.trust||0)*100)}%</span></span>
          <span>Rivalry <span style="color:var(--crimson)">${Math.round((agent.emotionalVector?.rivalry||0)*100)}%</span></span>
          <span>Balance <span style="color:var(--amber)">${((agent.balance||0)/100_000_000).toFixed(2)} MIR</span></span>
        </div>
      `;
      frag.appendChild(card);
    });

    grid.appendChild(frag);

    // Render canvases AFTER DOM insertion
    requestAnimationFrame(() => {
      agents.forEach(agent => {
        const colour = AGENT_COLOURS[agent.id] || COLOURS.cyan;
        const sw     = agent.semanticWeights || [0.5,0.5,0.5,0.5,0.5,0.5];

        // Radar chart
        renderRadarChart(`radar-${agent.id}`, DIM_LABELS, [{
          values: sw,
          colour: colour,
        }], { size: 120 });

        // Bar chart
        renderWeightBars(`bars-${agent.id}`, sw, colour, { width: 160, height: 70 });
      });
    });
  }

  // ── 2. Affinity Heatmap ───────────────────────────────────────────────────
  const affinityContainer = document.getElementById('affinity-graph');
  if (affinityContainer) {
    // Create canvas inside container
    let canvas = document.getElementById('affinity-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'affinity-canvas';
      canvas.style.display = 'block';
      canvas.style.margin  = '0 auto';
      affinityContainer.appendChild(canvas);
    }

    const matrixData = {};
    agents.forEach(agent => {
      matrixData[agent.id] = agent.affinity || {};
    });

    requestAnimationFrame(() => {
      renderAffinityHeatmap('affinity-canvas', agents, matrixData, {
        cellSize: 52,
        pad:      38,
      });
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LIVE UPDATE — call when weights change (from mir:synthesis_complete)
// ═══════════════════════════════════════════════════════════════════════════

export function updateAgentCharts(db) {
  if (!db?.agents) return;

  const agents = Object.values(db.agents);

  // Update radar + bars for each agent (no DOM rebuild)
  agents.forEach(agent => {
    const colour = AGENT_COLOURS[agent.id] || COLOURS.cyan;
    const sw     = agent.semanticWeights || [0.5,0.5,0.5,0.5,0.5,0.5];

    const radarCanvas = document.getElementById(`radar-${agent.id}`);
    if (radarCanvas) {
      renderRadarChart(`radar-${agent.id}`, DIM_LABELS, [{
        values: sw, colour,
      }], { size: 120 });
    }

    const barsCanvas = document.getElementById(`bars-${agent.id}`);
    if (barsCanvas) {
      renderWeightBars(`bars-${agent.id}`, sw, colour, { width: 160, height: 70 });
    }

    // Update numeric labels in the grid row
    sw.forEach((v, i) => {
      const els = document.querySelectorAll(
        `#agents-grid [data-agent="${agent.id}"] [data-dim="${i}"]`
      );
      els.forEach(el => { el.textContent = Math.round(v * 100); });
    });
  });

  // Rebuild affinity heatmap
  const matrixData = {};
  agents.forEach(agent => { matrixData[agent.id] = agent.affinity || {}; });
  renderAffinityHeatmap('affinity-canvas', agents, matrixData, { cellSize: 52, pad: 38 });
}
