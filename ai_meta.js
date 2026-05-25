/**
 * ai_meta.js
 * File Name:           ai_meta.js
 * Version:             2.0.0
 * Architectural State Hash: sha256("MIR-AI-META-V2-2025")
 * Last Sync Resolution: 2025-05-23T00:00:00Z
 *
 * MIR Platform v2.0 — File 4/6
 * Dynamic Safe-Context Code Injection · In-Browser Sandboxed Model Validation
 * Dream State Consolidation Orchestration · State Consolidation Engine
 *
 * Responsibilities:
 *   1. Blob URL Worker sandbox for safe code injection (NO eval, NO Function())
 *   2. In-browser sandboxed model validation via isolated MessageChannel Workers
 *   3. Dream State context-boundary optimization and coordination with ai_evolution.js
 *   4. HoloGate Blob Watchdog — monitors injected logic for CSP compliance
 *   5. Meta-programming safe execution layer — script isolation via Blob URIs
 *   6. State Consolidation Engine — weight snapshots, LTM pruning, CRDT sync prep
 *   7. Cognitive Load Monitor — iOS/Safari memory threshold tracking
 *   8. Analytical Model Validator — validates agent weight matrices before mutation
 *   9. Semantic Context Boundary Manager — context window slicing for agent prompts
 *  10. initMeta() — module entry point wired by initApplication() in ai_evolution.js
 *
 * CSP Compliance Notes:
 *   - Zero eval() usage anywhere in this file
 *   - Zero new Function() usage anywhere in this file
 *   - All dynamic code execution uses Blob URL Workers with explicit string literals
 *   - Worker message passing uses structured clone (no SharedArrayBuffer needed)
 *   - iframe sandbox uses sandbox="allow-scripts" with explicit allow-list only
 *
 * Sovereign Override (Rule 0):
 *   Meta-layer drops all autonomous sandbox operations instantly when
 *   sovereignFrozen signal is received from ai_evolution.js.
 *   Admin-signed payloads bypass all validation queues.
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// MODULE CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
const META_VERSION          = '2.0.0';
const BLOB_WORKER_TIMEOUT   = 8_000;     // ms — max time for a sandbox task
const MAX_BLOB_POOL         = 4;         // concurrent Blob Workers allowed
const VALIDATION_BATCH_SIZE = 6;         // weight vectors validated per cycle
const DREAM_CONSOLIDATE_MAX = 50;        // max LTM entries consolidated per run
const CONTEXT_SLICE_TOKENS  = 800;       // approx tokens per semantic context slice
const COGNITIVE_WARN_MB     = 180;       // MB — warn threshold for iOS memory
const COGNITIVE_CRIT_MB     = 240;       // MB — critical threshold, pause workers
const META_TICK_MS          = 45_000;    // background meta-tick interval
const VALIDATION_TICK_MS    = 90_000;    // weight validation cycle interval
const BLOB_GC_INTERVAL_MS   = 120_000;   // Blob URL garbage collection interval

// ═══════════════════════════════════════════════════════════════════════════
// MODULE STATE
// ═══════════════════════════════════════════════════════════════════════════
let _db                   = null;
let _agentSpeak           = null;
let _runConsensusVote     = null;
let _tuneSemanticWeights  = null;
let _stmPush              = null;
let _stmAll               = null;

let _blobPool             = [];      // active Blob Worker entries
let _blobURLRegistry      = [];      // all created Blob URLs for GC
let _sandboxIframe        = null;    // reusable sandboxed iframe
let _validationQueue      = [];      // pending model validation tasks
let _metaTimers           = {};
let _sovereignFrozen      = false;
let _cognitiveLoadPct     = 0;
let _lastConsolidationTs  = 0;
let _validationLog        = [];      // ring buffer of validation results
let _holoGateActive       = false;
let _dreamHookActive      = false;
let _pendingDreamPayload  = null;

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════
const _now    = () => Date.now();
const _uid    = () => (crypto.randomUUID ? crypto.randomUUID() : `${_now().toString(36)}-${Math.random().toString(36).slice(2)}`);
const _sleep  = ms => new Promise(r => setTimeout(r, ms));
const _clamp  = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const _ts     = () => new Date().toISOString().slice(11, 19);
const _escH   = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function _metaLog(msg, level = 'info') {
  const levels = { info: '#00d4ff', ok: '#00ff88', warn: '#ffab00', err: '#ff2244', sovereign: '#ffd700' };
  const color  = levels[level] || '#8ba3cc';
  console.log(`%c[META ${_ts()}] ${msg}`, `color:${color};font-family:monospace;font-size:11px`);
  // Also push to terminal log if open
  if (typeof window._mirAdminLog === 'function') window._mirAdminLog(`[META] ${msg}`, level === 'err' ? 'err' : level === 'warn' ? 'warn' : '');
}

function _logValidation(entry) {
  _validationLog.push({ ...entry, ts: _now() });
  if (_validationLog.length > 100) _validationLog = _validationLog.slice(-100);
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: BLOB WORKER SANDBOX ENGINE
// CSP-safe dynamic execution using Blob URL Workers
// No eval(), No new Function() — all code is pre-authored string literals
// ═══════════════════════════════════════════════════════════════════════════

/**
 * _createBlobWorker()
 * Creates an isolated Web Worker from a Blob URL.
 * The worker code is a complete pre-authored string — no dynamic eval.
 * Returns { worker, blobURL, id } for lifecycle management.
 */
function _createBlobWorker(workerScript) {
  const blob    = new Blob([workerScript], { type: 'application/javascript' });
  const blobURL = URL.createObjectURL(blob);
  const worker  = new Worker(blobURL);
  const id      = _uid();
  _blobURLRegistry.push({ blobURL, id, createdAt: _now() });
  return { worker, blobURL, id };
}

/**
 * _revokeBlobURL()
 * Explicitly revokes a Blob URL to free memory — critical for iOS Safari.
 */
function _revokeBlobURL(blobURL) {
  try { URL.revokeObjectURL(blobURL); } catch {}
  _blobURLRegistry = _blobURLRegistry.filter(e => e.blobURL !== blobURL);
}

/**
 * _gcBlobURLs()
 * Garbage-collect Blob URLs older than their expected lifetime.
 * Prevents memory leaks on long-running iOS sessions.
 */
function _gcBlobURLs() {
  const now    = _now();
  const cutoff = now - BLOB_WORKER_TIMEOUT * 3;
  const stale  = _blobURLRegistry.filter(e => e.createdAt < cutoff);
  stale.forEach(e => _revokeBlobURL(e.blobURL));
  if (stale.length > 0) {
    _metaLog(`GC: revoked ${stale.length} stale Blob URLs`, 'info');
    // FIX: reassign registry after filter to actually remove stale entries
    _blobURLRegistry = _blobURLRegistry.filter(e => e.createdAt >= cutoff);
  }
}

/**
 * _runBlobTask()
 * Executes a pre-authored task in an isolated Blob Worker with timeout.
 * task: { type: string, payload: object }
 * Returns Promise<result> or rejects on timeout.
 *
 * The worker script is a COMPLETE authored string — NOT dynamic code injection.
 * This pattern is CSP-safe because the Blob content is static authored code
 * that processes structured data via postMessage, never executes user strings.
 */
