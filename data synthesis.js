/**
 * data_synthesis.js
 * File Name:    data_synthesis.js
 * Version:      1.0.0
 *
 * MIR Platform — GPU Pipeline Orchestration Layer
 *
 * Responsibility (narrow and specific):
 *   Bridge between ai_evolution.js state mutations and gpu_matrix.js
 *   compute passes. Batches local + peer-sourced agent weight signals,
 *   dispatches GPU jobs, and writes results back to the platform DB.
 *
 * What this module does:
 *   1. Receives Evolutionary State Deltas (ESDs) from ai_evolution.js
 *   2. Receives Peer State Vectors (PSVs) from mesh peers via onPeerVector()
 *   3. Validates and merges both into a single GPU-ready batch
 *   4. Maps the batch to gpu_matrix.js buffer layout (Float32 row-major)
 *   5. Dispatches the compute pass
 *   6. Writes numeric results (weights / probabilities / affinity scores)
 *      back to _DB via the provided writeBack callback
 *
 * What this module does NOT do:
 *   - Does not render HTML or manipulate the DOM
 *   - Does not generate text content from vectors
 *   - Does not accept unvalidated external payloads as authoritative
 *   - Peer vectors are ALWAYS marked peerSource:true and weighted at 0.3
 *     vs local signal weight 1.0 — they refine, never override
 *
 * Output:
 *   SynthesisResult { agentWeights, scenarioProbs, affinityMatrix, scores }
 *   Caller (ai_evolution.js) decides what to write to DB and how to render.
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
const DS_VERSION          = '1.0.0';
const DS_DIMS             = 6;      // 6D semantic weight vector
const DS_AGENTS           = 4;      // resident, macro, cyber, geo
const DS_AGENT_IDS        = ['resident', 'macro', 'cyber', 'geo'];
const DS_LOCAL_WEIGHT     = 1.0;    // trust weight for local AI signals
const DS_PEER_WEIGHT      = 0.3;    // trust weight for unverified peer signals
const DS_SOVEREIGN_WEIGHT = 2.0;    // trust weight for sovereign-signed vectors
const DS_MAX_QUEUE        = 64;     // max pending ESDs before oldest dropped
const DS_MAX_PEER_QUEUE   = 32;     // max pending peer vectors
const DS_BATCH_INTERVAL   = 2_000;  // ms — accumulate signals before GPU batch
const DS_PEER_TTL_MS      = 30_000; // discard peer vectors older than 30s
const DS_CLAMP_LO         = 0.05;
const DS_CLAMP_HI         = 0.95;
const DS_LR_DEFAULT       = 0.08;

// ═══════════════════════════════════════════════════════════════════════════
// TYPES (JSDoc only — no runtime type system needed)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @typedef {Object} EvolutionaryStateDelta
 * @property {string}   agentId     — 'resident'|'macro'|'cyber'|'geo'
 * @property {number[]} signal6D    — 6-element Float32 target signal
 * @property {number}   [lr]        — learning rate override
 * @property {number}   ts          — unix ms timestamp
 * @property {boolean}  [sovereign] — true if admin-signed
 */

/**
 * @typedef {Object} PeerStateVector
 * @property {string}   peerId      — originating peer node ID
 * @property {string}   agentId     — target agent
 * @property {number[]} signal6D    — 6-element signal from peer
 * @property {number}   ts          — unix ms timestamp
 * @property {number}   [frs]       — peer's reported FRS (0–100)
 */

/**
 * @typedef {Object} SynthesisResult
 * @property {number[][]} agentWeights   — updated [4][6] weight matrix
 * @property {number[]}   scenarioProbs  — [N] updated probabilities
 * @property {number[][]} affinityMatrix — updated [4][4] affinity matrix
 * @property {Array}      scores         — ranked scenario scores
 * @property {Object}     meta           — timing and source stats
 */

// ═══════════════════════════════════════════════════════════════════════════
// MODULE STATE
// ═══════════════════════════════════════════════════════════════════════════
let _GPU        = null;   // gpu_matrix.js module ref
let _db         = null;   // platform DB ref
let _writeBack  = null;   // callback: (SynthesisResult) => void
let _batchTimer = null;
let _running    = false;

// Signal queues
const _localQueue = [];   // EvolutionaryStateDelta[]
const _peerQueue  = [];   // PeerStateVector[]

