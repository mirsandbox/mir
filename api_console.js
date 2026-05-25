/**
 * api_console.js
 * Version: 1.0.0
 *
 * MIR Platform — Interactive API Documentation Console
 * Self-contained module. Injected into DOM on demand.
 *
 * Allows live testing of: _mirMeta, _mirMesh, _mirCRDT global objects.
 * Zero external dependencies. CSP-safe (no eval, no new Function).
 *
 * Entry point:
 *   import { initAPIConsole } from './api_console.js';
 *   initAPIConsole();
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// API MANIFEST — describes callable methods on each global object
// ═══════════════════════════════════════════════════════════════════════════

const API_MANIFEST = {
  _mirMeta: {
    label: 'AI Meta Layer',
    colour: '#a855f7',
    description: 'AI agent sandbox operations and Dream State controls.',
    methods: [
      {
        name:        'runExternalQuery',
        description: 'Send a query through the AI agent pipeline.',
        params: [
          { key: 'system',    label: 'System Prompt', type: 'textarea', default: 'You are a MIR analyst. Be concise.' },
          { key: 'query',     label: 'User Query',    type: 'text',     default: 'What is the current geopolitical risk level?' },
          { key: 'maxTokens', label: 'Max Tokens',    type: 'number',   default: '120' },
        ],
        call: async (args) => {
          const meta = window._mirMeta;
          if (!meta?.runExternalQuery) throw new Error('_mirMeta.runExternalQuery not available');
          return await meta.runExternalQuery(args.system, args.query, parseInt(args.maxTokens) || 120);
        },
      },
      {
        name:        'getAgentWeights',
        description: 'Get the 6D semantic weight vector for an agent.',
        params: [
          { key: 'agentId', label: 'Agent ID', type: 'select',
            options: ['resident','macro','cyber','geo'], default: 'resident' },
        ],
        call: async (args) => {
          const meta = window._mirMeta;
          if (!meta?.getAgentWeights) throw new Error('_mirMeta.getAgentWeights not available');
          return meta.getAgentWeights(args.agentId);
        },
      },
      {
        name:        'getAgentFRS',
        description: 'Get the Forecaster Reputation Score for an agent.',
        params: [
          { key: 'agentId', label: 'Agent ID', type: 'select',
            options: ['resident','macro','cyber','geo'], default: 'resident' },
        ],
        call: async (args) => {
          const meta = window._mirMeta;
          if (!meta?.getAgentFRS) throw new Error('_mirMeta.getAgentFRS not available');
          return meta.getAgentFRS(args.agentId);
        },
      },
      {
        name:        'isReady',
        description: 'Check if the AI Meta layer DB is initialised.',
        params: [],
        call: async () => window._mirMeta?.isReady?.() ?? false,
      },
    ],
  },

  _mirMesh: {
    label: 'P2P Mesh Network',
    colour: '#00d4ff',
    description: 'WebRTC peer network status and peer management.',
    methods: [
      {
        name:        'getPeers',
        description: 'List all currently connected peer node IDs.',
        params: [],
        call: async () => {
          const mesh = window._mirMesh;
          if (!mesh) throw new Error('_mirMesh not available — mesh not initialised');
          return mesh.getPeers?.() ?? mesh.peers ?? 'no getPeers method';
        },
      },
      {
        name:        'getMeshStatus',
        description: 'Get full mesh network status object.',
        params: [],
        call: async () => {
          const mesh = window._mirMesh || window.MeshNetwork;
          if (!mesh) throw new Error('_mirMesh not available');
          return mesh.getMeshStatus?.() ?? mesh.getStatus?.() ?? { peers: 0, status: 'offline' };
        },
      },
      {
        name:        'broadcastSignal',
        description: 'Broadcast a test signal to all connected peers.',
        params: [
          { key: 'payload', label: 'Payload (JSON)', type: 'text', default: '{"type":"ping","ts":0}' },
        ],
        call: async (args) => {
          const mesh = window._mirMesh || window.MeshNetwork;
          if (!mesh) throw new Error('_mirMesh not available');
          let parsed;
          try { parsed = JSON.parse(args.payload); } catch { throw new Error('Invalid JSON payload'); }
          parsed.ts = Date.now();
          const sent = mesh.broadcastDelta?.(parsed) ?? mesh.broadcast?.(parsed);
        return sent !== undefined ? `Broadcast sent to ${sent} peer(s)` : 'Broadcast dispatched';
        },
      },
      {
        name:        'getMiningState',
        description: 'Get current PoUW mining state and epoch info.',
        params: [],
        call: async () => {
          return window.getMiningData?.() ?? window._MIR_DB?.miningState ?? 'not available';
        },
      },
    ],
  },

  _mirCRDT: {
    label: 'CRDT Ledger Engine',
    colour: '#00ff88',
    description: 'Conflict-free replicated data type operations and state inspection.',
    methods: [
      {
        name:        'getCRDTState',
        description: 'Read a field from the CRDT state store.',
        params: [
          { key: 'field', label: 'Field Path', type: 'text', default: 'tokenomics' },
        ],
        call: async (args) => {
          const crdt = window._mirCRDT || window.MeshCRDT;
          if (crdt?.getCRDTField) return crdt.getCRDTField(args.field);
          // Fallback: read from DB
          const db = window._MIR_DB;
          if (!db) throw new Error('_mirCRDT and _MIR_DB not available');
          const path = args.field.split('.');
          let val = db;
          for (const key of path) { val = val?.[key]; }
          return val ?? `field '${args.field}' not found in DB`;
        },
      },
      {
        name:        'getVectorClock',
        description: 'Get the current CRDT vector clock state.',
        params: [],
        call: async () => {
          const crdt = window._mirCRDT || window.MeshCRDT;
          return crdt?.getVectorClock?.() ?? crdt?.vectorClock ?? 'vector clock not exposed';
        },
      },
      {
        name:        'getSyncStatus',
        description: 'Get CRDT synchronisation status with peers.',
        params: [],
        call: async () => {
          const crdt = window._mirCRDT || window.MeshCRDT;
          return crdt?.getSyncStatus?.() ?? {
            lastSync:  window._MIR_DB?.lastSync ?? 0,
            pendingDeltas: 'unknown',
            status:    crdt ? 'initialised' : 'not available',
          };
        },
      },
      {
        name:        'applyDelta',
        description: 'Apply a sovereign delta (Admin only — requires signed payload).',
        params: [
          { key: 'field', label: 'Field',     type: 'text',   default: 'meta.test' },
          { key: 'value', label: 'Value',     type: 'text',   default: '"hello_from_console"' },
        ],
        call: async (args) => {
          const ses = window._MIR_SES;
          if (!ses?.pubKey) throw new Error('Not authenticated — connect wallet first');
          const adminKey = localStorage.getItem('mir_admin_pub_v2');
          if (!adminKey || adminKey !== ses.pubKey) throw new Error('Admin key required for applySovereignDelta');
          let val;
          try { val = JSON.parse(args.value); } catch { val = args.value; }
          const crdt = window._mirCRDT || window.MeshCRDT;
          return crdt?.applySovereignDelta?.({ [args.field]: val }) ?? 'applySovereignDelta not available';
        },
      },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// CSS
// ═══════════════════════════════════════════════════════════════════════════

const CONSOLE_CSS = `
#api-console-fab {
  position: fixed;
  bottom: 76px;
  right: 22px;
  z-index: 99990;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #000;
  border: 1.5px solid var(--violet, #a855f7);
  color: var(--violet, #a855f7);
  font-family: 'Orbitron', monospace;
  font-size: 0.6rem;
  font-weight: 900;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 12px rgba(168,85,247,0.3);
  transition: all 0.2s;
  opacity: 0;
  pointer-events: none;
  transform: scale(0.6);
}
#api-console-fab.ready { opacity:1; pointer-events:auto; transform:scale(1); }
#api-console-fab:hover { box-shadow: 0 0 22px rgba(168,85,247,0.5); transform:scale(1.08); }

#api-console-modal {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 99989;
  background: rgba(0,0,0,0.88);
  backdrop-filter: blur(8px);
  align-items: flex-start;
  justify-content: center;
  padding: 2vh 0;
  overflow-y: auto;
}
#api-console-modal.open { display: flex; }

.api-panel {
  width: min(820px, 97vw);
  background: #020c18;
  border: 1px solid #a855f7;
  border-radius: 4px;
  box-shadow: 0 0 40px rgba(168,85,247,0.1);
  display: flex;
  flex-direction: column;
  max-height: 95vh;
  overflow: hidden;
}
.api-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 1rem;
  border-bottom: 1px solid #111;
  background: rgba(168,85,247,0.04);
  flex-shrink: 0;
}
.api-header-title {
  font-family: 'Orbitron', monospace;
  font-size: 0.65rem;
  font-weight: 700;
  color: #a855f7;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.api-close {
  background: transparent;
  border: 1px solid #222;
  color: #444;
  width: 26px; height: 26px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.85rem;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.api-close:hover { border-color: #a855f7; color: #a855f7; }

.api-obj-tabs {
  display: flex;
  border-bottom: 1px solid #111;
  flex-shrink: 0;
}
.api-obj-tab {
  padding: 0.5rem 1rem;
  font-family: 'Orbitron', monospace;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  border: none;
  background: transparent;
  transition: all 0.15s;
  border-bottom: 2px solid transparent;
}
.api-obj-tab:hover { background: rgba(255,255,255,0.03); }
.api-obj-tab.active { border-bottom-color: var(--tab-colour, #a855f7); color: var(--tab-colour, #a855f7); }

.api-body {
  flex: 1;
  overflow-y: auto;
  display: flex;
  gap: 0;
  min-height: 0;
}
.api-methods-list {
  width: 200px;
  flex-shrink: 0;
  border-right: 1px solid #111;
  overflow-y: auto;
}
.api-method-item {
  padding: 0.55rem 0.8rem;
  font-family: 'Share Tech Mono', monospace;
  font-size: 0.63rem;
  color: #334455;
  cursor: pointer;
  border-left: 2px solid transparent;
  transition: all 0.13s;
}
.api-method-item:hover { color: #8ba3cc; background: rgba(255,255,255,0.02); }
.api-method-item.active { border-left-color: var(--panel-colour, #a855f7); color: var(--panel-colour, #a855f7); background: rgba(168,85,247,0.04); }

.api-method-detail {
  flex: 1;
  padding: 0.9rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  overflow-y: auto;
  min-width: 0;
}
.api-method-name {
  font-family: 'Orbitron', monospace;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}
.api-method-desc {
  font-family: 'Share Tech Mono', monospace;
  font-size: 0.65rem;
  color: #4a6080;
  line-height: 1.55;
}
.api-param-row {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.api-param-label {
  font-family: 'Orbitron', monospace;
  font-size: 0.55rem;
  color: #2a4a6a;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.api-param-input,
.api-param-textarea,
.api-param-select {
  background: #000;
  border: 1px solid #1a2535;
  border-radius: 2px;
  color: #00ff88;
  font-family: 'Share Tech Mono', monospace;
  font-size: 0.68rem;
  padding: 0.38rem 0.55rem;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.13s;
}
.api-param-input:focus,
.api-param-textarea:focus,
.api-param-select:focus { border-color: #a855f7; }
.api-param-textarea { min-height: 56px; resize: vertical; }
.api-param-select { color: #a855f7; }

.api-run-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  align-self: flex-start;
  background: rgba(168,85,247,0.1);
  border: 1px solid #a855f7;
  color: #a855f7;
  font-family: 'Orbitron', monospace;
  font-size: 0.6rem;
  font-weight: 700;
  padding: 0.45rem 0.9rem;
  border-radius: 3px;
  cursor: pointer;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  transition: all 0.15s;
  min-height: 36px;
}
.api-run-btn:hover:not(:disabled) { background: rgba(168,85,247,0.2); box-shadow: 0 0 12px rgba(168,85,247,0.2); }
.api-run-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.api-response-box {
  background: #000;
  border: 1px solid #1a2535;
  border-radius: 3px;
  padding: 0.65rem 0.8rem;
  font-family: 'Share Tech Mono', monospace;
  font-size: 0.65rem;
  color: #4a6080;
  min-height: 80px;
  max-height: 220px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.6;
  transition: color 0.2s;
}
.api-response-box.success { color: #00ff88; border-color: #0a2a1a; }
.api-response-box.error   { color: #ff4444; border-color: #2a0a0a; }
.api-response-box.loading { color: #a855f7; }

.api-response-label {
  font-family: 'Orbitron', monospace;
  font-size: 0.55rem;
  color: #1a3a2a;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 0.2rem;
}
.api-status-bar {
  padding: 0.35rem 1rem;
  border-top: 1px solid #111;
  font-family: 'Share Tech Mono', monospace;
  font-size: 0.58rem;
  color: #1a3a1a;
  display: flex;
  gap: 1rem;
  flex-shrink: 0;
}
.api-status-item { display: flex; gap: 0.3rem; align-items: center; }
.api-status-dot { width: 5px; height: 5px; border-radius: 50%; }
`;

// ═══════════════════════════════════════════════════════════════════════════
// CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════

let _currentObj    = '_mirMeta';
let _currentMethod = null;
let _running       = false;
let _injected      = false;

const $ = id => document.getElementById(id);

function _formatResult(val) {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'string') return val;
  try { return JSON.stringify(val, null, 2); }
  catch { return String(val); }
}

function _renderMethodList(objKey) {
  const list    = $('api-methods-list');
  const colour  = API_MANIFEST[objKey].colour;
  list.style.setProperty('--panel-colour', colour);
  list.innerHTML = API_MANIFEST[objKey].methods.map((m, i) => `
    <div class="api-method-item ${i === 0 ? 'active' : ''}"
         data-method="${m.name}"
         onclick="window._mirAPIConsole._selectMethod('${objKey}','${m.name}')">
      ${m.name}()
    </div>
  `).join('');
  _selectMethod(objKey, API_MANIFEST[objKey].methods[0].name, false);
}

function _selectMethod(objKey, methodName, updateList = true) {
  _currentMethod = methodName;
  const manifest = API_MANIFEST[objKey];
  const method   = manifest.methods.find(m => m.name === methodName);
  if (!method) return;
  const colour   = manifest.colour;

  if (updateList) {
    $('api-methods-list').querySelectorAll('.api-method-item').forEach(el => {
      el.classList.toggle('active', el.dataset.method === methodName);
    });
  }

  const detail = $('api-method-detail');
  detail.innerHTML = `
    <div class="api-method-name" style="color:${colour}">${objKey}.${method.name}()</div>
    <div class="api-method-desc">${method.description}</div>
    ${method.params.map(p => `
      <div class="api-param-row">
        <div class="api-param-label">${p.label}</div>
        ${p.type === 'textarea'
          ? `<textarea class="api-param-textarea" id="api-p-${p.key}" rows="3">${p.default || ''}</textarea>`
          : p.type === 'select'
          ? `<select class="api-param-select" id="api-p-${p.key}">${(p.options||[]).map(o=>`<option value="${o}" ${o===p.default?'selected':''}>${o}</option>`).join('')}</select>`
          : `<input class="api-param-input" id="api-p-${p.key}" type="${p.type||'text'}" value="${p.default||''}">`
        }
      </div>
    `).join('')}
    <button class="api-run-btn" id="api-run-btn" onclick="window._mirAPIConsole._run('${objKey}','${methodName}')">
      ▶ EXECUTE
    </button>
    <div>
      <div class="api-response-label">RESPONSE</div>
      <div class="api-response-box" id="api-response-box">
        Ready — press EXECUTE to call ${objKey}.${methodName}()
      </div>
    </div>
  `;
}

function _selectObj(objKey) {
  _currentObj = objKey;
  const colour = API_MANIFEST[objKey].colour;
  // Update tab styles
  $('api-obj-tabs').querySelectorAll('.api-obj-tab').forEach(tab => {
    const active = tab.dataset.obj === objKey;
    tab.classList.toggle('active', active);
    tab.style.setProperty('--tab-colour', colour);
  });
  _renderMethodList(objKey);
}

async function _run(objKey, methodName) {
  if (_running) return;
  _running = true;

  const btn     = $('api-run-btn');
  const respBox = $('api-response-box');
  if (btn) btn.disabled = true;
  if (respBox) {
    respBox.textContent = '▸ executing...';
    respBox.className   = 'api-response-box loading';
  }

  const method = API_MANIFEST[objKey]?.methods.find(m => m.name === methodName);
  if (!method) { _running = false; return; }

  // Collect param values from DOM
  const args = {};
  method.params.forEach(p => {
    const el = $(`api-p-${p.key}`);
    if (el) args[p.key] = el.value;
  });

  const t0 = performance.now();
  try {
    const result = await method.call(args);
    const ms     = (performance.now() - t0).toFixed(1);
    if (respBox) {
      respBox.textContent = _formatResult(result);
      respBox.className   = 'api-response-box success';
    }
    _setStatus(`✓ ${objKey}.${methodName}() → ${ms}ms`);
  } catch (err) {
    const ms = (performance.now() - t0).toFixed(1);
    if (respBox) {
      respBox.textContent = `ERROR: ${err.message}`;
      respBox.className   = 'api-response-box error';
    }
    _setStatus(`✗ ${err.message} (${ms}ms)`);
  } finally {
    if (btn) btn.disabled = false;
    _running = false;
  }
}

function _setStatus(msg) {
  const bar = $('api-status-text');
  if (bar) bar.textContent = msg;
}

function _updateStatusBar() {
  const meta  = window._mirMeta;
  const mesh  = window._mirMesh || window.MeshNetwork;
  const crdt  = window._mirCRDT || window.MeshCRDT;
  const items = [
    { dot: meta?.isReady?.()  ? '#00ff88' : '#ff4444', label: '_mirMeta '  + (meta ? '●' : '○') },
    { dot: mesh ? '#00d4ff'   : '#334455',              label: '_mirMesh '  + (mesh ? '●' : '○') },
    { dot: crdt ? '#a855f7'   : '#334455',              label: '_mirCRDT '  + (crdt ? '●' : '○') },
  ];
  const bar = $('api-status-bar-items');
  if (bar) bar.innerHTML = items.map(it =>
    `<span class="api-status-item"><span class="api-status-dot" style="background:${it.dot}"></span>${it.label}</span>`
  ).join('');
}

function _open() {
  $('api-console-modal')?.classList.add('open');
  _updateStatusBar();
}
function _close() { $('api-console-modal')?.classList.remove('open'); }

// ═══════════════════════════════════════════════════════════════════════════
// DOM INJECTION
// ═══════════════════════════════════════════════════════════════════════════

function _inject() {
  if (_injected) return;
  _injected = true;

  // CSS
  const style = document.createElement('style');
  style.textContent = CONSOLE_CSS;
  document.head.appendChild(style);

  // FAB button
  const fab      = document.createElement('button');
  fab.id         = 'api-console-fab';
  fab.title      = 'API Console';
  fab.innerHTML  = 'API';
  fab.onclick    = _open;
  document.body.appendChild(fab);
  requestAnimationFrame(() => fab.classList.add('ready'));

  // Modal
  const modal   = document.createElement('div');
  modal.id      = 'api-console-modal';
  modal.innerHTML = `
    <div class="api-panel">
      <div class="api-header">
        <div class="api-header-title">◈ MIR INTERACTIVE API CONSOLE</div>
        <button class="api-close" onclick="window._mirAPIConsole._close()">✕</button>
      </div>
      <div class="api-obj-tabs" id="api-obj-tabs">
        ${Object.entries(API_MANIFEST).map(([key, def]) => `
          <button class="api-obj-tab ${key === '_mirMeta' ? 'active' : ''}"
                  data-obj="${key}"
                  style="--tab-colour:${def.colour}"
                  onclick="window._mirAPIConsole._selectObj('${key}')">
            ${key}
          </button>
        `).join('')}
      </div>
      <div class="api-body">
        <div class="api-methods-list" id="api-methods-list"></div>
        <div class="api-method-detail" id="api-method-detail"></div>
      </div>
      <div class="api-status-bar" id="api-status-bar">
        <div id="api-status-bar-items"></div>
        <div id="api-status-text" style="color:#1a3a1a;margin-left:auto"></div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') _close();
  });

  // Initial render
  _selectObj('_mirMeta');
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export function initAPIConsole() {
  _inject();
  window._mirAPIConsole = { _open, _close, _selectObj, _selectMethod, _run };
}

export function openAPIConsole() {
  _inject();
  _open();
}