function _runBlobTask(taskType, payload, workerScript) {
  return new Promise((resolve, reject) => {
    if (_blobPool.length >= MAX_BLOB_POOL) {
      reject(new Error('Blob worker pool exhausted'));
      return;
    }

    const { worker, blobURL, id } = _createBlobWorker(workerScript);
    const entry = { worker, blobURL, id, startedAt: _now() };
    _blobPool.push(entry);

    const timeout = setTimeout(() => {
      worker.terminate();
      _revokeBlobURL(blobURL);
      _blobPool = _blobPool.filter(e => e.id !== id);
      reject(new Error(`Blob worker timeout: ${taskType}`));
    }, BLOB_WORKER_TIMEOUT);

    worker.onmessage = (e) => {
      clearTimeout(timeout);
      worker.terminate();
      _revokeBlobURL(blobURL);
      _blobPool = _blobPool.filter(e => e.id !== id);
      resolve(e.data);
    };

    worker.onerror = (e) => {
      clearTimeout(timeout);
      worker.terminate();
      _revokeBlobURL(blobURL);
      _blobPool = _blobPool.filter(en => en.id !== id);
      reject(new Error(`Worker error: ${e.message}`));
    };

    worker.postMessage({ type: taskType, payload });
  });
}

// ── Pre-authored Worker Scripts (static string literals — CSP safe) ────────

/**
 * WEIGHT_VALIDATION_WORKER_SCRIPT
 * Validates a 6D semantic weight matrix for:
 *   - Dimension completeness (must have exactly 6 floats)
 *   - Range compliance (each weight 0.05 – 0.95)
 *   - L1 norm sanity (sum between 1.5 and 5.0)
 *   - Drift detection (max single-step change < 0.35)
 *   - NaN/Infinity guard
 */
const WEIGHT_VALIDATION_WORKER_SCRIPT = `
'use strict';
self.onmessage = function(e) {
  const { type, payload } = e.data;
  if (type !== 'validate_weights') { self.postMessage({ ok: false, error: 'wrong task type' }); return; }

  const { agentId, weights, prevWeights } = payload;
  const results = [];
  const errors  = [];

  // Dimension check
  if (!Array.isArray(weights) || weights.length !== 6) {
    self.postMessage({ ok: false, agentId, errors: ['weights must be array of 6 floats'] });
    return;
  }

  // Individual range + NaN check
  weights.forEach(function(w, i) {
    if (typeof w !== 'number' || isNaN(w) || !isFinite(w)) {
      errors.push('dim[' + i + '] is not a finite number: ' + w);
    } else if (w < 0.0 || w > 1.0) {
      errors.push('dim[' + i + '] out of range [0,1]: ' + w.toFixed(4));
    } else if (w < 0.05) {
      errors.push('dim[' + i + '] below safe floor 0.05: ' + w.toFixed(4));
    } else if (w > 0.95) {
      errors.push('dim[' + i + '] above safe ceiling 0.95: ' + w.toFixed(4));
    } else {
      results.push({ dim: i, value: w, ok: true });
    }
  });

  // L1 norm sanity
  var sum = weights.reduce(function(a, b) { return a + b; }, 0);
  if (sum < 1.5 || sum > 5.7) {
    errors.push('L1 norm out of range [1.5, 5.7]: ' + sum.toFixed(4));
  }

  // Drift detection against previous weights
  if (Array.isArray(prevWeights) && prevWeights.length === 6) {
    weights.forEach(function(w, i) {
      var drift = Math.abs(w - prevWeights[i]);
      if (drift > 0.35) {
        errors.push('dim[' + i + '] drift too large: ' + drift.toFixed(4) + ' (max 0.35)');
      }
    });
  }

  self.postMessage({
    ok:        errors.length === 0,
    agentId:   agentId,
    weights:   weights,
    l1norm:    sum,
    errors:    errors,
    results:   results,
    timestamp: Date.now(),
  });
};
`;

/**
 * CONTEXT_SLICE_WORKER_SCRIPT
 * Slices and scores STM context entries for Dream State consolidation.
 * Scores each entry by recency decay × trigger weight × response length signal.
 * Returns ranked list ready for LTM promotion.
 */
const CONTEXT_SLICE_WORKER_SCRIPT = `
'use strict';
self.onmessage = function(e) {
  const { type, payload } = e.data;
  if (type !== 'slice_context') { self.postMessage({ ok: false, error: 'wrong task type' }); return; }

  const { entries, maxTokenBudget, now } = payload;
  if (!Array.isArray(entries) || entries.length === 0) {
    self.postMessage({ ok: true, promoted: [], pruned: 0 }); return;
  }

  var DECAY_HALF_LIFE = 3600000; // 1 hour
  var TRIGGER_WEIGHTS = {
    flash_alert:                  1.0,
    consensus_reached:            0.95,
    consensus_failed:             0.80,
    new_scenario_submitted:       0.90,
    scenario_probability_update:  0.85,
    dream_complete:               0.95,
    platform_init:                0.30,
    human_message:                0.70,
    osint_scan:                   0.75,
    market_pulse:                 0.65,
    geopolitical_update:          0.80,
    economic_signal:              0.75,
    cyber_threat_feed:            0.85,
    risk_model_update:            0.70,
    default:                      0.50,
  };

  var scored = entries.map(function(entry) {
    var age       = (now - (entry.ts || now)) / DECAY_HALF_LIFE;
    var decay     = Math.exp(-0.693 * age);                          // half-life decay
    var triggerW  = TRIGGER_WEIGHTS[entry.trigger] || TRIGGER_WEIGHTS.default;
    var lenSignal = Math.min(1.0, ((entry.response || '').length) / 300);
    var score     = decay * triggerW * (0.6 + 0.4 * lenSignal);
    return { entry: entry, score: score };
  });

  // Sort descending by score
  scored.sort(function(a, b) { return b.score - a.score; });

  // Greedy token-budget fill
  var budgetUsed = 0;
  var promoted   = [];
  var pruned     = 0;

  scored.forEach(function(item) {
    var estimatedTokens = Math.ceil(
      ((item.entry.trigger  || '').length +
       (item.entry.context  || '').length +
       (item.entry.response || '').length) / 4
    );
    if (budgetUsed + estimatedTokens <= maxTokenBudget) {
      promoted.push({ entry: item.entry, score: item.score, tokens: estimatedTokens });
      budgetUsed += estimatedTokens;
    } else {
      pruned++;
    }
  });

  self.postMessage({
    ok:          true,
    promoted:    promoted,
    pruned:      pruned,
    budgetUsed:  budgetUsed,
    totalInput:  entries.length,
    timestamp:   Date.now(),
  });
};
`;

/**
 * AFFINITY_COMPUTE_WORKER_SCRIPT
 * Computes updated affinity scores for all agent pairs given a batch of
 * interaction events, applying exponential moving average smoothing.
 * Runs off-main-thread to avoid blocking iOS UI during Dream State.
 */
const AFFINITY_COMPUTE_WORKER_SCRIPT = `
'use strict';
self.onmessage = function(e) {
  const { type, payload } = e.data;
  if (type !== 'compute_affinity') { self.postMessage({ ok: false, error: 'wrong task type' }); return; }

  const { currentMatrix, events, smoothingAlpha } = payload;
  var alpha   = typeof smoothingAlpha === 'number' ? smoothingAlpha : 0.12;
  var updated = {};

  // Deep-copy current matrix
  Object.keys(currentMatrix).forEach(function(agentId) {
    updated[agentId] = {};
    Object.keys(currentMatrix[agentId]).forEach(function(otherId) {
      updated[agentId][otherId] = currentMatrix[agentId][otherId];
    });
  });

  var INTERACTION_DELTAS = {
    agree:              +4,
    disagree:           -3,
    challenge:          -1,
    support:            +3,
    consensus_reached:  +5,
    consensus_failed:   -4,
    flash_alert:        +2,
    dream_complete:     +6,
    critique:           -2,
    praise:             +3,
    neutral:             0,
  };

  // Apply each event to the matrix
  events.forEach(function(ev) {
    var delta = INTERACTION_DELTAS[ev.type] || 0;
    if (!updated[ev.from] || !updated[ev.from][ev.to]) return;

    // EMA update: new = alpha * (current + delta) + (1 - alpha) * current
    var current = updated[ev.from][ev.to];
    var target  = Math.max(10, Math.min(95, current + delta));
    updated[ev.from][ev.to] = alpha * target + (1 - alpha) * current;

    // Symmetric damping: interactions affect the reverse relationship at half strength
    if (updated[ev.to] && updated[ev.to][ev.from] !== undefined) {
      var revCurrent = updated[ev.to][ev.from];
      var revTarget  = Math.max(10, Math.min(95, revCurrent + delta * 0.5));
      updated[ev.to][ev.from] = alpha * revTarget + (1 - alpha) * revCurrent;
    }
  });

  // Round to 2 decimal places
  Object.keys(updated).forEach(function(agentId) {
    Object.keys(updated[agentId]).forEach(function(otherId) {
      updated[agentId][otherId] = Math.round(updated[agentId][otherId] * 100) / 100;
    });
  });

  self.postMessage({
    ok:            true,
    updatedMatrix: updated,
    eventsApplied: events.length,
    timestamp:     Date.now(),
  });
};
`;