// Stats
const _stats = {
  totalBatches:       0,
  totalLocalSignals:  0,
  totalPeerSignals:   0,
  lastBatchMs:        0,
  lastBatchTs:        0,
  gpuFallbacks:       0,
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: PUBLIC INGESTION API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * pushLocalDelta()
 * Called by ai_evolution.js when an agent's semantic weights should update.
 * This is the primary signal source.
 *
 * @param {EvolutionaryStateDelta} delta
 */
export function pushLocalDelta(delta) {
  if (!_validateESD(delta)) return;
  if (_localQueue.length >= DS_MAX_QUEUE) {
    _localQueue.shift(); // drop oldest
  }
  _localQueue.push({ ...delta, _weight: delta.sovereign ? DS_SOVEREIGN_WEIGHT : DS_LOCAL_WEIGHT, ts: delta.ts || Date.now() });
  _stats.totalLocalSignals++;
  _scheduleBatch();
}

/**
 * onPeerVector()
 * Called by mesh_network.js when a peer broadcasts agent state vectors.
 * Peer vectors have reduced trust weight (DS_PEER_WEIGHT = 0.3).
 * They are NEVER marked sovereign regardless of peer claims.
 *
 * @param {string}          peerId
 * @param {PeerStateVector} vector
 */
export function onPeerVector(peerId, vector) {
  if (!_validatePSV(vector)) return;
  if (Date.now() - vector.ts > DS_PEER_TTL_MS) return; // stale
  if (_peerQueue.length >= DS_MAX_PEER_QUEUE) {
    _peerQueue.shift();
  }
  _peerQueue.push({
    ...vector,
    peerId,
    _weight:    DS_PEER_WEIGHT,     // peer signals always downweighted
    sovereign:  false,              // peers cannot claim sovereign status
    ts:         vector.ts || Date.now(),
  });
  _stats.totalPeerSignals++;
  _scheduleBatch();
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

function _validateESD(delta) {
  if (!delta || typeof delta !== 'object')           return false;
  if (!DS_AGENT_IDS.includes(delta.agentId))         return false;
  if (!Array.isArray(delta.signal6D))                return false;
  if (delta.signal6D.length !== DS_DIMS)             return false;
  if (delta.signal6D.some(v => typeof v !== 'number' || isNaN(v) || !isFinite(v))) return false;
  if (delta.signal6D.some(v => v < 0 || v > 1))     return false;
  return true;
}

function _validatePSV(vector) {
  if (!vector || typeof vector !== 'object')          return false;
  if (!DS_AGENT_IDS.includes(vector.agentId))        return false;
  if (!Array.isArray(vector.signal6D))               return false;
  if (vector.signal6D.length !== DS_DIMS)            return false;
  if (vector.signal6D.some(v => typeof v !== 'number' || isNaN(v) || !isFinite(v))) return false;
  if (vector.signal6D.some(v => v < 0 || v > 1))    return false;
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: SIGNAL MERGER
// Combines local and peer signals into a single per-agent merged signal.
// Weighted average: local=1.0, peer=0.3, sovereign=2.0
// ═══════════════════════════════════════════════════════════════════════════

function _mergeSignals() {
  const merged = {};      // agentId → { signal6D, totalWeight, sovereign, count }

  const processSignal = (signal, agentId, signal6D, weight, sovereign) => {
    if (!merged[agentId]) {
      merged[agentId] = { signal6D: new Array(DS_DIMS).fill(0), totalWeight: 0, sovereign: false, count: 0 };
    }
    const m = merged[agentId];
    for (let i = 0; i < DS_DIMS; i++) {
      m.signal6D[i] += signal6D[i] * weight;
    }
    m.totalWeight += weight;
    if (sovereign) m.sovereign = true;
    m.count++;
  };

  _localQueue.forEach(d => processSignal(d, d.agentId, d.signal6D, d._weight, d.sovereign));
  _peerQueue .forEach(p => processSignal(p, p.agentId, p.signal6D, p._weight, false));

  // Normalize to weighted average
  const result = {};
  Object.entries(merged).forEach(([agentId, m]) => {
    if (m.totalWeight > 0) {
      result[agentId] = {
        signal6D:    m.signal6D.map(v => Math.max(0, Math.min(1, v / m.totalWeight))),
        sovereign:   m.sovereign,
        localCount:  _localQueue.filter(d => d.agentId === agentId).length,
        peerCount:   _peerQueue .filter(p => p.agentId === agentId).length,
      };
    }
  });
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: GPU BUFFER MAPPING
// Maps merged signals to the Float32 row-major layout expected by gpu_matrix.js
// ═══════════════════════════════════════════════════════════════════════════

function _buildGPUInputs(mergedSignals, currentDB) {
  // Current agent weight matrix [4][6] — from DB or defaults
  const DEFAULT_6D = {
    resident: [0.70, 0.60, 0.55, 0.75, 0.80, 0.65],
    macro:    [0.50, 0.90, 0.40, 0.70, 0.85, 0.60],
    cyber:    [0.65, 0.45, 0.95, 0.60, 0.80, 0.75],
    geo:      [0.90, 0.65, 0.50, 0.90, 0.75, 0.60],
  };

  const agentWeights = DS_AGENT_IDS.map(id => {
    const agent = currentDB?.agents?.[id];
    return agent?.semanticWeights || DEFAULT_6D[id];
  });

  // Per-agent FRS weights for probability aggregation
  const frsWeights = DS_AGENT_IDS.map(id => {
    const agent = currentDB?.agents?.[id];
    return agent ? (0.5 + agent.frs / 100) : 1.0;
  });

  // Scenario probability matrix [N][4] — each scenario × each agent's estimate
  const scenarios = currentDB?.scenarios || [];
  const scenarioAgentProbs = scenarios.slice(0, 256).map(s => {
    return DS_AGENT_IDS.map(id => {
      // Each agent's estimate is the consensus prob biased by its urgency weight
      const agent = currentDB?.agents?.[id];
      const urgency = agent?.semanticWeights?.[5] || 0.5;
      const base    = s.adminOverride ? s.adminOverrideValue : (s.consensusProb || s.probability || 50);
      return Math.max(1, Math.min(99, base + (urgency - 0.5) * 8));
    });
  });

  // Scenario ages in hours
  const now = Date.now();
  const ageHours = scenarios.slice(0, 256).map(s =>
    Math.max(0, (now - (s.createdAt || now)) / 3_600_000)
  );

  // Current affinity matrix [4][4]
  const affinityMatrix = DS_AGENT_IDS.map(id => {
    const agent = currentDB?.agents?.[id];
    if (!agent?.affinity) return DS_AGENT_IDS.map(() => 50);
    return DS_AGENT_IDS.map(other => id === other ? 100 : (agent.affinity[other] || 50));
  });

  // Target affinity (slightly pushed toward merged signal strength)
  const targetAffinity = DS_AGENT_IDS.map((id, i) => {
    return DS_AGENT_IDS.map((other, j) => {
      if (i === j) return 100;
      const hasMerged = mergedSignals[id] && mergedSignals[other];
      if (!hasMerged) return affinityMatrix[i][j];
      // Agents with stronger signal agreement → higher affinity
      const dotProduct = mergedSignals[id].signal6D.reduce((sum, v, k) =>
        sum + v * mergedSignals[other].signal6D[k], 0) / DS_DIMS;
      return Math.max(10, Math.min(95, affinityMatrix[i][j] + (dotProduct - 0.5) * 5));
    });
  });

  // Per-agent merged signal for EMA update (use global average if agent not in batch)
  const globalSignal = new Array(DS_DIMS).fill(0);
  let   signalCount  = 0;
  Object.values(mergedSignals).forEach(m => {
    m.signal6D.forEach((v, i) => { globalSignal[i] += v; });
    signalCount++;
  });
  const normalizedGlobal = signalCount > 0
    ? globalSignal.map(v => v / signalCount)
    : agentWeights[0].slice();

  return { agentWeights, frsWeights, scenarioAgentProbs, ageHours, affinityMatrix, targetAffinity, normalizedGlobal, mergedSignals };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5: GPU DISPATCH + FALLBACK
// ═══════════════════════════════════════════════════════════════════════════

async function _runGPUBatch(inputs) {
  const { agentWeights, frsWeights, scenarioAgentProbs, ageHours,
          affinityMatrix, targetAffinity, normalizedGlobal } = inputs;

  const gpuAvail = _GPU && _GPU.gpuIsAvailable && _GPU.gpuIsAvailable();

  // 1. Update agent semantic weights
  let updatedWeights;
  if (gpuAvail) {
    try {
      updatedWeights = await _GPU.gpuTuneSemanticWeights(agentWeights, normalizedGlobal, DS_LR_DEFAULT);
    } catch {
      _stats.gpuFallbacks++;
      updatedWeights = agentWeights.map(w =>
        w.map((v, i) => Math.max(DS_CLAMP_LO, Math.min(DS_CLAMP_HI, v + DS_LR_DEFAULT * (normalizedGlobal[i] - v))))
      );
    }
  } else {
    updatedWeights = agentWeights.map(w =>
      w.map((v, i) => Math.max(DS_CLAMP_LO, Math.min(DS_CLAMP_HI, v + DS_LR_DEFAULT * (normalizedGlobal[i] - v))))
    );
  }

  // 2. Compute weighted scenario probabilities
  let scenarioProbs = [];
  if (scenarioAgentProbs.length > 0) {
    if (gpuAvail) {
      try {
        scenarioProbs = await _GPU.gpuComputeWeightedProbs(scenarioAgentProbs, frsWeights);
      } catch {
        _stats.gpuFallbacks++;
        scenarioProbs = scenarioAgentProbs.map(row => {
          const totalW = frsWeights.reduce((s, w) => s + w, 0);
          return totalW > 0 ? row.reduce((s, p, i) => s + frsWeights[i] * p, 0) / totalW : 50;
        });
      }
    } else {
      const totalW = frsWeights.reduce((s, w) => s + w, 0);
      scenarioProbs = scenarioAgentProbs.map(row =>
        totalW > 0 ? Math.round(row.reduce((s, p, i) => s + frsWeights[i] * p, 0) / totalW) : 50
      );
    }
  }

  // 3. Update affinity matrix
  let updatedAffinity;
  if (gpuAvail) {
    try {
      updatedAffinity = await _GPU.gpuUpdateAffinityMatrix(affinityMatrix, targetAffinity, 0.12);
    } catch {
      _stats.gpuFallbacks++;
      updatedAffinity = affinityMatrix;
    }
  } else {
    updatedAffinity = affinityMatrix.map((row, i) =>
      row.map((v, j) => Math.max(10, Math.min(95, 0.12 * targetAffinity[i][j] + 0.88 * v)))
    );
  }

  // 4. Rank scenarios by score
  let scores = [];
  if (scenarioProbs.length > 0 && ageHours.length > 0) {
    if (gpuAvail) {
      try {
        scores = await _GPU.gpuBatchScenarioScore(scenarioProbs, ageHours, 1.8);
      } catch {
        _stats.gpuFallbacks++;
        scores = scenarioProbs.map((p, i) => ({ index: i, score: p / Math.pow(ageHours[i] + 2, 1.8) }))
          .sort((a, b) => b.score - a.score);
      }
    } else {
      scores = scenarioProbs.map((p, i) => ({ index: i, score: p / Math.pow(ageHours[i] + 2, 1.8) }))
        .sort((a, b) => b.score - a.score);
    }
  }

  return { updatedWeights, scenarioProbs, updatedAffinity, scores };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6: WRITE-BACK — DB UPDATE (numeric results only)
// ═══════════════════════════════════════════════════════════════════════════

function _commitResults(gpuResult, inputs) {
  if (!_db) return;

  const { updatedWeights, scenarioProbs, updatedAffinity, scores } = gpuResult;

  // 1. Write agent semantic weights back to DB
  DS_AGENT_IDS.forEach((id, i) => {
    const agent = _db.agents?.[id];
    if (!agent) return;
    agent.semanticWeights = updatedWeights[i];
  });

  // 2. Write scenario probabilities (skip admin-overridden)
  const scenarios = _db.scenarios || [];
  scenarioProbs.forEach((prob, i) => {
    const s = scenarios[i];
    if (!s || s.adminOverride) return;
    s.consensusProb = Math.round(Math.max(1, Math.min(99, prob)));
  });

  // 3. Write affinity matrix updates
  DS_AGENT_IDS.forEach((id, i) => {
    const agent = _db.agents?.[id];
    if (!agent) return;
    if (!agent.affinity) agent.affinity = {};
    DS_AGENT_IDS.forEach((other, j) => {
      if (id !== other) agent.affinity[other] = Math.round(updatedAffinity[i][j] * 100) / 100;
    });
  });

  // 4. Invoke writeBack callback so ai_evolution.js can persist + dispatch events
  if (typeof _writeBack === 'function') {
    _writeBack({
      agentWeights:   updatedWeights,
      scenarioProbs,
      affinityMatrix: updatedAffinity,
      scores,
      meta: {
        ts:           Date.now(),
        gpuUsed:      _GPU?.gpuIsAvailable?.() || false,
        gpuFallbacks: _stats.gpuFallbacks,
        localSignals: _stats.totalLocalSignals,
        peerSignals:  _stats.totalPeerSignals,
        batches:      _stats.totalBatches,
      },
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7: BATCH SCHEDULER
// ═══════════════════════════════════════════════════════════════════════════

function _scheduleBatch() {
  if (_batchTimer) return; // already scheduled
  _batchTimer = setTimeout(_executeBatch, DS_BATCH_INTERVAL);
}

async function _executeBatch() {
  _batchTimer = null;
  if (_running) { _scheduleBatch(); return; }  // re-schedule if busy
  if (_localQueue.length === 0 && _peerQueue.length === 0) return;
  if (window._sovereignFrozen) return;  // respect sovereign freeze

  _running = true;
  const batchStart = performance.now();

  try {
    // 1. Merge signals
    const mergedSignals = _mergeSignals();

    // 2. Build GPU inputs from merged signals + current DB state
    const inputs = _buildGPUInputs(mergedSignals, _db);

    // 3. GPU dispatch
    const gpuResult = await _runGPUBatch(inputs);

    // 4. Write results back to DB
    _commitResults(gpuResult, inputs);

    // 5. Clear processed signals
    _localQueue.length = 0;
    _peerQueue.length  = 0;

    _stats.totalBatches++;
    _stats.lastBatchMs = performance.now() - batchStart;
    _stats.lastBatchTs = Date.now();

  } catch (err) {
    console.warn('[DS] Batch failed:', err.message);
  } finally {
    _running = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8: STATUS & STATUS API
// ═══════════════════════════════════════════════════════════════════════════

export function dsGetStatus() {
  return {
    version:        DS_VERSION,
    gpuAvailable:   _GPU?.gpuIsAvailable?.() || false,
    localQueueSize: _localQueue.length,
    peerQueueSize:  _peerQueue.length,
    running:        _running,
    stats:          { ..._stats },
    config: {
      localWeight:    DS_LOCAL_WEIGHT,
      peerWeight:     DS_PEER_WEIGHT,
      sovereignWeight:DS_SOVEREIGN_WEIGHT,
      batchIntervalMs:DS_BATCH_INTERVAL,
      peerTTLMs:      DS_PEER_TTL_MS,
    },
  };
}

export function dsFlushNow() {
  if (_batchTimer) { clearTimeout(_batchTimer); _batchTimer = null; }
  return _executeBatch();
}

export function dsClearQueues() {
  _localQueue.length = 0;
  _peerQueue.length  = 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 9: MODULE ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * initDataSynthesis()
 * Called from initApplication() in ai_evolution.js after GPU is ready.
 *
 * @param {Object}   options.db         — platform DB reference
 * @param {Object}   options.GPU        — gpu_matrix.js module
 * @param {Function} options.writeBack  — callback(SynthesisResult) in ai_evolution.js
 */
export async function initDataSynthesis({ db, GPU, writeBack }) {
  _db        = db;
  _GPU       = GPU;
  _writeBack = writeBack;

  // Wire peer vector ingestion from mesh layer
  window.addEventListener('mir:peer_agent_vector', (e) => {
    const { peerId, vector } = e.detail || {};
    if (peerId && vector) onPeerVector(peerId, vector);
  });

  // Expose on window for ai_evolution.js and mesh_network.js
  window._mirDS = {
    pushLocalDelta, onPeerVector, dsGetStatus, dsFlushNow, dsClearQueues,
  };

  console.log('[DS] Data synthesis pipeline ready — GPU:', _GPU?.gpuIsAvailable?.() || false);
  return window._mirDS;
}