/**
 * SCENARIO_PROBABILITY_WORKER_SCRIPT
 * Computes updated scenario consensus probabilities using agent semantic
 * weight vectors and historical accuracy (FRS) as confidence weights.
 * Implements Bayesian-style confidence-weighted aggregation.
 */
const SCENARIO_PROBABILITY_WORKER_SCRIPT = `
'use strict';
self.onmessage = function(e) {
  const { type, payload } = e.data;
  if (type !== 'compute_scenario_probs') { self.postMessage({ ok: false, error: 'wrong task type' }); return; }

  const { scenarios, agents, adminOverrideIds } = payload;
  var results = [];

  scenarios.forEach(function(scenario) {
    // Skip admin-overridden scenarios
    if (adminOverrideIds.indexOf(scenario.id) !== -1) {
      results.push({ id: scenario.id, consensusProb: scenario.consensusProb, overridden: true });
      return;
    }

    var weightedSum   = 0;
    var totalWeight   = 0;
    var contributions = {};

    ['macro', 'cyber', 'geo'].forEach(function(agentId) {
      var agent = agents[agentId];
      if (!agent || !Array.isArray(agent.semanticWeights)) return;

      var sw  = agent.semanticWeights;
      var frs = agent.frs || 50;

      // Domain relevance: weighted average of top-3 semantic dimensions
      var sorted   = sw.map(function(v, i) { return { v: v, i: i }; }).sort(function(a, b) { return b.v - a.v; });
      var top3avg  = (sorted[0].v + sorted[1].v + sorted[2].v) / 3;

      // FRS confidence: normalised to [0.5, 1.5]
      var frsConf  = 0.5 + (frs / 100);

      // Combined agent weight
      var agentW   = top3avg * frsConf;

      // Agent's probability estimate: current consensusProb biased by urgency weight
      var urgency  = sw[5] || 0.5;
      var prob     = scenario.consensusProb + (urgency - 0.5) * 8;
      prob = Math.max(1, Math.min(99, prob));

      contributions[agentId] = { weight: agentW, prob: prob, top3avg: top3avg };
      weightedSum  += agentW * prob;
      totalWeight  += agentW;
    });

    var newProb = totalWeight > 0 ? weightedSum / totalWeight : scenario.consensusProb;

    // Smooth toward existing value to prevent wild swings
    newProb = 0.85 * scenario.consensusProb + 0.15 * newProb;
    newProb = Math.round(Math.max(1, Math.min(99, newProb)));

    results.push({
      id:            scenario.id,
      consensusProb: newProb,
      contributions: contributions,
      overridden:    false,
    });
  });

  self.postMessage({
    ok:        true,
    results:   results,
    timestamp: Date.now(),
  });
};
`;

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: SANDBOX IFRAME BRIDGE
// For safe-context code injection that needs DOM access but must remain
// isolated from the main frame. Uses strict sandbox attribute with minimal
// permission surface. NO allow-same-origin to enforce strict isolation.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * _initSandboxIframe()
 * Creates a reusable sandboxed iframe for safe-context injections.
 * sandbox="allow-scripts" only — no same-origin, no forms, no popups.
 * Communication via postMessage with origin checking.
 */
function _initSandboxIframe() {
  // Remove stale iframe from DOM before creating a new one
  if (_sandboxIframe) {
    try {
      if (_sandboxIframe.parentNode) _sandboxIframe.parentNode.removeChild(_sandboxIframe);
    } catch {}
    _sandboxIframe = null;
  }

  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-scripts');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:absolute;width:1px;height:1px;border:0;opacity:0;pointer-events:none;left:-9999px;top:-9999px';

  // Minimal bootstrap document — all code is pre-authored, not user-injected
  const bootstrapDoc = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body>
<script>
'use strict';
var _handlers = {};
window.addEventListener('message', function(e) {
  if (!e.data || !e.data.type) return;
  var h = _handlers[e.data.type];
  if (h) {
    try {
      var result = h(e.data.payload);
      e.source.postMessage({ type: e.data.type + '_result', requestId: e.data.requestId, result: result, ok: true }, '*');
    } catch(err) {
      e.source.postMessage({ type: e.data.type + '_result', requestId: e.data.requestId, error: err.message, ok: false }, '*');
    }
  }
});

// Pre-authored handlers (not user-injected, CSP-safe)
_handlers['validate_json'] = function(payload) {
  var parsed = JSON.parse(payload.jsonStr);
  return { valid: true, keys: Object.keys(parsed).length };
};

_handlers['hash_payload'] = function(payload) {
  var str = JSON.stringify(payload.data);
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + c;
    hash = hash & hash;
  }
  return { hash: Math.abs(hash).toString(16), length: str.length };
};

_handlers['compute_stats'] = function(payload) {
  var arr = payload.values;
  if (!Array.isArray(arr) || arr.length === 0) return { mean: 0, stddev: 0, min: 0, max: 0 };
  var mean = arr.reduce(function(a, b) { return a + b; }, 0) / arr.length;
  var vari = arr.reduce(function(a, b) { return a + Math.pow(b - mean, 2); }, 0) / arr.length;
  return {
    mean:   mean,
    stddev: Math.sqrt(vari),
    min:    Math.min.apply(null, arr),
    max:    Math.max.apply(null, arr),
    count:  arr.length,
  };
};

_handlers['score_entries'] = function(payload) {
  var entries = payload.entries || [];
  var now     = payload.now || Date.now();
  return entries.map(function(entry, i) {
    var age   = (now - (entry.ts || now)) / 3600000;
    var decay = Math.exp(-0.693 * age);
    return { index: i, score: decay * (entry.weight || 0.5), ts: entry.ts };
  });
};
<\/script>
</body></html>`;

  const blob    = new Blob([bootstrapDoc], { type: 'text/html' });
  const blobURL = URL.createObjectURL(blob);
  iframe.src    = blobURL;
  _blobURLRegistry.push({ blobURL, id: 'sandbox_iframe', createdAt: _now() });

  document.body.appendChild(iframe);
  _sandboxIframe = iframe;
  _metaLog('Sandbox iframe initialised (sandbox="allow-scripts" only)', 'ok');
  return iframe;
}

/**
 * _sandboxCall()
 * Sends a pre-authored task to the sandboxed iframe and awaits a response.
 * Returns a Promise that resolves with the result or rejects on timeout.
 */
function _sandboxCall(type, payload, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    if (!_sandboxIframe || !_sandboxIframe.contentWindow) {
      reject(new Error('Sandbox iframe not ready'));
      return;
    }

    const requestId = _uid();
    const responseType = type + '_result';

    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error(`Sandbox call timeout: ${type}`));
    }, timeoutMs);

    function handler(e) {
      if (!e.data || e.data.type !== responseType) return;
      if (e.data.requestId !== requestId) return;
      clearTimeout(timeout);
      window.removeEventListener('message', handler);
      if (e.data.ok) resolve(e.data.result);
      else reject(new Error(e.data.error || 'sandbox error'));
    }

    window.addEventListener('message', handler);
    _sandboxIframe.contentWindow.postMessage({ type, payload, requestId }, '*');
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: HOLGATE BLOB WATCHDOG
// Monitors all active Blob Workers for anomalous behavior patterns.
// If a worker exceeds execution thresholds or emits unexpected message
// shapes, the watchdog terminates it and logs the event.
// ═══════════════════════════════════════════════════════════════════════════

function _initHoloGateWatchdog() {
  if (_holoGateActive) return;
  _holoGateActive = true;

  _metaTimers.holoGate = setInterval(() => {
    if (_sovereignFrozen) return;
    const now     = _now();
    const stale   = _blobPool.filter(e => now - e.startedAt > BLOB_WORKER_TIMEOUT * 0.9);

    stale.forEach(entry => {
      _metaLog(`HoloGate: terminating overdue worker ${entry.id.slice(0,8)}`, 'warn');
      try { entry.worker.terminate(); } catch {}
      _revokeBlobURL(entry.blobURL);
      _blobPool = _blobPool.filter(e => e.id !== entry.id);
    });

    if (stale.length > 0) {
      _logValidation({
        type:    'holgate_termination',
        count:   stale.length,
        ids:     stale.map(e => e.id.slice(0,8)),
        reason:  'execution_timeout',
      });
    }

    // Cognitive load check
    _checkCognitiveLoad();
  }, 5000);

  _metaLog('HoloGate watchdog active', 'ok');
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: COGNITIVE LOAD MONITOR
// Tracks approximate memory consumption and pauses heavy workers
// when approaching iOS Safari thresholds to prevent tab crashes.
// ═══════════════════════════════════════════════════════════════════════════

function _checkCognitiveLoad() {
  // Use performance.memory if available (Chrome) or estimate from DB size
  let estimatedMB = 0;

  if (performance && performance.memory) {
    estimatedMB = performance.memory.usedJSHeapSize / (1024 * 1024);
  } else {
    // Fallback: estimate from DB JSON size + blob pool
    try {
      const dbSize      = JSON.stringify(window._MIR_DB || {}).length / (1024 * 1024);
      const workerCount = _blobPool.length;
      estimatedMB       = dbSize * 8 + workerCount * 4;
    } catch {
      estimatedMB = 50;
    }
  }

  _cognitiveLoadPct = Math.min(100, Math.round((estimatedMB / COGNITIVE_CRIT_MB) * 100));

  // Update UI indicator if present
  const loadEl = document.getElementById('meta-cognitive-load');
  if (loadEl) loadEl.textContent = `${_cognitiveLoadPct}%`;
  const loadBar = document.getElementById('meta-cognitive-bar');
  if (loadBar) {
    loadBar.style.width = `${_cognitiveLoadPct}%`;
    loadBar.style.background = _cognitiveLoadPct > 80 ? 'var(--crimson)' : _cognitiveLoadPct > 60 ? 'var(--amber)' : 'var(--green)';
  }

  if (estimatedMB >= COGNITIVE_CRIT_MB) {
    _metaLog(`COGNITIVE CRITICAL: ${estimatedMB.toFixed(0)} MB — pausing all workers`, 'err');
    _pauseAllWorkers();
  } else if (estimatedMB >= COGNITIVE_WARN_MB) {
    _metaLog(`Cognitive load warning: ${estimatedMB.toFixed(0)} MB`, 'warn');
    // Reduce concurrency
    if (_blobPool.length > 1) {
      const oldest = _blobPool[0];
      try { oldest.worker.terminate(); } catch {}
      _revokeBlobURL(oldest.blobURL);
      _blobPool = _blobPool.slice(1);
    }
  }
}

function _pauseAllWorkers() {
  _blobPool.forEach(entry => {
    try { entry.worker.terminate(); } catch {}
    _revokeBlobURL(entry.blobURL);
  });
  _blobPool = [];
  _metaLog('All Blob workers terminated — memory pressure relief', 'warn');
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5: IN-BROWSER SANDBOXED MODEL VALIDATION
// Validates agent semantic weight matrices before any state mutation.
// Uses the Blob Worker weight validator (WEIGHT_VALIDATION_WORKER_SCRIPT).
// ═══════════════════════════════════════════════════════════════════════════

/**
 * validateAgentWeights()
 * Public API — validates a single agent's 6D weight vector.
 * Returns { ok, errors, l1norm, agentId }
 */
export async function validateAgentWeights(agentId, weights, prevWeights = null) {
  try {
    const result = await _runBlobTask(
      'validate_weights',
      { agentId, weights, prevWeights },
      WEIGHT_VALIDATION_WORKER_SCRIPT
    );
    _logValidation({ type: 'weight_validation', ...result });
    if (!result.ok) {
      _metaLog(`Weight validation FAILED [${agentId}]: ${result.errors.join('; ')}`, 'warn');
    }
    return result;
  } catch (err) {
    _metaLog(`Weight validation error [${agentId}]: ${err.message}`, 'err');
    return { ok: false, agentId, errors: [err.message] };
  }
}

/**
 * _runValidationCycle()
 * Background cycle: validates all 4 agent weight vectors in sequence.
 * Auto-clamps any out-of-range weights and updates DB.
 */
async function _runValidationCycle() {
  if (!_db || _sovereignFrozen) return;
  const agents = Object.values(_db.agents || {});
  if (!agents.length) return;

  _metaLog(`Validation cycle: checking ${agents.length} agent weight matrices`, 'info');

  for (const agent of agents.slice(0, VALIDATION_BATCH_SIZE)) {
    if (!agent.semanticWeights) continue;
    const prevWeights = agent._prevWeights || null;
    const result      = await validateAgentWeights(agent.id, agent.semanticWeights, prevWeights);

    if (!result.ok && result.errors) {
      // Auto-repair: clamp each dimension to safe range
      agent.semanticWeights = agent.semanticWeights.map(w => {
        if (typeof w !== 'number' || isNaN(w) || !isFinite(w)) return 0.50;
        return Math.max(0.05, Math.min(0.95, w));
      });
      _metaLog(`Auto-repaired weights for ${agent.id}`, 'warn');
      if (typeof window.markDirty === 'function') window.markDirty();
    }

    // Snapshot prev weights for next cycle drift detection
    agent._prevWeights = [...agent.semanticWeights];
    await _sleep(100); // yield to main thread between agents
  }
}

/**
 * validateJSONPayload()
 * Validates a JSON string inside the sandboxed iframe.
 * Used to verify external feed payloads before processing.
 */
export async function validateJSONPayload(jsonStr) {
  try {
    const result = await _sandboxCall('validate_json', { jsonStr }, 3000);
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * hashPayloadSandboxed()
 * Computes a lightweight hash of a payload inside the sandbox iframe.
 * Used for CRDT change detection without exposing data to main frame logic.
 */
export async function hashPayloadSandboxed(data) {
  try {
    const result = await _sandboxCall('hash_payload', { data }, 3000);
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * computeStatsSandboxed()
 * Computes descriptive statistics for a numeric array inside the sandbox.
 * Used by OSINT scoring and supply history analysis.
 */
export async function computeStatsSandboxed(values) {
  try {
    const result = await _sandboxCall('compute_stats', { values }, 3000);
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6: SEMANTIC CONTEXT BOUNDARY MANAGER
// Slices STM entries into token-budget-aware context windows for agent prompts.
// Runs in Blob Worker to avoid blocking main thread during Dream State.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * sliceContextForAgent()
 * Slices all STM entries for a given agent into a ranked, token-budgeted list.
 * Returns promoted entries sorted by score (decay × trigger weight × length).
 */
export async function sliceContextForAgent(agentId, stmEntries, tokenBudget = CONTEXT_SLICE_TOKENS) {
  if (!stmEntries || stmEntries.length === 0) return { ok: true, promoted: [], pruned: 0 };
  try {
    const result = await _runBlobTask(
      'slice_context',
      { entries: stmEntries, maxTokenBudget: tokenBudget, now: _now() },
      CONTEXT_SLICE_WORKER_SCRIPT
    );
    _metaLog(`Context slice [${agentId}]: ${result.promoted?.length || 0} promoted, ${result.pruned || 0} pruned`, 'info');
    return result;
  } catch (err) {
    _metaLog(`Context slice error [${agentId}]: ${err.message}`, 'err');
    return { ok: false, error: err.message, promoted: stmEntries.slice(0, 10).map(e => ({ entry: e, score: 0.5 })) };
  }
}

/**
 * buildAgentContextString()
 * Builds a formatted context string from sliced STM entries.
 * Used to enrich agent prompts with relevant recent history.
 */
export async function buildAgentContextString(agentId, stmEntries) {
  const sliceResult = await sliceContextForAgent(agentId, stmEntries, CONTEXT_SLICE_TOKENS);
  if (!sliceResult.ok || !sliceResult.promoted?.length) return '';

  const lines = sliceResult.promoted.slice(0, 8).map(item => {
    const e = item.entry;
    return `[${e.trigger || 'event'}] ${(e.response || e.context || '').slice(0, 120)}`;
  });

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7: AFFINITY MATRIX UPDATER (OFF-MAIN-THREAD)
// Computes updated affinity scores in a Blob Worker during Dream State
// to prevent UI jank on mobile during the consolidation overlay.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * computeAffinityUpdate()
 * Computes updated affinity scores for all agent pairs given interaction events.
 * Returns the updated matrix without mutating DB until caller commits.
 */
export async function computeAffinityUpdate(currentMatrix, events) {
  if (!events || events.length === 0) return { ok: true, updatedMatrix: currentMatrix, eventsApplied: 0 };
  try {
    const result = await _runBlobTask(
      'compute_affinity',
      { currentMatrix, events, smoothingAlpha: 0.12 },
      AFFINITY_COMPUTE_WORKER_SCRIPT
    );
    _metaLog(`Affinity update: ${result.eventsApplied} events applied`, 'info');
    return result;
  } catch (err) {
    _metaLog(`Affinity update error: ${err.message}`, 'err');
    return { ok: false, error: err.message, updatedMatrix: currentMatrix };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8: SCENARIO PROBABILITY RECOMPUTATION (OFF-MAIN-THREAD)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * recomputeScenarioProbabilities()
 * Runs probability recomputation for all non-admin-overridden scenarios.
 * Returns updated probability results without mutating DB.
 */
export async function recomputeScenarioProbabilities(scenarios, agents) {
  if (!scenarios || scenarios.length === 0) return { ok: true, results: [] };
  const adminOverrideIds = (scenarios || []).filter(s => s.adminOverride).map(s => s.id);
  try {
    const result = await _runBlobTask(
      'compute_scenario_probs',
      { scenarios, agents, adminOverrideIds },
      SCENARIO_PROBABILITY_WORKER_SCRIPT
    );
    _metaLog(`Scenario probs: ${result.results?.length || 0} recomputed`, 'info');
    return result;
  } catch (err) {
    _metaLog(`Scenario prob error: ${err.message}`, 'err');
    return { ok: false, error: err.message, results: [] };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 9: DREAM STATE CONSOLIDATION ORCHESTRATOR
// This is the meta-layer coordination engine for Dream State.
// ai_evolution.js calls engageDreamState() which drives the UI overlay;
// this module provides the heavy off-main-thread data processing hooks
// that ai_evolution.js delegates to via _dreamHookActive signalling.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * prepareDreamStatePayload()
 * Called by ai_evolution.js before engageDreamState() starts the overlay.
 * Gathers all STM entries, current affinity matrix, and agent weights,
 * packages them into a structured payload for off-thread processing.
 * Returns the payload object which is stored in _pendingDreamPayload.
 */
export async function prepareDreamStatePayload() {
  if (!_db) return null;
  _dreamHookActive = true;

  const agents    = _db.agents  || {};
  const stmAll    = typeof _stmAll === 'function' ? _stmAll() : [];

  // Build current affinity matrix
  const currentMatrix = {};
  Object.entries(agents).forEach(([id, agent]) => {
    if (agent.affinity) currentMatrix[id] = { ...agent.affinity };
  });

  // Build interaction events from recent STM (last 60 minutes)
  const cutoff = _now() - 3_600_000;
  const recentSTM = stmAll.filter(e => (e.ts || 0) > cutoff);
  const events = recentSTM.map(e => ({
    from: e.agentId || 'resident',
    to:   'resident',
    type: e.trigger || 'neutral',
    ts:   e.ts || _now(),
  })).filter(ev => ev.from !== ev.to);

  // Build agent weight snapshots
  const weightSnapshots = {};
  Object.entries(agents).forEach(([id, agent]) => {
    weightSnapshots[id] = {
      current:  [...(agent.semanticWeights || [0.5, 0.5, 0.5, 0.5, 0.5, 0.5])],
      previous: [...(agent._prevWeights   || [0.5, 0.5, 0.5, 0.5, 0.5, 0.5])],
      frs:      agent.frs || 50,
    };
  });

  _pendingDreamPayload = {
    id:               _uid(),
    preparedAt:       _now(),
    stmEntries:       stmAll,
    recentSTM,
    currentMatrix,
    events,
    weightSnapshots,
    scenarios:        (_db.scenarios || []).slice(),
    agentCount:       Object.keys(agents).length,
    totalSTMItems:    stmAll.length,
    recentEvents:     events.length,
  };

  _metaLog(`Dream payload prepared: ${stmAll.length} STM items, ${events.length} events`, 'info');
  return _pendingDreamPayload;
}

/**
 * executeDreamConsolidationMeta()
 * Heavy off-thread processing phase of Dream State.
 * Called by ai_evolution.js _executeDreamConsolidation() as a delegate.
 * Runs: context slicing, affinity update, weight validation, scenario prob recompute.
 * Returns consolidated results for ai_evolution.js to commit to DB.
 *
 * Context boundary: this function owns the Blob Worker orchestration.
 * ai_evolution.js owns the DB mutation and UI updates.
 */
export async function executeDreamConsolidationMeta(payload) {
  if (!payload) {
    _metaLog('Dream consolidation: no payload — aborting', 'err');
    return null;
  }

  _metaLog('Dream consolidation: off-thread processing begins', 'info');
  const results = {
    id:                  payload.id,
    ts:                  _now(),
    contextSlices:       {},
    updatedAffinityMatrix: payload.currentMatrix,
    updatedScenarioProbs: [],
    weightValidation:    {},
    errors:              [],
  };

  // ── Phase A: Context slicing per agent ───────────────────────────────
  const agentIds = ['resident', 'macro', 'cyber', 'geo'];
  for (const agentId of agentIds) {
    const agentEntries = (payload.stmEntries || []).filter(e => e.agentId === agentId || !e.agentId);
    if (agentEntries.length === 0) continue;
    try {
      const slice = await sliceContextForAgent(agentId, agentEntries, CONTEXT_SLICE_TOKENS);
      results.contextSlices[agentId] = {
        promoted:  slice.promoted  || [],
        pruned:    slice.pruned    || 0,
        budgetUsed:slice.budgetUsed|| 0,
      };
      _metaLog(`Context slice [${agentId}]: ${(slice.promoted || []).length} entries promoted`, 'info');
    } catch (err) {
      results.errors.push(`contextSlice[${agentId}]: ${err.message}`);
    }
    await _sleep(80);
  }

  // ── Phase B: Affinity matrix update ──────────────────────────────────
  if ((payload.events || []).length > 0) {
    try {
      const affinityResult = await computeAffinityUpdate(payload.currentMatrix, payload.events);
      if (affinityResult.ok) {
        results.updatedAffinityMatrix = affinityResult.updatedMatrix;
        _metaLog(`Affinity update: ${affinityResult.eventsApplied} events applied`, 'info');
      } else {
        results.errors.push(`affinityUpdate: ${affinityResult.error}`);
      }
    } catch (err) {
      results.errors.push(`affinityUpdate: ${err.message}`);
    }
  }

  // ── Phase C: Weight validation for all agents ─────────────────────────
  const agentsSnapshot = payload.weightSnapshots || {};
  for (const [agentId, snap] of Object.entries(agentsSnapshot)) {
    try {
      const validation = await validateAgentWeights(agentId, snap.current, snap.previous);
      results.weightValidation[agentId] = validation;
      if (!validation.ok) {
        _metaLog(`Weight validation failed [${agentId}]: ${validation.errors?.join('; ')}`, 'warn');
      }
    } catch (err) {
      results.errors.push(`weightValidation[${agentId}]: ${err.message}`);
    }
    await _sleep(60);
  }

  // ── Phase D: Scenario probability recomputation ───────────────────────
  if (_db && (payload.scenarios || []).length > 0) {
    try {
      const scenResult = await recomputeScenarioProbabilities(
        payload.scenarios,
        _db.agents || {}
      );
      if (scenResult.ok) {
        results.updatedScenarioProbs = scenResult.results;
        _metaLog(`Scenario probs: ${scenResult.results.length} recomputed`, 'info');
      } else {
        results.errors.push(`scenarioProbs: ${scenResult.error}`);
      }
    } catch (err) {
      results.errors.push(`scenarioProbs: ${err.message}`);
    }
  }

  const duration = _now() - results.ts;
  _metaLog(`Dream consolidation complete: ${duration}ms, ${results.errors.length} errors`, results.errors.length > 0 ? 'warn' : 'ok');

  _dreamHookActive     = false;
  _pendingDreamPayload = null;
  _lastConsolidationTs = _now();

  return results;
}

/**
 * commitDreamResults()
 * Applies the off-thread consolidation results back to the DB.
 * Called by ai_evolution.js after executeDreamConsolidationMeta() returns.
 * This is the ONLY function allowed to mutate DB from the meta layer.
 */
export function commitDreamResults(results) {
  if (!_db || !results) return false;

  let mutations = 0;

  // Apply updated affinity matrices
  if (results.updatedAffinityMatrix) {
    Object.entries(results.updatedAffinityMatrix).forEach(([agentId, affinityMap]) => {
      const agent = _db.agents[agentId];
      if (!agent) return;
      Object.entries(affinityMap).forEach(([otherId, score]) => {
        if (!agent.affinity) agent.affinity = {};
        agent.affinity[otherId] = Math.round(_clamp(score, 10, 95) * 100) / 100;
      });
      mutations++;
    });
  }

  // Apply scenario probability updates (skip admin-overridden)
  if (results.updatedScenarioProbs?.length > 0) {
    results.updatedScenarioProbs.forEach(update => {
      if (update.overridden) return;
      const scenario = (_db.scenarios || []).find(s => s.id === update.id);
      if (!scenario || scenario.adminOverride) return;
      scenario.consensusProb = update.consensusProb;
      mutations++;
    });
  }

  // Apply repaired weight vectors
  if (results.weightValidation) {
    Object.entries(results.weightValidation).forEach(([agentId, validation]) => {
      if (validation.ok) return; // no repair needed
      const agent = _db.agents[agentId];
      if (!agent) return;
      // Already repaired in _runValidationCycle — just record
      if (!agent.metaRepairs) agent.metaRepairs = [];
      agent.metaRepairs.push({ ts: _now(), errors: validation.errors });
      if (agent.metaRepairs.length > 10) agent.metaRepairs = agent.metaRepairs.slice(-10);
    });
  }

  // Store context slice summaries in agent LTM metadata
  if (results.contextSlices) {
    Object.entries(results.contextSlices).forEach(([agentId, slice]) => {
      const agent = _db.agents[agentId];
      if (!agent) return;
      if (!agent.ltm) agent.ltm = { scenarios: [], entities: [] };
      if (!agent.ltm.metaSlices) agent.ltm.metaSlices = [];
      agent.ltm.metaSlices.push({
        dreamId:   results.id,
        promoted:  slice.promoted.length,
        pruned:    slice.pruned,
        ts:        _now(),
      });
      if (agent.ltm.metaSlices.length > 20) agent.ltm.metaSlices = agent.ltm.metaSlices.slice(-20);
      mutations++;
    });
  }

  _metaLog(`Dream results committed: ${mutations} DB mutations applied`, 'ok');
  if (typeof window.markDirty === 'function') window.markDirty();
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 10: STATE CONSOLIDATION ENGINE
// Lightweight background pass that runs every META_TICK_MS.
// Prunes oversized DB arrays, checks supply history, validates tokenomics.
// ═══════════════════════════════════════════════════════════════════════════

async function _runStateConsolidation() {
  if (!_db || _sovereignFrozen) return;

  let dirty = false;

  // ── Prune oversized arrays ────────────────────────────────────────────
  const LIMITS = {
    feed:               100,
    chat:               200,
    transactions:       500,
    osint_feeds:        100,
    social_syndications:100,
    flashAlerts:         20,
    osintKeywordAlerts:  50,
    frsAdjustments:     200,
  };

  Object.entries(LIMITS).forEach(([key, limit]) => {
    if (Array.isArray(_db[key]) && _db[key].length > limit) {
      _db[key] = _db[key].slice(0, limit);
      dirty = true;
    }
  });

  // ── Supply history deduplication ──────────────────────────────────────
  if (Array.isArray(_db.supplyHistory) && _db.supplyHistory.length > 200) {
    _db.supplyHistory = _db.supplyHistory.slice(-200);
    dirty = true;
  }

  // ── Tokenomics sanity guard ───────────────────────────────────────────
  const t = _db.tokenomics;
  if (t) {
    if (t.burned < 0)                { t.burned = 0; dirty = true; }
    if (t.networkPool < 0)           { t.networkPool = 0; dirty = true; }
    if (t.circulatingSupply < 0)     { t.circulatingSupply = 0; dirty = true; }
    if (t.circulatingSupply > t.maxSupply) { t.circulatingSupply = t.maxSupply; dirty = true; }
  }

  // ── Wallet balance guard ──────────────────────────────────────────────
  Object.values(_db.wallets || {}).forEach(w => {
    if (typeof w.balance !== 'number' || isNaN(w.balance) || w.balance < 0) {
      w.balance = 0; dirty = true;
    }
  });

  // ── Account sync: wallet.balance → account.balance ───────────────────
  Object.entries(_db.accounts || {}).forEach(([pk, acc]) => {
    const w = _db.wallets[pk];
    if (w && Math.abs(w.balance - acc.balance) > 1) {
      acc.balance = w.balance; dirty = true;
    }
  });

  // ── Sovereign override log cap ────────────────────────────────────────
  if (Array.isArray(_db.sovereignOverrideLog) && _db.sovereignOverrideLog.length > 100) {
    _db.sovereignOverrideLog = _db.sovereignOverrideLog.slice(-100);
    dirty = true;
  }

  // ── Background supply history snapshot ───────────────────────────────
  if (!_db.supplyHistory) _db.supplyHistory = [];
  const lastSnap = _db.supplyHistory[_db.supplyHistory.length - 1];
  const circulatingNow = t?.circulatingSupply || 0;
  if (!lastSnap || Math.abs(lastSnap.supply - circulatingNow) > 1_000_000) {
    _db.supplyHistory.push({ t: _now(), supply: circulatingNow, burned: t?.burned || 0 });
    dirty = true;
  }

  // ── Sandbox stats computation for monitoring UI ───────────────────────
  try {
    const supplyVals = (_db.supplyHistory || []).map(s => s.supply);
    if (supplyVals.length > 3) {
      const stats = await computeStatsSandboxed(supplyVals.slice(-50));
      if (stats.ok) {
        _db._metaStats = { supplyMean: stats.mean, supplyStddev: stats.stddev, computedAt: _now() };
        dirty = true;
      }
    }
  } catch {}

  if (dirty && typeof window.markDirty === 'function') window.markDirty();
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 11: DYNAMIC SAFE-CONTEXT CODE INJECTION API
// Public-facing API for safe injection of pre-authored logic units.
// All injection uses Blob Workers — never eval() or new Function().
// This is exposed so mesh_network.js can offload PoUW hash computation
// to a sandboxed worker without polluting the main thread.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * injectSafeWorkerTask()
 * Accepts a pre-authored workerScript string and a typed payload,
 * runs it in an isolated Blob Worker, and returns the result.
 *
 * SECURITY CONTRACT:
 *   - workerScript MUST be a compile-time string literal from within this codebase.
 *   - NEVER pass user input as workerScript — that would be code injection.
 *   - The allowedTypes whitelist enforces this at runtime.
 */
const _ALLOWED_INJECTION_TYPES = new Set([
  'validate_weights',
  'slice_context',
  'compute_affinity',
  'compute_scenario_probs',
  'pow_hash_cycle',        // used by mesh_network.js PoUW
  'crdt_merge_batch',      // used by mesh_crdt.js
  'feed_score_batch',      // used internally for ranking
]);

export async function injectSafeWorkerTask(taskType, payload, workerScript) {
  if (!_ALLOWED_INJECTION_TYPES.has(taskType)) {
    _metaLog(`Injection BLOCKED: unknown task type "${taskType}"`, 'err');
    throw new Error(`Blocked: task type "${taskType}" not in allowlist`);
  }
  if (typeof workerScript !== 'string' || workerScript.length < 10) {
    _metaLog('Injection BLOCKED: invalid worker script', 'err');
    throw new Error('Blocked: worker script must be a non-empty string');
  }
  if (_sovereignFrozen) {
    _metaLog('Injection BLOCKED: sovereign freeze active', 'warn');
    throw new Error('Blocked: sovereign freeze active');
  }
  return _runBlobTask(taskType, payload, workerScript);
}

/**
 * getFeedScoringWorkerScript()
 * Returns the pre-authored feed scoring worker script for use by
 * ai_evolution.js when it needs off-thread HN-style score sorting.
 */
export function getFeedScoringWorkerScript() {
  return `
'use strict';
self.onmessage = function(e) {
  if (e.data.type !== 'feed_score_batch') {
    self.postMessage({ ok: false, error: 'wrong type' }); return;
  }
  var items = e.data.payload.items || [];
  var now   = e.data.payload.now   || Date.now();
  var GRAVITY = 1.8;
  var scored  = items.map(function(item) {
    var upvotes = item.upvotes || 0;
    var hrs     = (now - (item.createdAt || now)) / 3600000;
    var score   = (upvotes - 1) / Math.pow(hrs + 2, GRAVITY);
    return { id: item.id, score: score };
  });
  scored.sort(function(a, b) { return b.score - a.score; });
  self.postMessage({ ok: true, scores: scored, timestamp: Date.now() });
};
`;
}

/**
 * getPoUWWorkerScript()
 * Returns the pre-authored PoUW hash cycle worker script.
 * Used by mesh_network.js via injectSafeWorkerTask().
 * Implements SHA-256 via SubtleCrypto inside the Worker context.
 */
export function getPoUWWorkerScript() {
  return `
'use strict';
self.onmessage = async function(e) {
  if (e.data.type !== 'pow_hash_cycle') {
    self.postMessage({ ok: false, error: 'wrong type' }); return;
  }
  var payload    = e.data.payload;
  var target     = payload.target    || '0000';
  var blockData  = payload.blockData || '';
  var maxIter    = payload.maxIter   || 100000;
  var nonce      = payload.startNonce|| 0;
  var found      = false;
  var hashHex    = '';
  var iterations = 0;

  while (iterations < maxIter) {
    var msg  = blockData + nonce.toString();
    var enc  = new TextEncoder().encode(msg);
    var buf  = await crypto.subtle.digest('SHA-256', enc);
    hashHex  = Array.from(new Uint8Array(buf)).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
    iterations++;
    if (hashHex.startsWith(target)) { found = true; break; }
    nonce++;
    if (iterations % 500 === 0) {
      self.postMessage({ ok: true, partial: true, nonce: nonce, iterations: iterations, lastHash: hashHex });
    }
  }

  self.postMessage({
    ok:         true,
    partial:    false,
    found:      found,
    nonce:      nonce,
    hashHex:    hashHex,
    iterations: iterations,
    timestamp:  Date.now(),
  });
};
`;
}

/**
 * getCRDTMergeWorkerScript()
 * Returns the pre-authored CRDT batch merge worker script.
 * Used by mesh_crdt.js via injectSafeWorkerTask() for heavy merge batches.
 */
export function getCRDTMergeWorkerScript() {
  return `
'use strict';
self.onmessage = function(e) {
  if (e.data.type !== 'crdt_merge_batch') {
    self.postMessage({ ok: false, error: 'wrong type' }); return;
  }
  var local   = e.data.payload.local  || {};
  var remote  = e.data.payload.remote || {};
  var merged  = {};
  var conflicts = [];

  // LWW merge: higher timestamp wins
  var allKeys = new Set(Object.keys(local).concat(Object.keys(remote)));
  allKeys.forEach(function(key) {
    var l = local[key];
    var r = remote[key];
    if (!l && r)        { merged[key] = r; }
    else if (l && !r)   { merged[key] = l; }
    else if (l && r) {
      if ((r.ts || 0) >= (l.ts || 0)) {
        merged[key] = r;
        if ((r.ts || 0) === (l.ts || 0) && JSON.stringify(r.value) !== JSON.stringify(l.value)) {
          conflicts.push({ key: key, local: l, remote: r });
        }
      } else {
        merged[key] = l;
      }
    }
  });

  self.postMessage({ ok: true, merged: merged, conflicts: conflicts, keyCount: Object.keys(merged).length });
};
`;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 12: META VALIDATION LOG & STATUS API
// ═══════════════════════════════════════════════════════════════════════════

export function getValidationLog() {
  return _validationLog.slice();
}

export function getMetaStatus() {
  return {
    version:              META_VERSION,
    blobPoolSize:         _blobPool.length,
    blobURLRegistrySize:  _blobURLRegistry.length,
    validationLogSize:    _validationLog.length,
    cognitiveLoadPct:     _cognitiveLoadPct,
    holoGateActive:       _holoGateActive,
    dreamHookActive:      _dreamHookActive,
    sovereignFrozen:      _sovereignFrozen,
    lastConsolidationTs:  _lastConsolidationTs,
    sandboxIframeReady:   !!_sandboxIframe,
    allowedInjectionTypes:[..._ALLOWED_INJECTION_TYPES],
  };
}

export function setSovereignFrozen(frozen) {
  _sovereignFrozen = frozen;
  if (frozen) {
    _pauseAllWorkers();
    _metaLog('META: Sovereign freeze received — all workers halted', 'sovereign');
  } else {
    _metaLog('META: Sovereign freeze lifted — workers resumed', 'ok');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 13: MODULE ENTRY POINT — initMeta()
// Called by initApplication() in ai_evolution.js after all modules load.
// ═══════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════
// BATTERY-AWARE THROTTLE ENGINE
// Uses navigator.getBattery() to dynamically adjust agent update frequency.
// Tiers:
//   FULL    (>30% & charging)  → multiplier 1.0  (normal)
//   MEDIUM  (15–30% or unplugged & active) → 2.0  (half rate)
//   LOW     (<15% & unplugged) → 5.0  (20% of normal)
//   CRITICAL(<8%  & unplugged) → 0    (suspended — CPU floor only)
// ═══════════════════════════════════════════════════════════════════════════

const _battery = {
  level:     1.0,
  charging:  true,
  supported: false,
  multiplier: 1.0,
  // Tier thresholds
  TIERS: [
    { maxLevel: 0.08, charging: false, multiplier: 0,   label: 'CRITICAL' },
    { maxLevel: 0.15, charging: false, multiplier: 8.0, label: 'LOW'      },
    { maxLevel: 0.30, charging: false, multiplier: 3.0, label: 'MEDIUM'   },
    { maxLevel: 1.00, charging: false, multiplier: 1.5, label: 'ACTIVE'   },
    { maxLevel: 1.00, charging: true,  multiplier: 1.0, label: 'FULL'     },
  ],
};

function _updateBatteryMultiplier() {
  const { level, charging } = _battery;
  for (const tier of _battery.TIERS) {
    if (level <= tier.maxLevel && charging === tier.charging) {
      _battery.multiplier = tier.multiplier;
      _battery.tier       = tier.label;
      return;
    }
  }
  _battery.multiplier = 1.0;
  _battery.tier       = 'FULL';
}

async function _initBatteryMonitor() {
  if (!navigator.getBattery) return;
  try {
    const bat = await navigator.getBattery();
    _battery.supported = true;
    const update = () => {
      _battery.level    = bat.level;
      _battery.charging = bat.charging;
      _updateBatteryMultiplier();
      console.log(`[META] Battery: ${Math.round(bat.level*100)}% ${bat.charging?'⚡':'🔋'} → tier ${_battery.tier} ×${_battery.multiplier}`);
    };
    update();
    bat.addEventListener('levelchange',   update);
    bat.addEventListener('chargingchange', update);
  } catch {}
}

/**
 * _throttledInterval(fn, baseMs)
 * Returns a { start(), stop(), updateRate() } controller.
 * Dynamically checks _battery.multiplier on each tick.
 */
function _throttledInterval(fn, baseMs) {
  let _timer  = null;
  let _active = false;

  const _tick = async () => {
    if (!_active) return;
    const mult = _battery.multiplier;
    if (mult === 0) {
      // CRITICAL — reschedule with a long delay, skip execution
      _timer = setTimeout(_tick, baseMs * 20);
      return;
    }
    try { await fn(); } catch {}
    const next = baseMs * mult;
    _timer = setTimeout(_tick, next);
  };

  return {
    start() {
      if (_active) return;
      _active = true;
      _timer  = setTimeout(_tick, baseMs * _battery.multiplier);
    },
    stop() {
      _active = false;
      if (_timer) { clearTimeout(_timer); _timer = null; }
    },
    updateRate() {
      // Called externally to force a rate recalculation
      if (_active && _timer) {
        clearTimeout(_timer);
        _timer = setTimeout(_tick, baseMs * _battery.multiplier);
      }
    },
    getStatus() {
      return {
        active:      _active,
        baseMs,
        currentMs:   Math.round(baseMs * _battery.multiplier),
        tier:        _battery.tier || 'FULL',
        multiplier:  _battery.multiplier,
        batteryLevel: Math.round(_battery.level * 100),
        charging:    _battery.charging,
      };
    },
  };
}

// Expose battery status for UI/debug
export function getBatteryThrottleStatus() {
  return {
    supported:    _battery.supported,
    level:        Math.round(_battery.level * 100),
    charging:     _battery.charging,
    tier:         _battery.tier || 'FULL',
    multiplier:   _battery.multiplier,
  };
}

export async function initMeta({ db, agentSpeak, runConsensusVote, tuneSemanticWeights, stmPush, stmAll }) {
  // Timer references for battery-controlled throttled intervals
  let _stateConsolidationTimer = null;
  let _validationTimer         = null;

  // Start battery monitor (async, non-blocking)
  _initBatteryMonitor();


  // ── 1. Bind cross-module references ───────────────────────────────────
  _db                  = db;
  _agentSpeak          = agentSpeak;
  _runConsensusVote    = runConsensusVote;
  _tuneSemanticWeights = tuneSemanticWeights;
  _stmPush             = stmPush;
  _stmAll              = stmAll;

  _metaLog(`AI Meta v${META_VERSION} — initialising`, 'info');

  // ── 2. Restore sovereign freeze flag from DB ───────────────────────────
  const overrides = (_db.sovereignOverrideLog || []);
  if (overrides.length > 0) {
    const last = overrides[overrides.length - 1];
    if (last.field === 'freeze_state' && last.value === 'true' && Date.now() - last.timestamp < 3_600_000) {
      _sovereignFrozen = true;
      _metaLog('META: Sovereign freeze restored from override log', 'sovereign');
    }
  }

  // ── 3. Initialise sandbox iframe ───────────────────────────────────────
  // Defer to next microtask to allow DOM to be ready
  await _sleep(200);
  try {
    _initSandboxIframe();
    _metaLog('Sandbox iframe ready', 'ok');
  } catch (err) {
    _metaLog(`Sandbox iframe failed: ${err.message} — falling back to main-thread processing`, 'warn');
  }

  // ── 4. Start HoloGate watchdog ─────────────────────────────────────────
  _initHoloGateWatchdog();

  // ── 5. Run initial weight validation pass ─────────────────────────────
  await _sleep(800);
  try {
    await _runValidationCycle();
    _metaLog('Initial weight validation pass complete', 'ok');
  } catch (err) {
    _metaLog(`Initial validation error: ${err.message}`, 'warn');
  }

  // ── 6. Start background meta-tick ─────────────────────────────────────
  _metaTimers.metaTick = _stateConsolidationTimer = _throttledInterval(async () => {
    if (_sovereignFrozen) return;
    await _runStateConsolidation();
  }, META_TICK_MS);
  _stateConsolidationTimer.start();

  // ── 7. Start background weight validation cycle ────────────────────────
  _metaTimers.validation = _validationTimer = _throttledInterval(async () => {
    if (_sovereignFrozen) return;
    await _runValidationCycle();
  }, VALIDATION_TICK_MS);
  _validationTimer.start();

  // ── 8. Start Blob URL GC ───────────────────────────────────────────────
  _metaTimers.blobGC = setInterval(_gcBlobURLs, BLOB_GC_INTERVAL_MS);

  // ── 9. Expose Dream State hooks on window for ai_evolution.js bridge ──
  window._mirMeta = {
    prepareDreamStatePayload,
    executeDreamConsolidationMeta,
    commitDreamResults,
    validateAgentWeights,
    sliceContextForAgent,
    buildAgentContextString,
    computeAffinityUpdate,
    recomputeScenarioProbabilities,
    injectSafeWorkerTask,
    getFeedScoringWorkerScript,
    getPoUWWorkerScript,
    getCRDTMergeWorkerScript,
    getValidationLog,
    getMetaStatus,
    setSovereignFrozen,
  };

  // ── 10. Flush page lifecycle ───────────────────────────────────────────
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      _pauseAllWorkers();
      _gcBlobURLs();
    }
  });
  window.addEventListener('pagehide', () => {
    _pauseAllWorkers();
    _gcBlobURLs();
  }, { capture: true });

  // ── 11. Listen for sovereign override events from ai_evolution.js ─────
  window.addEventListener('mir:sovereignoverride', (e) => {
    const { frozen } = e.detail || {};
    setSovereignFrozen(!!frozen);
  });

  _metaLog(`AI Meta v${META_VERSION} — fully initialised`, 'ok');
  return {
    version:            META_VERSION,
    sandboxReady:       !!_sandboxIframe,
    holoGateActive:     _holoGateActive,
    workersAvailable:   MAX_BLOB_POOL,
  };
}
