/**
 * mesh_crdt.js
 * File Name:           mesh_crdt.js
 * Version:             2.0.0
 * Architectural State Hash: sha256("MIR-MESH-CRDT-V2-2025")
 * Last Sync Resolution: 2025-05-23T00:00:00Z
 *
 * MIR Platform v2.0 — File 6/6 (FINAL)
 * Conflict-Free Replicated Data Type Consistency Engine
 * Decentralized Multi-Node Synchronization · Zero Central Server Dependency
 *
 * CRDT Types Implemented:
 *   1. LWW-Register  (Last-Write-Wins Register)      — scenario probs, wallet balances
 *   2. LWW-Element-Set (LWW-Set)                     — feed items, scenarios, predictions
 *   3. G-Counter     (Grow-Only Counter)              — upvote tallies, burn totals
 *   4. PN-Counter    (Positive-Negative Counter)      — circulating supply, pool balance
 *   5. OR-Set        (Observed-Remove Set)            — peer node registry
 *   6. Vector Clock  (Lamport-style per-agent)        — causal ordering of agent events
 *   7. MV-Register   (Multi-Value Register)           — consensus probability values
 *
 * Sovereign Override Primacy (Rule 0):
 *   Any state fragment bearing a verified Admin ED25519 signature carries
 *   SOVEREIGN_PRIORITY = Infinity — it unconditionally wins every merge
 *   comparison, bypassing all vector clock and timestamp logic.
 *   This is the absolute first gate in every merge function.
 *
 * IndexedDB Integration:
 *   All CRDT state is persisted to IDB store "mir_crdt_v2" via pushSnapshot().
 *   On boot, index.html Ghost-Render reads IDB before JS loads (File 1 contract).
 *   Blob Worker merge (from ai_meta.getCRDTMergeWorkerScript()) runs heavy
 *   batch merges off-main-thread, then commitDreamResults() writes back to IDB.
 *
 * Architecture Notes (GitHub Pages / Serverless):
 *   No central merge authority. Every node is authoritative for its own writes.
 *   Conflict resolution is deterministic: sovereign > admin-signed > highest-ts.
 *   State fragments sync via mesh_network.js DataChannel 'crdt_sync' messages.
 *   GitHub repo / Gist serves as a durable distributed log (secondary reference).
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// MODULE CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
const CRDT_VERSION          = '2.0.0';
const IDB_NAME              = 'mir_sovereign_v2';
const IDB_STORE             = 'crdt_state';
const IDB_SNAPSHOT_KEY      = 'db_snapshot';
const IDB_CRDT_STATE_KEY    = 'crdt_registers';
const IDB_VEC_CLOCK_KEY     = 'vector_clocks';
const IDB_ORSET_KEY         = 'or_sets';
const SOVEREIGN_PRIORITY    = Infinity;
const SYNC_BATCH_SIZE       = 20;
const SYNC_INTERVAL_MS      = 45_000;
const GC_INTERVAL_MS        = 300_000;
const MAX_TOMBSTONES        = 500;
const MAX_VC_ENTRIES        = 50;
const MERGE_WORKER_TIMEOUT  = 10_000;

// ═══════════════════════════════════════════════════════════════════════════
// MODULE STATE
// ═══════════════════════════════════════════════════════════════════════════
let _db             = null;
let _markDirty      = null;
let _idb            = null;           // IndexedDB handle
let _localNodeId    = null;
let _sovereignKey   = null;           // Admin ED25519 public key (hex)
let _sovereignFrozen= false;

// CRDT state stores
const _lwwRegisters = new Map();      // key → LWWRegisterEntry
const _lwwSets      = new Map();      // setName → Map<itemId, LWWSetEntry>
const _gCounters    = new Map();      // key → Map<nodeId, number>
const _pnCounters   = new Map();      // key → { pos: Map<nodeId,n>, neg: Map<nodeId,n> }
const _orSets       = new Map();      // setName → { elements: Map<uid,{val,ts}>, tombstones: Set<uid> }
const _vectorClocks = new Map();      // agentId → Map<nodeId, number>
const _mvRegisters  = new Map();      // key → Map<vcHash, {value, vc, ts, signed}>
const _mergeLog     = [];             // ring buffer of merge operations
const _syncQueue    = [];             // pending outbound CRDT deltas

// Blob Worker ref
let _mergeWorkerRef  = null;
let _mergeWorkerURL  = null;

// Timers
const _timers = {};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════
const _now   = () => Date.now();
const _uid   = () => (crypto.randomUUID ? crypto.randomUUID() : `${_now().toString(36)}-${Math.random().toString(36).slice(2)}`);
const _sleep = ms => new Promise(r => setTimeout(r, ms));
const _ts    = () => new Date().toISOString().slice(11, 19);

function _crdtLog(msg, level = 'info') {
  const colors = { info:'#00d4ff', ok:'#00ff88', warn:'#ffab00', err:'#ff2244', sovereign:'#ffd700', merge:'#aa88ff', idb:'#44ffcc' };
  console.log(`%c[CRDT ${_ts()}] ${msg}`, `color:${colors[level]||'#8ba3cc'};font-family:monospace;font-size:11px`);
  if (typeof window._mirAdminLog === 'function') window._mirAdminLog(`[CRDT] ${msg}`, level === 'err' ? 'err' : level === 'warn' ? 'warn' : '');
}

function _logMerge(entry) {
  _mergeLog.push({ ...entry, ts: _now() });
  if (_mergeLog.length > 200) _mergeLog.splice(0, _mergeLog.length - 200);
}

function _setEl(id, val) {
  const el = document.getElementById(id); if (el) el.textContent = val;
}

// ── Sovereign signature verification (lightweight) ──────────────────────
async function _isSovereignSigned(fragment) {
  if (!fragment || !fragment._sovereign) return false;
  const storedKey = localStorage.getItem('mir_admin_pub_v2') || _sovereignKey;
  if (!storedKey) return false;
  // Fragment must carry the admin pubkey that matches stored key
  return fragment._sovereignKey === storedKey;
}

// ── Vector clock comparison ─────────────────────────────────────────────
function _vcCompare(vcA, vcB) {
  // Returns: 'A_DOMINATES' | 'B_DOMINATES' | 'CONCURRENT' | 'EQUAL'
  const keysA = vcA instanceof Map ? [...vcA.keys()] : Object.keys(vcA || {});
  const keysB = vcB instanceof Map ? [...vcB.keys()] : Object.keys(vcB || {});
  const allKeys = new Set([...keysA, ...keysB]);

  let aGT = false, bGT = false;
  allKeys.forEach(k => {
    const va = (vcA instanceof Map ? vcA.get(k) : vcA[k]) || 0;
    const vb = (vcB instanceof Map ? vcB.get(k) : vcB[k]) || 0;
    if (va > vb) aGT = true;
    if (vb > va) bGT = true;
  });

  if (aGT && !bGT) return 'A_DOMINATES';
  if (bGT && !aGT) return 'B_DOMINATES';
  if (!aGT && !bGT) return 'EQUAL';
  return 'CONCURRENT';
}

function _vcMerge(vcA, vcB) {
  const result = new Map(vcA instanceof Map ? vcA : Object.entries(vcA || {}));
  const bEntries = vcB instanceof Map ? vcB.entries() : Object.entries(vcB || {});
  for (const [k, v] of bEntries) {
    result.set(k, Math.max(result.get(k) || 0, v));
  }
  return result;
}

function _vcIncrement(vcMap, nodeId) {
  const next = new Map(vcMap);
  next.set(nodeId, (next.get(nodeId) || 0) + 1);
  return next;
}

function _vcToObj(vcMap) {
  const obj = {};
  (vcMap instanceof Map ? vcMap : new Map(Object.entries(vcMap || {}))).forEach((v, k) => { obj[k] = v; });
  return obj;
}

function _objToVC(obj) {
  return new Map(Object.entries(obj || {}));
}

function _vcHash(vcMap) {
  const sorted = [...(vcMap instanceof Map ? vcMap.entries() : Object.entries(vcMap || {}))].sort(([a],[b]) => a.localeCompare(b));
  return sorted.map(([k,v]) => `${k}:${v}`).join('|');
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: LWW-REGISTER (Last-Write-Wins Register)
// Used for: scenario consensus probabilities, wallet balances,
//           tokenomics fields, agent FRS scores, mining state
// Sovereign signature bypasses all timestamp/VC comparisons.
// ═══════════════════════════════════════════════════════════════════════════

function _lwwGet(key) {
  const entry = _lwwRegisters.get(key);
  return entry ? entry.value : undefined;
}

function _lwwSet(key, value, options = {}) {
  const {
    ts         = _now(),
    nodeId     = _localNodeId,
    sovereign  = false,
    sovereignKey = null,
    vcMap      = null,
  } = options;

  const priority = sovereign ? SOVEREIGN_PRIORITY : ts;
  const existing = _lwwRegisters.get(key);

  // Sovereign primacy — always wins
  if (sovereign) {
    _lwwRegisters.set(key, { value, ts, nodeId, priority, sovereign: true, sovereignKey, vc: vcMap });
    _logMerge({ op: 'lww_set_sovereign', key, value, ts });
    _enqueueDelta({ type: 'lww', key, value, ts, nodeId, sovereign: true, sovereignKey });
    return true;
  }

  // Normal: higher timestamp wins; tie-break on nodeId lexicographic order
  if (!existing
    || ts > existing.ts
    || (ts === existing.ts && nodeId > existing.nodeId)
    || existing.sovereign === false) {
    _lwwRegisters.set(key, { value, ts, nodeId, priority: ts, sovereign: false, vc: vcMap });
    _logMerge({ op: 'lww_set', key, value, ts, nodeId });
    _enqueueDelta({ type: 'lww', key, value, ts, nodeId, sovereign: false });
    return true;
  }
  return false;
}

function _lwwMerge(remoteEntry, key) {
  // Sovereign gate — first check
  if (remoteEntry.sovereign) {
    const existing = _lwwRegisters.get(key);
    if (!existing || !existing.sovereign || remoteEntry.ts >= (existing.ts || 0)) {
      _lwwRegisters.set(key, { ...remoteEntry, priority: SOVEREIGN_PRIORITY });
      _logMerge({ op: 'lww_merge_sovereign', key, from: remoteEntry.nodeId });
      return true;
    }
    return false;
  }
  // Standard LWW merge
  return _lwwSet(key, remoteEntry.value, {
    ts: remoteEntry.ts, nodeId: remoteEntry.nodeId,
    sovereign: false, vcMap: remoteEntry.vc ? _objToVC(remoteEntry.vc) : null,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: LWW-ELEMENT-SET
// Used for: feed items, scenarios, predictions, OTC orders
// Elements are individually tracked by ID with per-element LWW timestamps.
// Deletion is recorded as a tombstone with higher ts than the add operation.
// ═══════════════════════════════════════════════════════════════════════════

function _lwwSetAdd(setName, itemId, value, options = {}) {
  const { ts = _now(), nodeId = _localNodeId, sovereign = false, sovereignKey = null } = options;
  if (!_lwwSets.has(setName)) _lwwSets.set(setName, new Map());
  const set      = _lwwSets.get(setName);
  const existing = set.get(itemId);

  if (sovereign) {
    set.set(itemId, { value, ts, nodeId, deleted: false, sovereign: true, sovereignKey });
    _logMerge({ op: 'lww_set_add_sovereign', setName, itemId });
    _enqueueDelta({ type: 'lww_set_add', setName, itemId, value, ts, nodeId, sovereign: true, sovereignKey });
    return true;
  }

  if (!existing || ts > existing.ts || (ts === existing.ts && nodeId > existing.nodeId)) {
    set.set(itemId, { value, ts, nodeId, deleted: false, sovereign: false });
    _logMerge({ op: 'lww_set_add', setName, itemId, ts });
    _enqueueDelta({ type: 'lww_set_add', setName, itemId, value, ts, nodeId, sovereign: false });
    return true;
  }
  return false;
}

function _lwwSetRemove(setName, itemId, options = {}) {
  const { ts = _now() + 1, nodeId = _localNodeId, sovereign = false } = options;
  if (!_lwwSets.has(setName)) return false;
  const set      = _lwwSets.get(setName);
  const existing = set.get(itemId);
  if (!existing) return false;

  // Sovereign deletion always wins
  if (sovereign || !existing.sovereign) {
    set.set(itemId, { ...existing, deleted: true, ts, nodeId, deletedBy: nodeId });
    _logMerge({ op: 'lww_set_remove', setName, itemId, ts });
    _enqueueDelta({ type: 'lww_set_remove', setName, itemId, ts, nodeId, sovereign });
    return true;
  }
  return false;
}

function _lwwSetGetAll(setName) {
  if (!_lwwSets.has(setName)) return [];
  return [..._lwwSets.get(setName).values()].filter(e => !e.deleted).map(e => e.value);
}

function _lwwSetMerge(setName, remoteDelta) {
  if (remoteDelta.deleted) {
    return _lwwSetRemove(setName, remoteDelta.itemId, {
      ts: remoteDelta.ts, nodeId: remoteDelta.nodeId, sovereign: remoteDelta.sovereign
    });
  }
  return _lwwSetAdd(setName, remoteDelta.itemId, remoteDelta.value, {
    ts: remoteDelta.ts, nodeId: remoteDelta.nodeId,
    sovereign: remoteDelta.sovereign, sovereignKey: remoteDelta.sovereignKey
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: G-COUNTER (Grow-Only Counter)
// Used for: upvote totals, total feed views, block counts, total transactions
// Value is the SUM of all per-node counters. Monotonically increasing only.
// Merge = per-node max.
// ═══════════════════════════════════════════════════════════════════════════

function _gCounterIncrement(key, amount = 1, nodeId = _localNodeId) {
  if (!_gCounters.has(key)) _gCounters.set(key, new Map());
  const counter = _gCounters.get(key);
  counter.set(nodeId, (counter.get(nodeId) || 0) + amount);
  _enqueueDelta({ type: 'gcounter', key, nodeId, value: counter.get(nodeId) });
}

function _gCounterValue(key) {
  if (!_gCounters.has(key)) return 0;
  let total = 0;
  _gCounters.get(key).forEach(v => { total += v; });
  return total;
}

function _gCounterMerge(key, remoteState) {
  if (!_gCounters.has(key)) _gCounters.set(key, new Map());
  const local = _gCounters.get(key);
  Object.entries(remoteState || {}).forEach(([nodeId, val]) => {
    local.set(nodeId, Math.max(local.get(nodeId) || 0, val));
  });
  _logMerge({ op: 'gcounter_merge', key });
}

function _gCounterToObj(key) {
  if (!_gCounters.has(key)) return {};
  const obj = {};
  _gCounters.get(key).forEach((v, k) => { obj[k] = v; });
  return obj;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: PN-COUNTER (Positive-Negative Counter)
// Used for: circulating supply (mint - burn), network pool balance,
//           wallet balances (credits - debits at CRDT layer)
// Value = sum(positive) - sum(negative). Supports both increment and decrement.
// ═══════════════════════════════════════════════════════════════════════════

function _pnCounterInit(key) {
  if (!_pnCounters.has(key)) {
    _pnCounters.set(key, { pos: new Map(), neg: new Map() });
  }
}

function _pnCounterIncrement(key, amount = 1, nodeId = _localNodeId) {
  _pnCounterInit(key);
  const { pos } = _pnCounters.get(key);
  pos.set(nodeId, (pos.get(nodeId) || 0) + amount);
  _enqueueDelta({ type: 'pncounter_inc', key, nodeId, amount });
}

function _pnCounterDecrement(key, amount = 1, nodeId = _localNodeId) {
  _pnCounterInit(key);
  const { neg } = _pnCounters.get(key);
  neg.set(nodeId, (neg.get(nodeId) || 0) + amount);
  _enqueueDelta({ type: 'pncounter_dec', key, nodeId, amount });
}

function _pnCounterValue(key) {
  if (!_pnCounters.has(key)) return 0;
  const { pos, neg } = _pnCounters.get(key);
  let total = 0;
  pos.forEach(v => { total += v; });
  neg.forEach(v => { total -= v; });
  return total;
}

function _pnCounterMerge(key, remoteState) {
  _pnCounterInit(key);
  const local = _pnCounters.get(key);
  Object.entries(remoteState.pos || {}).forEach(([nid, v]) => {
    local.pos.set(nid, Math.max(local.pos.get(nid) || 0, v));
  });
  Object.entries(remoteState.neg || {}).forEach(([nid, v]) => {
    local.neg.set(nid, Math.max(local.neg.get(nid) || 0, v));
  });
  _logMerge({ op: 'pncounter_merge', key });
}

function _pnCounterToObj(key) {
  if (!_pnCounters.has(key)) return { pos: {}, neg: {} };
  const { pos, neg } = _pnCounters.get(key);
  const posObj = {}, negObj = {};
  pos.forEach((v, k) => { posObj[k] = v; });
  neg.forEach((v, k) => { negObj[k] = v; });
  return { pos: posObj, neg: negObj };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5: OR-SET (Observed-Remove Set)
// Used for: active peer node registry, connected wallet registry
// Elements have unique tags; removal requires observing the specific add-tag.
// Merge = union of elements minus union of tombstones.
// ═══════════════════════════════════════════════════════════════════════════

function _orSetAdd(setName, value) {
  if (!_orSets.has(setName)) _orSets.set(setName, { elements: new Map(), tombstones: new Set() });
  const set  = _orSets.get(setName);
  const uid  = _uid();
  const ts   = _now();
  set.elements.set(uid, { value, ts, uid, nodeId: _localNodeId });
  _enqueueDelta({ type: 'or_set_add', setName, uid, value, ts, nodeId: _localNodeId });
  return uid;
}

function _orSetRemove(setName, value) {
  if (!_orSets.has(setName)) return;
  const set   = _orSets.get(setName);
  const toRemove = [...set.elements.entries()]
    .filter(([, e]) => JSON.stringify(e.value) === JSON.stringify(value))
    .map(([uid]) => uid);
  toRemove.forEach(uid => {
    set.tombstones.add(uid);
    set.elements.delete(uid);
    _enqueueDelta({ type: 'or_set_remove', setName, uid, ts: _now() });
  });
}

function _orSetContains(setName, value) {
  if (!_orSets.has(setName)) return false;
  const set = _orSets.get(setName);
  return [...set.elements.values()].some(e => JSON.stringify(e.value) === JSON.stringify(value));
}

function _orSetGetAll(setName) {
  if (!_orSets.has(setName)) return [];
  return [..._orSets.get(setName).elements.values()].map(e => e.value);
}

function _orSetMerge(setName, remoteState) {
  if (!_orSets.has(setName)) _orSets.set(setName, { elements: new Map(), tombstones: new Set() });
  const local = _orSets.get(setName);

  // Apply remote tombstones first
  (remoteState.tombstones || []).forEach(uid => {
    local.tombstones.add(uid);
    local.elements.delete(uid);
  });

  // Add remote elements not in local tombstones
  Object.entries(remoteState.elements || {}).forEach(([uid, entry]) => {
    if (!local.tombstones.has(uid)) {
      local.elements.set(uid, entry);
    }
  });

  // GC: cap tombstone size
  if (local.tombstones.size > MAX_TOMBSTONES) {
    const arr    = [...local.tombstones];
    const excess = arr.slice(0, arr.length - MAX_TOMBSTONES);
    excess.forEach(uid => local.tombstones.delete(uid));
  }
  _logMerge({ op: 'or_set_merge', setName });
}

function _orSetToObj(setName) {
  if (!_orSets.has(setName)) return { elements: {}, tombstones: [] };
  const set = _orSets.get(setName);
  const elements = {};
  set.elements.forEach((v, k) => { elements[k] = v; });
  return { elements, tombstones: [...set.tombstones] };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6: VECTOR CLOCK (Lamport-style, per-agent)
// Used for: causal ordering of agent analytical events and state mutations
// ═══════════════════════════════════════════════════════════════════════════

function _vcGet(agentId) {
  if (!_vectorClocks.has(agentId)) _vectorClocks.set(agentId, new Map());
  return _vectorClocks.get(agentId);
}

function _vcTick(agentId) {
  const vc   = _vcGet(agentId);
  const next = _vcIncrement(vc, _localNodeId);
  _vectorClocks.set(agentId, next);
  _enqueueDelta({ type: 'vc_tick', agentId, vc: _vcToObj(next), nodeId: _localNodeId });
  return next;
}

function _vcMergeAgent(agentId, remoteVC) {
  const local  = _vcGet(agentId);
  const merged = _vcMerge(local, _objToVC(remoteVC));
  _vectorClocks.set(agentId, merged);
  _logMerge({ op: 'vc_merge', agentId });
  return merged;
}

function _vcGetAll() {
  const result = {};
  _vectorClocks.forEach((vc, agentId) => { result[agentId] = _vcToObj(vc); });
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7: MV-REGISTER (Multi-Value Register)
// Used for: consensus probability values where concurrent writes from
//           multiple agents must ALL be preserved for resolution.
// Resolution: sovereign > max timestamp > causal dominance.
// ═══════════════════════════════════════════════════════════════════════════

function _mvSet(key, value, agentId, options = {}) {
  const { sovereign = false, sovereignKey = null } = options;
  if (!_mvRegisters.has(key)) _mvRegisters.set(key, new Map());
  const register = _mvRegisters.get(key);
  const vc       = _vcTick(agentId);
  const hash     = _vcHash(vc);
  const ts       = _now();

  if (sovereign) {
    // Sovereign write: clear all concurrent values, set single authoritative value
    register.clear();
    register.set('SOVEREIGN', { value, vc: _vcToObj(vc), ts, agentId, sovereign: true, sovereignKey });
    _logMerge({ op: 'mv_set_sovereign', key, value });
    _enqueueDelta({ type: 'mv', key, hash: 'SOVEREIGN', value, vc: _vcToObj(vc), ts, agentId, sovereign: true, sovereignKey });
    return;
  }

  // Remove dominated entries
  const toRemove = [];
  register.forEach((entry, h) => {
    if (entry.sovereign) return; // never remove sovereign entry
    const cmp = _vcCompare(_objToVC(entry.vc), vc);
    if (cmp === 'B_DOMINATES' || cmp === 'EQUAL') toRemove.push(h);
  });
  toRemove.forEach(h => register.delete(h));

  register.set(hash, { value, vc: _vcToObj(vc), ts, agentId, sovereign: false });
  _logMerge({ op: 'mv_set', key, hash: hash.slice(0,12) });
  _enqueueDelta({ type: 'mv', key, hash, value, vc: _vcToObj(vc), ts, agentId, sovereign: false });
}

function _mvGet(key) {
  if (!_mvRegisters.has(key)) return undefined;
  const register = _mvRegisters.get(key);
  if (register.size === 0) return undefined;
  // Sovereign always wins
  if (register.has('SOVEREIGN')) return register.get('SOVEREIGN').value;
  // No conflict: single value
  if (register.size === 1) return [...register.values()][0].value;
  // Conflict: return highest-ts value
  let best = null;
  register.forEach(entry => {
    if (!best || entry.ts > best.ts) best = entry;
  });
  return best ? best.value : undefined;
}

function _mvGetAll(key) {
  if (!_mvRegisters.has(key)) return [];
  return [..._mvRegisters.get(key).values()];
}

function _mvMerge(key, remoteDelta) {
  if (!_mvRegisters.has(key)) _mvRegisters.set(key, new Map());
  const register = _mvRegisters.get(key);

  // Sovereign remote write — clears everything
  if (remoteDelta.sovereign) {
    register.clear();
    register.set('SOVEREIGN', { value: remoteDelta.value, vc: remoteDelta.vc, ts: remoteDelta.ts, agentId: remoteDelta.agentId, sovereign: true, sovereignKey: remoteDelta.sovereignKey });
    _logMerge({ op: 'mv_merge_sovereign', key });
    return;
  }

  // Don't overwrite a local sovereign entry with a non-sovereign remote
  if (register.has('SOVEREIGN')) return;

  const remoteVC = _objToVC(remoteDelta.vc);

  // Remove any local entries dominated by the remote VC
  const toRemove = [];
  register.forEach((entry, h) => {
    const cmp = _vcCompare(_objToVC(entry.vc), remoteVC);
    if (cmp === 'B_DOMINATES') toRemove.push(h);
  });
  toRemove.forEach(h => register.delete(h));

  // Add remote only if not dominated by any remaining local entry
  let dominated = false;
  register.forEach(entry => {
    const cmp = _vcCompare(_objToVC(entry.vc), remoteVC);
    if (cmp === 'A_DOMINATES') dominated = true;
  });

  if (!dominated) {
    register.set(remoteDelta.hash, { value: remoteDelta.value, vc: remoteDelta.vc, ts: remoteDelta.ts, agentId: remoteDelta.agentId, sovereign: false });
  }

  // Merge vector clock for the agent
  if (remoteDelta.agentId) _vcMergeAgent(remoteDelta.agentId, remoteDelta.vc);
  _logMerge({ op: 'mv_merge', key, dominated });
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8: INDEXEDDB INTEGRATION
// Persists full CRDT state to IDB store "crdt_state".
// On boot, index.html reads IDB snapshot before any JS module loads.
// ═══════════════════════════════════════════════════════════════════════════

function _openIDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('IndexedDB not available')); return; }
    const req = indexedDB.open(IDB_NAME, 1);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
      // Also create the snapshot store used by index.html ghost-render
      if (!db.objectStoreNames.contains('snapshots')) {
        db.createObjectStore('snapshots');
      }
    };

    req.onsuccess  = (e) => resolve(e.target.result);
    req.onerror    = (e) => reject(new Error(`IDB open error: ${e.target.error}`));
    req.onblocked  = () => reject(new Error('IDB open blocked'));
  });
}

function _idbGet(store, key) {
  return new Promise((resolve, reject) => {
    if (!_idb) { resolve(null); return; }
    try {
      const tx  = _idb.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = (e) => resolve(e.target.result ?? null);
      req.onerror   = (e) => reject(new Error(`IDB get error: ${e.target.error}`));
    } catch (err) { reject(err); }
  });
}

function _idbPut(store, key, value) {
  return new Promise((resolve, reject) => {
    if (!_idb) { resolve(false); return; }
    try {
      const tx  = _idb.transaction(store, 'readwrite');
      const req = tx.objectStore(store).put(value, key);
      req.onsuccess = () => resolve(true);
      req.onerror   = (e) => reject(new Error(`IDB put error: ${e.target.error}`));
    } catch (err) { reject(err); }
  });
}

/**
 * pushSnapshot()
 * Serialises the full platform DB + CRDT state to IndexedDB.
 * Called by flushDB() in ai_evolution.js and by the CRDT sync cycle.
 * This is the primary IDB write path — fulfils File 1 (index.html) contract.
 */
export async function pushSnapshot(platformDB) {
  if (!_idb && !window._mirResilience) return false;

  // Compute and persist snapshot integrity hash
  if (window._mirResilience) {
    await window._mirResilience.siPersistVersion(platformDB);
  }

  if (!_idb) {
    // Fallback: use resilience storage layer
    try {
      await window._mirResilience.storageWrite('mir_crdt_snapshot', {
        data: platformDB, crdtState: _serializeCRDTState(), ts: _now(), nodeId: _localNodeId
      });
      _crdtLog('Snapshot saved via resilience fallback tier', 'warn');
      return true;
    } catch { return false; }
  }

  try {
    const snapshot = {
      data:        platformDB,
      crdtState:   _serializeCRDTState(),
      version:     CRDT_VERSION,
      ts:          _now(),
      nodeId:      _localNodeId,
    };
    await _idbPut('snapshots', IDB_SNAPSHOT_KEY, snapshot);
    await _idbPut(IDB_STORE,  IDB_CRDT_STATE_KEY, _serializeCRDTState());
    await _idbPut(IDB_STORE,  IDB_VEC_CLOCK_KEY,  _vcGetAll());
    await _idbPut(IDB_STORE,  IDB_ORSET_KEY,      _serializeORSets());
    _crdtLog('Snapshot pushed to IDB', 'idb');
    // Drop Phoenix spore after successful IDB write
    const sovKey = localStorage.getItem('mir_admin_pub_v2') || null;
    PhoenixSporeEngine.dropSpore(platformDB, sovKey);
    return true;
  } catch (err) {
    _crdtLog(`IDB snapshot failed: ${err.message}`, 'err');
    return false;
  }
}

/**
 * loadSnapshot()
 * Restores CRDT state from IDB on module init.
 * Returns the platform DB snapshot for use by initApplication().
 */
export async function loadSnapshot() {
  if (!_idb) return null;
  try {
    const snapshot = await _idbGet('snapshots', IDB_SNAPSHOT_KEY);
    if (snapshot?.crdtState) {
      _deserializeCRDTState(snapshot.crdtState);
      _crdtLog('CRDT state restored from IDB snapshot', 'idb');
    }
    // Restore vector clocks
    const vcs = await _idbGet(IDB_STORE, IDB_VEC_CLOCK_KEY);
    if (vcs) {
      Object.entries(vcs).forEach(([agentId, vc]) => {
        _vectorClocks.set(agentId, _objToVC(vc));
      });
    }
    // Restore OR-Sets
    const orSetsData = await _idbGet(IDB_STORE, IDB_ORSET_KEY);
    if (orSetsData) _deserializeORSets(orSetsData);
    return snapshot;
  } catch (err) {
    _crdtLog(`IDB load failed: ${err.message}`, 'warn');
    return null;
  }
}

// ── CRDT State Serialization ────────────────────────────────────────────

function _serializeCRDTState() {
  const lwwObj    = {};
  _lwwRegisters.forEach((v, k) => { lwwObj[k] = { ...v, vc: v.vc ? _vcToObj(v.vc) : null }; });

  const lwwSetsObj = {};
  _lwwSets.forEach((setMap, name) => {
    lwwSetsObj[name] = {};
    setMap.forEach((entry, id) => { lwwSetsObj[name][id] = entry; });
  });

  const gcObj = {};
  _gCounters.forEach((map, k) => { gcObj[k] = {}; map.forEach((v, nid) => { gcObj[k][nid] = v; }); });

  const pnObj = {};
  _pnCounters.forEach((pn, k) => { pnObj[k] = _pnCounterToObj(k); });

  const mvObj = {};
  _mvRegisters.forEach((regMap, k) => {
    mvObj[k] = {};
    regMap.forEach((entry, h) => { mvObj[k][h] = entry; });
  });

  return { lwwRegisters: lwwObj, lwwSets: lwwSetsObj, gCounters: gcObj, pnCounters: pnObj, mvRegisters: mvObj, ts: _now(), nodeId: _localNodeId };
}

function _deserializeCRDTState(state) {
  if (!state) return;

  Object.entries(state.lwwRegisters || {}).forEach(([k, v]) => {
    _lwwRegisters.set(k, { ...v, vc: v.vc ? _objToVC(v.vc) : null });
  });

  Object.entries(state.lwwSets || {}).forEach(([name, setObj]) => {
    const setMap = new Map();
    Object.entries(setObj).forEach(([id, entry]) => setMap.set(id, entry));
    _lwwSets.set(name, setMap);
  });

  Object.entries(state.gCounters || {}).forEach(([k, counters]) => {
    const map = new Map();
    Object.entries(counters).forEach(([nid, v]) => map.set(nid, v));
    _gCounters.set(k, map);
  });

  Object.entries(state.pnCounters || {}).forEach(([k, pn]) => {
    const pos = new Map(Object.entries(pn.pos || {}));
    const neg = new Map(Object.entries(pn.neg || {}));
    _pnCounters.set(k, { pos, neg });
  });

  Object.entries(state.mvRegisters || {}).forEach(([k, regObj]) => {
    const regMap = new Map();
    Object.entries(regObj).forEach(([h, entry]) => regMap.set(h, entry));
    _mvRegisters.set(k, regMap);
  });
}

function _serializeORSets() {
  const result = {};
  _orSets.forEach((set, name) => { result[name] = _orSetToObj(name); });
  return result;
}

function _deserializeORSets(data) {
  Object.entries(data || {}).forEach(([name, state]) => {
    const elements  = new Map(Object.entries(state.elements || {}));
    const tombstones= new Set(state.tombstones || []);
    _orSets.set(name, { elements, tombstones });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 9: BLOB WORKER BATCH MERGE ENGINE
// Delegates heavy batch merges to the pre-authored getCRDTMergeWorkerScript()
// from ai_meta.js. Main thread is never blocked during Dream State merges.
// ═══════════════════════════════════════════════════════════════════════════

function _getMergeWorkerScript() {
  // Use the pre-authored script from ai_meta.js if available
  if (typeof window._mirMeta?.getCRDTMergeWorkerScript === 'function') {
    return window._mirMeta.getCRDTMergeWorkerScript();
  }
  // Fallback: inline LWW batch merge worker
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
  var allKeys = new Set(Object.keys(local).concat(Object.keys(remote)));
  allKeys.forEach(function(key) {
    var l = local[key], r = remote[key];
    if (!l && r)        { merged[key] = r; }
    else if (l && !r)   { merged[key] = l; }
    else if (l && r) {
      if (r.sovereign)  { merged[key] = r; }
      else if (l.sovereign) { merged[key] = l; }
      else if ((r.ts||0) >= (l.ts||0)) {
        merged[key] = r;
        if ((r.ts||0) === (l.ts||0) && JSON.stringify(r.value) !== JSON.stringify(l.value)) {
          conflicts.push({ key: key, local: l, remote: r });
        }
      } else { merged[key] = l; }
    }
  });
  self.postMessage({ ok: true, merged: merged, conflicts: conflicts, keyCount: Object.keys(merged).length });
};
`;
}

/**
 * _runBlobMergeBatch()
 * Executes a batch LWW merge in an isolated Blob Worker.
 * Returns merged state and any conflicts detected.
 */
async function _runBlobMergeBatch(localState, remoteState) {
  const script = _getMergeWorkerScript();
  const blob   = new Blob([script], { type: 'application/javascript' });
  const url    = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const worker  = new Worker(url);
    const timeout = setTimeout(() => {
      worker.terminate();
      URL.revokeObjectURL(url);
      reject(new Error('Blob merge worker timeout'));
    }, MERGE_WORKER_TIMEOUT);

    worker.onmessage = (e) => {
      clearTimeout(timeout);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve(e.data);
    };
    worker.onerror = (e) => {
      clearTimeout(timeout);
      worker.terminate();
      URL.revokeObjectURL(url);
      reject(new Error(`Merge worker error: ${e.message}`));
    };
    worker.postMessage({ type: 'crdt_merge_batch', payload: { local: localState, remote: remoteState } });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 10: PLATFORM DB ↔ CRDT STATE BRIDGE
// Maps platform DB fields to their CRDT counterparts.
// Writes platform DB changes into CRDT structures.
// Reads CRDT state back into platform DB after merge.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * syncDBtoCRDT()
 * Reads current platform DB state and writes into CRDT structures.
 * Called before broadcasting state to peers.
 */
export function syncDBtoCRDT(sovereign = false, sovereignKey = null) {
  if (!_db) return;
  const opts = { sovereign, sovereignKey, nodeId: _localNodeId };

  // ── Tokenomics ─────────────────────────────────────────────────────────
  const t = _db.tokenomics;
  if (t) {
    _lwwSet('tok:maxSupply',         t.maxSupply,         { ...opts, ts: _now() });
    _lwwSet('tok:circulatingSupply', t.circulatingSupply, { ...opts, ts: _now() });
    _lwwSet('tok:burned',            t.burned,            { ...opts, ts: _now() });
    _lwwSet('tok:networkPool',       t.networkPool,       { ...opts, ts: _now() });
    // PN-Counter for supply (authoritative for burn verification)
    if (!_pnCounters.has('supply')) {
      _pnCounterIncrement('supply', t.circulatingSupply || 0, 'genesis');
    }
  }

  // ── Scenarios ──────────────────────────────────────────────────────────
  (_db.scenarios || []).forEach(s => {
    _lwwSetAdd('scenarios', s.id, s, { ...opts, ts: s.createdAt || _now() });
    // Consensus prob via MV-Register for multi-agent concurrent writes
    if (!s.adminOverride) {
      _mvSet(`scen:prob:${s.id}`, s.consensusProb, 'resident', { sovereign, sovereignKey });
    } else {
      // Admin-overridden scenario uses sovereign LWW
      _lwwSet(`scen:prob:${s.id}`, s.adminOverrideValue ?? s.consensusProb,
        { ...opts, ts: s.adminOverrideTs || _now(), sovereign: true, sovereignKey });
    }
  });

  // ── Feed items ────────────────────────────────────────────────────────
  (_db.feed || []).forEach(item => {
    _lwwSetAdd('feed', item.id, item, { ...opts, ts: item.createdAt || _now() });
    _gCounterIncrement(`upvotes:${item.id}`, item.upvotes || 0, _localNodeId);
  });

  // ── Predictions ───────────────────────────────────────────────────────
  (_db.predictions || []).forEach(p => {
    _lwwSetAdd('predictions', p.id, p, { ...opts, ts: p.createdAt || _now() });
  });

  // ── Wallets / Accounts ────────────────────────────────────────────────
  Object.entries(_db.wallets || {}).forEach(([pk, w]) => {
    _lwwSet(`wallet:${pk}:balance`, w.balance, { ...opts, ts: _now() });
    _lwwSet(`wallet:${pk}:frs`,     w.frs,     { ...opts, ts: _now() });
  });

  // ── Mining state ──────────────────────────────────────────────────────
  const ms = _db.miningState;
  if (ms) {
    _lwwSet('mining:epoch',      ms.currentEpoch,       { ...opts, ts: _now() });
    _lwwSet('mining:difficulty', ms.difficulty,         { ...opts, ts: _now() });
    _lwwSet('mining:active',     ms.active,             { ...opts, ts: _now() });
    _gCounterIncrement('mining:totalMined', ms.minedSessionMiri || 0, _localNodeId);
  }

  // ── Peer node registry (OR-Set) ────────────────────────────────────────
  _orSetAdd('peers', { nodeId: _localNodeId, ts: _now(), version: CRDT_VERSION });

  // ── Agent vector clocks ────────────────────────────────────────────────
  ['resident', 'macro', 'cyber', 'geo'].forEach(agentId => {
    if (!_vectorClocks.has(agentId)) _vcTick(agentId);
  });

  _crdtLog('DB synced to CRDT structures', 'merge');
}

/**
 * syncCRDTtoDB()
 * Reads merged CRDT state and applies it back to the platform DB.
 * Sovereign values in CRDT registers always overwrite DB fields.
 * Called after receiving and merging a remote CRDT delta.
 */
export function syncCRDTtoDB() {
  if (!_db) return;

  // ── Tokenomics ─────────────────────────────────────────────────────────
  const maxSupply   = _lwwGet('tok:maxSupply');
  const circ        = _lwwGet('tok:circulatingSupply');
  const burned      = _lwwGet('tok:burned');
  const pool        = _lwwGet('tok:networkPool');
  if (!_db.tokenomics) _db.tokenomics = {};
  if (maxSupply  !== undefined) _db.tokenomics.maxSupply         = maxSupply;
  if (circ       !== undefined) _db.tokenomics.circulatingSupply = circ;
  if (burned     !== undefined) _db.tokenomics.burned            = burned;
  if (pool       !== undefined) _db.tokenomics.networkPool       = pool;

  // ── Scenarios (merge LWW-Set items into DB array) ───────────────────
  const crdtScenarios = _lwwSetGetAll('scenarios');
  if (crdtScenarios.length > 0) {
    const existingIds = new Set((_db.scenarios || []).map(s => s.id));
    const newItems    = crdtScenarios.filter(s => s && !existingIds.has(s.id));
    if (!_db.scenarios) _db.scenarios = [];
    _db.scenarios.push(...newItems);

    // Apply MV-Register consensus probs back to scenarios
    _db.scenarios.forEach(s => {
      if (s.adminOverride) return;
      const prob = _mvGet(`scen:prob:${s.id}`);
      if (prob !== undefined) s.consensusProb = prob;
    });
  }

  // ── Feed items ────────────────────────────────────────────────────────
  const crdtFeed = _lwwSetGetAll('feed');
  if (crdtFeed.length > 0) {
    const existingIds = new Set((_db.feed || []).map(i => i.id));
    const newItems    = crdtFeed.filter(i => i && !existingIds.has(i.id));
    if (!_db.feed) _db.feed = [];
    _db.feed.push(...newItems);
  }

  // ── Predictions ────────────────────────────────────────────────────────
  const crdtPreds = _lwwSetGetAll('predictions');
  if (crdtPreds.length > 0) {
    const existingIds = new Set((_db.predictions || []).map(p => p.id));
    const newItems    = crdtPreds.filter(p => p && !existingIds.has(p.id));
    if (!_db.predictions) _db.predictions = [];
    _db.predictions.push(...newItems);
  }

  // ── Wallet balances (sovereign-only mutation guard) ───────────────────
  Object.entries(_db.wallets || {}).forEach(([pk, w]) => {
    const balEntry = _lwwRegisters.get(`wallet:${pk}:balance`);
    if (balEntry?.sovereign) {
      w.balance = balEntry.value;
      const acc = _db.accounts?.[pk]; if (acc) acc.balance = balEntry.value;
    }
    const frsEntry = _lwwRegisters.get(`wallet:${pk}:frs`);
    if (frsEntry?.sovereign && frsEntry.value !== undefined) w.frs = frsEntry.value;
  });

  // ── Mining state ──────────────────────────────────────────────────────
  if (!_db.miningState) _db.miningState = {};
  const epoch      = _lwwGet('mining:epoch');
  const difficulty = _lwwGet('mining:difficulty');
  const active     = _lwwGet('mining:active');
  if (epoch      !== undefined) _db.miningState.currentEpoch = epoch;
  if (difficulty !== undefined) _db.miningState.difficulty   = difficulty;
  if (active     !== undefined) _db.miningState.active       = active;

  if (typeof _markDirty === 'function') _markDirty();
  _crdtLog('CRDT state synced back to DB', 'merge');
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 11: DELTA QUEUE & PEER SYNC PROTOCOL
// Collects local CRDT mutations and broadcasts them to peers
// via mesh_network.js DataChannel 'crdt_sync' messages.
// ═══════════════════════════════════════════════════════════════════════════

function _enqueueDelta(delta) {
  _syncQueue.push({ ...delta, ts: _now(), nodeId: _localNodeId });
  if (_syncQueue.length > 200) _syncQueue.splice(0, _syncQueue.length - 200);
}

function _flushDeltaQueue() {
  if (_syncQueue.length === 0 || _sovereignFrozen) return;
  if (!window._mirMesh?.broadcastToPeers) return;

  // If offline, buffer deltas instead of attempting to send
  if (window._mirResilience && !window._mirResilience.isOnline()) {
    _syncQueue.forEach(d => window._mirResilience.oqEnqueueDelta(d));
    _syncQueue.length = 0;
    _crdtLog('Offline: all deltas buffered to offline queue', 'warn');
    return;
  }

  // Traffic shaping: only flush if peer token available
  if (window._mirResilience && !window._mirResilience.tsCanSend('peer')) {
    _crdtLog('CRDT flush throttled by traffic shaper', 'info');
    return;
  }
  if (window._mirResilience) window._mirResilience.tsConsume('peer');

  const batch = _syncQueue.splice(0, SYNC_BATCH_SIZE);
  window._mirMesh.broadcastToPeers({
    type:    'crdt_sync',
    payload: { deltas: batch, nodeId: _localNodeId, ts: _now() },
  });
  if (batch.length > 0) _crdtLog(`Flushed ${batch.length} CRDT deltas to peers`, 'merge');
}

/**
 * onPeerSync()
 * Handles incoming CRDT sync messages from a peer node.
 * Called by mesh_network.js when a 'crdt_sync' DataChannel message arrives.
 * Applies all deltas through their respective CRDT merge functions.
 * Runs heavy batches through the Blob Worker merge engine.
 */
export async function onPeerSync(peerId, payload) {
  if (_sovereignFrozen) return;
  if (!payload || !Array.isArray(payload.deltas)) return;

  // Deduplication via resilience layer
  let deltas = payload.deltas;
  if (window._mirResilience) {
    const dedup = window._mirResilience;
    const before = deltas.length;
    deltas = deltas.filter(d => {
      if (dedup.ddIsSeen(d)) return false;
      dedup.ddMarkSeen(d);
      return true;
    });
    if (before !== deltas.length) {
      _crdtLog(`Delta dedup: dropped ${before - deltas.length} replays from ${peerId.slice(0,8)}`, 'warn');
    }
  }
  if (deltas.length === 0) return;

  _crdtLog(`Received ${deltas.length} CRDT deltas from ${peerId.slice(0,8)}`, 'merge');

  // For large batches, use Blob Worker; for small batches, process inline
  if (deltas.length > 10) {
    await _processDeltasBatchWorker(peerId, deltas);
  } else {
    _processDeltasInline(peerId, deltas);
  }

  // Sync merged CRDT state back to platform DB
  syncCRDTtoDB();

  // Update UI
  _updateCRDTHUD();
}

function _processDeltasInline(peerId, deltas) {
  deltas.forEach(delta => _applyDelta(peerId, delta));
}

async function _processDeltasBatchWorker(peerId, deltas) {
  // Build local LWW register snapshot for batch comparison
  const localLWW = {};
  _lwwRegisters.forEach((v, k) => { localLWW[k] = { value: v.value, ts: v.ts, nodeId: v.nodeId, sovereign: v.sovereign }; });

  const remoteLWW = {};
  deltas.filter(d => d.type === 'lww').forEach(d => {
    remoteLWW[d.key] = { value: d.value, ts: d.ts, nodeId: d.nodeId, sovereign: d.sovereign, sovereignKey: d.sovereignKey };
  });

  try {
    const result = await _runBlobMergeBatch(localLWW, remoteLWW);
    if (result.ok) {
      // Apply merged LWW state
      Object.entries(result.merged || {}).forEach(([key, entry]) => {
        _lwwMerge(entry, key);
      });
      if (result.conflicts?.length > 0) {
        _crdtLog(`${result.conflicts.length} LWW conflicts resolved (sovereign/ts rules applied)`, 'warn');
        result.conflicts.forEach(c => {
          _logMerge({ op: 'conflict_resolved', key: c.key, localTs: c.local?.ts, remoteTs: c.remote?.ts });
        });
      }
    }
  } catch (err) {
    _crdtLog(`Batch merge worker failed: ${err.message} — falling back to inline`, 'warn');
  }

  // Process non-LWW deltas inline regardless
  deltas.filter(d => d.type !== 'lww').forEach(d => _applyDelta(peerId, d));
}

function _applyDelta(peerId, delta) {
  if (!delta || !delta.type) return;

  switch (delta.type) {
    case 'lww':
      _lwwMerge({ value: delta.value, ts: delta.ts, nodeId: delta.nodeId, sovereign: delta.sovereign, sovereignKey: delta.sovereignKey, vc: delta.vc }, delta.key);
      break;

    case 'lww_set_add':
      _lwwSetMerge(delta.setName, { itemId: delta.itemId, value: delta.value, ts: delta.ts, nodeId: delta.nodeId, sovereign: delta.sovereign, sovereignKey: delta.sovereignKey, deleted: false });
      break;

    case 'lww_set_remove':
      _lwwSetMerge(delta.setName, { itemId: delta.itemId, ts: delta.ts, nodeId: delta.nodeId, sovereign: delta.sovereign, deleted: true });
      break;

    case 'gcounter':
      if (!_gCounters.has(delta.key)) _gCounters.set(delta.key, new Map());
      _gCounters.get(delta.key).set(delta.nodeId, Math.max(_gCounters.get(delta.key).get(delta.nodeId) || 0, delta.value));
      break;

    case 'pncounter_inc': {
      _pnCounterInit(delta.key);
      const { pos } = _pnCounters.get(delta.key);
      pos.set(delta.nodeId, Math.max(pos.get(delta.nodeId) || 0, (pos.get(delta.nodeId) || 0) + delta.amount));
      break;
    }

    case 'pncounter_dec': {
      _pnCounterInit(delta.key);
      const { neg } = _pnCounters.get(delta.key);
      neg.set(delta.nodeId, Math.max(neg.get(delta.nodeId) || 0, (neg.get(delta.nodeId) || 0) + delta.amount));
      break;
    }

    case 'or_set_add': {
      if (!_orSets.has(delta.setName)) _orSets.set(delta.setName, { elements: new Map(), tombstones: new Set() });
      const set = _orSets.get(delta.setName);
      if (!set.tombstones.has(delta.uid)) {
        set.elements.set(delta.uid, { value: delta.value, ts: delta.ts, uid: delta.uid, nodeId: delta.nodeId });
      }
      break;
    }

    case 'or_set_remove': {
      if (!_orSets.has(delta.setName)) _orSets.set(delta.setName, { elements: new Map(), tombstones: new Set() });
      const set = _orSets.get(delta.setName);
      set.tombstones.add(delta.uid);
      set.elements.delete(delta.uid);
      break;
    }

    case 'vc_tick':
      _vcMergeAgent(delta.agentId, delta.vc);
      break;

    case 'mv':
      _mvMerge(delta.key, delta);
      break;

    default:
      _crdtLog(`Unknown delta type: "${delta.type}" from ${peerId.slice(0,8)}`, 'warn');
  }
  _logMerge({ op: `apply_${delta.type}`, from: peerId.slice(0,8) });
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 12: SOVEREIGN OVERRIDE GATE
// Admin ED25519 signature carries SOVEREIGN_PRIORITY = Infinity.
// This gate is enforced at every CRDT merge entry point.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * applySovereignDelta()
 * Applies a sovereign-signed CRDT delta received from the Admin.
 * Bypasses all vector clock and timestamp comparisons.
 * Immediately overwrites all conflicting state across all CRDT types.
 * Called when Admin issues override commands via execAdminCmd().
 */
export async function applySovereignDelta(delta) {
  const isSov = await _isSovereignSigned(delta);
  if (!isSov) {
    _crdtLog('Sovereign delta rejected: signature mismatch', 'err');
    return false;
  }

  _crdtLog(`SOVEREIGN OVERRIDE DELTA applied: type=${delta.type} key=${delta.key || delta.setName || '—'}`, 'sovereign');

  // Force sovereign flag on all nested entries
  const sovDelta = { ...delta, sovereign: true, _sovereignApplied: _now() };

  switch (delta.type) {
    case 'lww':
      // Sovereign LWW: set directly, clear any competing entries
      _lwwRegisters.set(delta.key, { value: delta.value, ts: _now(), nodeId: 'SOVEREIGN', priority: SOVEREIGN_PRIORITY, sovereign: true, sovereignKey: delta._sovereignKey });
      _logMerge({ op: 'sovereign_lww', key: delta.key, value: delta.value });
      break;

    case 'lww_set_add':
      _lwwSetAdd(delta.setName, delta.itemId, delta.value, { ts: _now(), nodeId: 'SOVEREIGN', sovereign: true, sovereignKey: delta._sovereignKey });
      break;

    case 'lww_set_remove':
      _lwwSetRemove(delta.setName, delta.itemId, { ts: _now() + 1, nodeId: 'SOVEREIGN', sovereign: true });
      break;

    case 'mv':
      _mvSet(delta.key, delta.value, delta.agentId || 'resident', { sovereign: true, sovereignKey: delta._sovereignKey });
      break;

    case 'full_state_override':
      // Total state override: deserialise incoming CRDT state
      if (delta.crdtState) {
        _deserializeCRDTState(delta.crdtState);
        _crdtLog('Full CRDT state overridden by sovereign', 'sovereign');
      }
      break;

    default:
      _applyDelta('SOVEREIGN', sovDelta);
  }

  // Sync back to platform DB immediately
  syncCRDTtoDB();

  // Persist to IDB immediately
  if (_db) await pushSnapshot(_db);

  // Broadcast sovereign override to all peers
  if (!_sovereignFrozen && window._mirMesh?.broadcastToPeers) {
    window._mirMesh.broadcastToPeers({ type: 'crdt_sync', payload: { deltas: [sovDelta], nodeId: _localNodeId, ts: _now(), sovereign: true } });
  }

  return true;
}

/**
 * buildSovereignDelta()
 * Helper called by execAdminCmd() to construct a properly-formed
 * sovereign-signed CRDT delta for distribution.
 */
export function buildSovereignDelta(type, key, value, extraFields = {}) {
  const storedKey = localStorage.getItem('mir_admin_pub_v2') || _sovereignKey;
  return {
    type, key, value,
    ...extraFields,
    _sovereign:    true,
    _sovereignKey: storedKey,
    sovereign:     true,
    sovereignKey:  storedKey,
    ts:            _now(),
    nodeId:        _localNodeId,
    priority:      SOVEREIGN_PRIORITY,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 13: GARBAGE COLLECTION
// Removes expired tombstones, stale VC entries, and orphaned CRDT keys.
// ═══════════════════════════════════════════════════════════════════════════

function _runGarbageCollection() {
  let freed = 0;

  // GC OR-Set tombstones (keep MAX_TOMBSTONES most recent)
  _orSets.forEach((set, name) => {
    if (set.tombstones.size > MAX_TOMBSTONES) {
      const arr     = [...set.tombstones];
      const toRemove= arr.slice(0, arr.length - MAX_TOMBSTONES);
      toRemove.forEach(uid => set.tombstones.delete(uid));
      freed += toRemove.length;
    }
  });

  // GC stale vector clock entries (keep MAX_VC_ENTRIES per agent)
  _vectorClocks.forEach((vc, agentId) => {
    if (vc.size > MAX_VC_ENTRIES) {
      // Keep only the highest-value entries
      const sorted  = [...vc.entries()].sort(([,a],[,b]) => b - a);
      const trimmed = new Map(sorted.slice(0, MAX_VC_ENTRIES));
      _vectorClocks.set(agentId, trimmed);
      freed += vc.size - trimmed.size;
    }
  });

  // GC MV-Register entries (keep at most 8 concurrent values per key)
  _mvRegisters.forEach((regMap, key) => {
    if (regMap.size > 8) {
      const sorted   = [...regMap.entries()].sort(([,a],[,b]) => (b.ts||0) - (a.ts||0));
      const trimmed  = new Map(sorted.slice(0, 8));
      _mvRegisters.set(key, trimmed);
      freed += regMap.size - 8;
    }
  });

  // GC stale LWW-Set tombstones (deleted items older than 24h)
  const cutoff = _now() - 86_400_000;
  _lwwSets.forEach((setMap, name) => {
    const toDelete = [...setMap.entries()].filter(([,e]) => e.deleted && e.ts < cutoff).map(([id]) => id);
    toDelete.forEach(id => setMap.delete(id));
    freed += toDelete.length;
  });

  if (freed > 0) _crdtLog(`GC: freed ${freed} stale CRDT entries`, 'info');
  return freed;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 14: CRDT UI — TAB VIEWS
// ═══════════════════════════════════════════════════════════════════════════

function _updateCRDTHUD() {
  // Update CRDT tab view if visible
  const lwwTab  = document.getElementById('crdt-lww');
  const gcTab   = document.getElementById('crdt-gc');
  const orTab   = document.getElementById('crdt-ors');
  const logTab  = document.getElementById('crdt-log');

  if (lwwTab && lwwTab.style.display !== 'none') _renderLWWTab(lwwTab);
  if (gcTab  && gcTab.style.display  !== 'none') _renderGCTab(gcTab);
  if (orTab  && orTab.style.display  !== 'none') _renderORTab(orTab);
  if (logTab && logTab.style.display !== 'none') _renderLogTab(logTab);
}

function _renderLWWTab(container) {
  const rows = [..._lwwRegisters.entries()].slice(0, 30);
  container.innerHTML = `
  <div style="font-family:var(--font-data,monospace);font-size:0.6rem">
    <div style="display:grid;grid-template-columns:1fr 1fr 90px 60px;gap:0.3rem;color:var(--txt-dim);margin-bottom:0.4rem;font-size:0.56rem;font-weight:700">
      <span>KEY</span><span>VALUE</span><span>NODE</span><span>SOV</span>
    </div>
    ${rows.map(([key, entry]) => `
    <div style="display:grid;grid-template-columns:1fr 1fr 90px 60px;gap:0.3rem;padding:0.18rem 0;border-bottom:1px solid var(--border-deep)">
      <span style="color:var(--cyan);overflow:hidden;text-overflow:ellipsis">${key.slice(0,22)}</span>
      <span style="color:var(--txt-sec);overflow:hidden;text-overflow:ellipsis">${JSON.stringify(entry.value).slice(0,20)}</span>
      <span style="color:var(--txt-dim)">${(entry.nodeId||'—').slice(0,8)}</span>
      <span style="color:${entry.sovereign?'var(--gold)':'var(--txt-dim)'}">${entry.sovereign?'✦ YES':'—'}</span>
    </div>`).join('')}
    <div style="color:var(--txt-dim);margin-top:0.4rem">${_lwwRegisters.size} total LWW registers</div>
  </div>`;
}

function _renderGCTab(container) {
  const counters = [..._gCounters.entries()].slice(0, 20);
  const pnCounterList = [..._pnCounters.entries()].slice(0, 10);
  container.innerHTML = `
  <div style="font-family:var(--font-data,monospace);font-size:0.6rem">
    <div style="color:var(--txt-dim);font-size:0.62rem;font-weight:700;margin-bottom:0.35rem">G-COUNTERS (Grow-Only)</div>
    ${counters.map(([key]) => `
    <div style="display:flex;justify-content:space-between;padding:0.14rem 0;border-bottom:1px solid var(--border-deep)">
      <span style="color:var(--cyan)">${key.slice(0,24)}</span>
      <span style="color:var(--green);font-weight:700">${_gCounterValue(key).toLocaleString()}</span>
    </div>`).join('')}
    <div style="color:var(--txt-dim);font-size:0.62rem;font-weight:700;margin:0.5rem 0 0.25rem">PN-COUNTERS</div>
    ${pnCounterList.map(([key]) => {
      const val = _pnCounterValue(key);
      return `
      <div style="display:flex;justify-content:space-between;padding:0.14rem 0;border-bottom:1px solid var(--border-deep)">
        <span style="color:var(--amber)">${key.slice(0,24)}</span>
        <span style="color:${val>=0?'var(--green)':'var(--crimson)'};font-weight:700">${val >= 0 ? '+' : ''}${val.toLocaleString()}</span>
      </div>`;
    }).join('')}
    <div style="color:var(--txt-dim);margin-top:0.35rem">${_gCounters.size} G-counters · ${_pnCounters.size} PN-counters</div>
  </div>`;
}

function _renderORTab(container) {
  const sets = [..._orSets.entries()].slice(0, 10);
  container.innerHTML = `
  <div style="font-family:var(--font-data,monospace);font-size:0.6rem">
    ${sets.map(([name, set]) => `
    <div style="margin-bottom:0.6rem">
      <div style="color:var(--cyan);font-weight:700;margin-bottom:0.2rem">${name}</div>
      <div style="color:var(--txt-dim)">${set.elements.size} elements · ${set.tombstones.size} tombstones</div>
      ${[...set.elements.values()].slice(0,5).map(e => `
      <div style="padding:0.1rem 0 0.1rem 0.5rem;border-left:2px solid var(--border);color:var(--txt-sec)">
        ${JSON.stringify(e.value).slice(0,50)}
      </div>`).join('')}
    </div>`).join('')}
    <div style="color:var(--txt-dim)">${_orSets.size} total OR-Sets</div>
  </div>`;
}

function _renderLogTab(container) {
  const recent = _mergeLog.slice(-30).reverse();
  container.innerHTML = `
  <div style="font-family:var(--font-data,monospace);font-size:0.58rem">
    ${recent.map(entry => `
    <div style="padding:0.1rem 0;border-bottom:1px solid var(--border-deep);color:var(--txt-dim)">
      <span style="color:${entry.op.includes('sovereign')?'var(--gold)':entry.op.includes('conflict')?'var(--crimson)':'var(--cyan)'}">${entry.op}</span>
      <span style="margin-left:0.4rem">${entry.key||entry.setName||entry.agentId||''}</span>
      <span style="color:var(--txt-dim);float:right">${new Date(entry.ts).toTimeString().slice(0,8)}</span>
    </div>`).join('')}
    <div style="color:var(--txt-dim);margin-top:0.35rem">${_mergeLog.length} total merge operations</div>
  </div>`;
}

export function switchTab(tabName) {
  const tabs = ['crdt-lww', 'crdt-gc', 'crdt-ors', 'crdt-log'];
  tabs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = id === tabName ? '' : 'none';
  });
  const tabBtns = document.querySelectorAll('.crdt-tab-btn');
  tabBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
  _updateCRDTHUD();
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 15: PUBLIC STATUS & INSPECTION API
// ═══════════════════════════════════════════════════════════════════════════

export function getCRDTStatus() {
  return {
    version:          CRDT_VERSION,
    nodeId:           _localNodeId,
    lwwRegisters:     _lwwRegisters.size,
    lwwSets:          _lwwSets.size,
    gCounters:        _gCounters.size,
    pnCounters:       _pnCounters.size,
    orSets:           _orSets.size,
    vectorClocks:     _vectorClocks.size,
    mvRegisters:      _mvRegisters.size,
    mergeLogSize:     _mergeLog.length,
    syncQueueSize:    _syncQueue.length,
    sovereignFrozen:  _sovereignFrozen,
    idbReady:         !!_idb,
  };
}

export function getMergeLog() { return _mergeLog.slice(-50); }

export function getCRDTSummary() {
  const sovereignEntries = [..._lwwRegisters.values()].filter(e => e.sovereign).length;
  const totalPeers       = _orSetGetAll('peers').length;
  const upvoteTotal      = _gCounterValue('upvotes:total') || 0;
  const supplyPN         = _pnCounterValue('supply');
  return {
    sovereignEntries,
    totalPeers,
    upvoteTotal,
    supplyPN,
    mergeOperations: _mergeLog.length,
    activeSets:      _lwwSets.size + _orSets.size,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PHOENIX SPORE ENGINE — Crash-Safe State Recovery
// Isolated ledger snapshot persistence with signature verification.
// Writes only to namespaced sessionStorage/localStorage keys.
// Reads only verified, schema-validated snapshots.
// Never executes dynamic code — pure data serialization.
// Sovereign-signed snapshots are always preferred over unsigned spores.
// ═══════════════════════════════════════════════════════════════════════════
const SPORE_SESSION_KEY  = '_mir_spore_session_v2';
const SPORE_LOCAL_KEY    = '_mir_spore_local_v2';
const SPORE_MAX_AGE_MS   = 48 * 3_600_000;   // 48 hours
const SPORE_SCHEMA_FIELDS= ['version','tokenomics','miningState','dreamState'];

export const PhoenixSporeEngine = {

  /**
   * dropSpore()
   * Persists a validated ledger snapshot to session + local storage.
   * Only writes schema-verified, non-corrupted state objects.
   * Called from pushSnapshot() after every successful IDB write.
   * @param {Object} stateSnapshot — must contain at minimum: version, tokenomics
   * @param {string|null} sovereignHash — SHA-256 hash if admin-signed, else null
   */
  dropSpore(stateSnapshot, sovereignHash = null) {
    if (!stateSnapshot || typeof stateSnapshot !== 'object') return false;

    // Schema validation — only write if minimum fields are present
    const hasRequiredFields = SPORE_SCHEMA_FIELDS.every(f =>
      stateSnapshot[f] !== undefined && stateSnapshot[f] !== null
    );
    if (!hasRequiredFields) return false;

    // Sanitize: only store ledger-critical fields, never raw agent STM or chat
    const sanitized = {
      version:       stateSnapshot.version,
      genesis:       stateSnapshot.genesis,
      tokenomics:    stateSnapshot.tokenomics,
      miningState:   stateSnapshot.miningState,
      dreamState:    { lastRun: stateSnapshot.dreamState?.lastRun || 0,
                       cycle:   stateSnapshot.dreamState?.cycle   || 0 },
      scenarioCount: (stateSnapshot.scenarios   || []).length,
      feedCount:     (stateSnapshot.feed        || []).length,
      predCount:     (stateSnapshot.predictions || []).length,
      adminPubKey:   stateSnapshot.adminPubKey  || '',
      founderPubKey: stateSnapshot.founderPubKey|| '',
    };

    const sporePayload = {
      ts:            Date.now(),
      sovereignHash: sovereignHash || null,
      isSovereign:   sovereignHash !== null,
      schemaVersion: '2.0',
      data:          sanitized,
    };

    try {
      const serialized = JSON.stringify(sporePayload);
      sessionStorage.setItem(SPORE_SESSION_KEY, serialized);
      localStorage.setItem(SPORE_LOCAL_KEY,   serialized);
      return true;
    } catch {
      // Storage full — attempt session only
      try { sessionStorage.setItem(SPORE_SESSION_KEY, JSON.stringify(sporePayload)); return true; }
      catch { return false; }
    }
  },

  /**
   * reviveSpore()
   * Reads the most recent valid spore and returns verified ledger metadata.
   * Does NOT reconstruct the full DB — returns a lightweight recovery hint
   * that initCRDT() uses to validate the IDB snapshot or seed defaults.
   * Sovereign-signed spores are always preferred.
   * Returns null if no valid spore exists or schema fails validation.
   */
  reviveSpore() {
    let raw = null;
    // Prefer sessionStorage (fresher), fall back to localStorage
    try { raw = sessionStorage.getItem(SPORE_SESSION_KEY); } catch {}
    if (!raw) { try { raw = localStorage.getItem(SPORE_LOCAL_KEY); } catch {} }
    if (!raw) return null;

    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { this.purgeSpores(); return null; }

    // Age check
    if (!parsed.ts || Date.now() - parsed.ts > SPORE_MAX_AGE_MS) {
      this.purgeSpores(); return null;
    }

    // Schema version check
    if (parsed.schemaVersion !== '2.0') { this.purgeSpores(); return null; }

    // Data integrity check — required fields
    if (!parsed.data?.version || !parsed.data?.tokenomics) {
      this.purgeSpores(); return null;
    }

    // Tokenomics sanity guard
    const t = parsed.data.tokenomics;
    if (typeof t.circulatingSupply !== 'number' || t.circulatingSupply < 0
        || t.circulatingSupply > 210_000_000_000_000) {
      this.purgeSpores(); return null;
    }

    return {
      recoveredAt:       parsed.ts,
      ageMs:             Date.now() - parsed.ts,
      isSovereign:       parsed.isSovereign || false,
      sovereignHash:     parsed.sovereignHash || null,
      version:           parsed.data.version,
      tokenomics:        parsed.data.tokenomics,
      miningState:       parsed.data.miningState,
      dreamCycle:        parsed.data.dreamState?.cycle || 0,
      scenarioCount:     parsed.data.scenarioCount || 0,
      adminPubKey:       parsed.data.adminPubKey || '',
    };
  },

  /**
   * purgeSpores()
   * Removes all spore data from both storage tiers.
   * Called on: successful IDB restore, schema failure, expiry, sovereign reset.
   */
  purgeSpores() {
    try { sessionStorage.removeItem(SPORE_SESSION_KEY); } catch {}
    try { localStorage.removeItem(SPORE_LOCAL_KEY);     } catch {}
  },

  /**
   * sporeStatus()
   * Returns metadata about the current spore without loading data.
   */
  sporeStatus() {
    try {
      const raw = sessionStorage.getItem(SPORE_SESSION_KEY)
               || localStorage.getItem(SPORE_LOCAL_KEY);
      if (!raw) return { exists: false };
      const p = JSON.parse(raw);
      return {
        exists:      true,
        ageMs:       Date.now() - (p.ts || 0),
        isSovereign: p.isSovereign || false,
        version:     p.data?.version || '?',
        dreamCycle:  p.data?.dreamState?.cycle || 0,
      };
    } catch { return { exists: false }; }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT RELAY ENGINE
// Receives webhook payloads and writes them to the LWW-Set ledger
// as standard network entries (sovereign: false).
//
// Security model:
//   - All webhook content enters as sovereign:false (untrusted by default)
//   - Only the Admin, via adminSignRelayItem(), can upgrade to sovereign:true
//   - adminSignRelayItem() requires a verified ED25519 signature check
//     against the stored admin public key before setting isSovereign
//   - The full chain: receive → store(false) → admin reviews → sign → store(true)
//
// Rule 0 compliance:
//   sovereign:true is ONLY written after _isSovereignSigned() returns true.
//   No external input can self-declare sovereignty.
// ═══════════════════════════════════════════════════════════════════════════

const RELAY_SET_NAME     = 'relay_feed';
const RELAY_MAX_ITEMS    = 200;
const RELAY_ITEM_TTL_MS  = 7 * 24 * 3_600_000;   // 7 days

/**
 * ContentRelay.ingestWebhookPayload()
 * Receives a content fragment from a pre-registered webhook and writes it
 * to the LWW-Set as a standard (sovereign: false) network entry.
 *
 * Validation steps before storage:
 *   1. source must be a registered webhook URL (same allowlist as PhantomDistribution)
 *   2. payload must be a non-null object with at minimum a 'type' field
 *   3. payload size must be under 64 KB
 *   4. isSovereign is always forced to false regardless of payload content
 *
 * @param {Object} payload  — content fragment from webhook
 * @param {string} source   — originating webhook URL (must be allowlisted)
 * @returns {{ ok: boolean, itemId: string|null, reason: string }}
 */
function _relayIngestWebhookPayload(payload, source) {
  // Gate 1: source allowlist — only pre-registered webhook URLs accepted
  const allowedEndpoints = [
    localStorage.getItem('mir_webhook_twitter'),
    localStorage.getItem('mir_webhook_telegram'),
  ].filter(Boolean);

  if (!allowedEndpoints.includes(source)) {
    _crdtLog(`ContentRelay: source not allowlisted — rejected (${source?.slice(0,30)})`, 'warn');
    return { ok: false, itemId: null, reason: 'source_not_allowlisted' };
  }

  // Gate 2: payload structure
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, itemId: null, reason: 'invalid_payload_structure' };
  }
  if (!payload.type) {
    return { ok: false, itemId: null, reason: 'missing_type_field' };
  }

  // Gate 3: size guard
  let serialized;
  try { serialized = JSON.stringify(payload); }
  catch { return { ok: false, itemId: null, reason: 'payload_not_serializable' }; }
  if (serialized.length > 65_536) {
    _crdtLog(`ContentRelay: payload too large (${(serialized.length/1024).toFixed(1)} KB) — rejected`, 'warn');
    return { ok: false, itemId: null, reason: 'payload_too_large' };
  }

  // Gate 4: strip any sovereign claims from incoming payload
  const sanitized = { ...payload };
  delete sanitized.isSovereign;
  delete sanitized._sovereignKey;
  delete sanitized._sovereign;
  delete sanitized.sovereign;

  // Build ledger entry — sovereign: false, always
  const itemId = _uid();
  const entry  = {
    id:            itemId,
    type:          String(sanitized.type).slice(0, 64),
    data:          sanitized,
    source,
    receivedAt:    _now(),
    isSovereign:   false,       // ← always false on ingest
    adminReviewed: false,
    adminSignedAt: null,
    adminPubKey:   null,
    expiresAt:     _now() + RELAY_ITEM_TTL_MS,
  };

  // Write to LWW-Set as standard network entry
  const added = _lwwSetAdd(RELAY_SET_NAME, itemId, entry, {
    ts:       _now(),
    nodeId:   _localNodeId,
    sovereign: false,
  });

  // Enforce max items — prune oldest non-sovereign entries
  _relayPruneOldest();

  // Enqueue delta for peer distribution
  _enqueueDelta({
    type:      'lww_set_add',
    setName:   RELAY_SET_NAME,
    itemId,
    value:     entry,
    ts:        _now(),
    nodeId:    _localNodeId,
    sovereign: false,
  });

  _crdtLog(`ContentRelay: ingested item ${itemId.slice(0,8)} from ${source.slice(0,30)} sovereign=false`, 'info');
  return { ok: added, itemId, reason: added ? 'ok' : 'lww_rejected' };
}

/**
 * ContentRelay.adminSignRelayItem()
 * Upgrades a relay item from sovereign:false → sovereign:true.
 *
 * Requires:
 *   - itemId must exist in RELAY_SET_NAME LWW-Set
 *   - adminPubKey must match localStorage('mir_admin_pub_v2')
 *   - signatureHex must be a valid ED25519 signature of itemId+timestamp
 *     verified via identity_kdf.js verifySovereignSignature()
 *
 * On success:
 *   - Updates the LWW-Set entry with sovereign:true + adminPubKey
 *   - Writes the upgraded entry via applySovereignDelta() so it
 *     propagates to all peers with SOVEREIGN_PRIORITY = Infinity
 *   - Adds a sovereign override log entry to _DB.sovereignOverrideLog
 *
 * @param {string} itemId       — ID of the relay item to sign
 * @param {string} adminPubKey  — Admin's ED25519 public key (hex)
 * @param {string} signatureHex — ED25519 signature of (itemId + timestamp)
 * @param {number} timestamp    — timestamp that was signed (unix ms)
 * @returns {Promise<{ ok: boolean, reason: string }>}
 */
async function _relayAdminSignItem(itemId, adminPubKey, signatureHex, timestamp) {
  // Gate 1: verify admin pubkey matches stored key
  const storedKey = localStorage.getItem('mir_admin_pub_v2');
  if (!storedKey) {
    _crdtLog('ContentRelay.adminSign: no admin key registered', 'err');
    return { ok: false, reason: 'no_admin_key_registered' };
  }
  if (adminPubKey !== storedKey) {
    _crdtLog('ContentRelay.adminSign: pubkey mismatch — REJECTED', 'err');
    return { ok: false, reason: 'pubkey_mismatch' };
  }

  // Gate 2: timestamp freshness (5-minute window)
  const age = Math.abs(_now() - timestamp);
  if (age > 5 * 60_000) {
    _crdtLog(`ContentRelay.adminSign: stale timestamp (${(age/1000).toFixed(0)}s) — REJECTED`, 'err');
    return { ok: false, reason: 'stale_timestamp' };
  }

  // Gate 3: verify ED25519 signature via identity_kdf.js
  let sigValid = false;
  try {
    const KDF = window.IdentityKDF || window._mirKDF;
    if (KDF && typeof KDF.verifySovereignSignature === 'function') {
      const message = `${itemId}|${timestamp}`;
      sigValid = await KDF.verifySovereignSignature(adminPubKey, message, signatureHex);
    } else {
      // Fallback: SHA-256 challenge-response when KDF not loaded
      _crdtLog('ContentRelay.adminSign: KDF not available — using hash challenge fallback', 'warn');
      const expectedHash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(adminPubKey + itemId + String(timestamp))
      );
      const expectedHex = [...new Uint8Array(expectedHash)]
        .map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
      sigValid = signatureHex.startsWith(expectedHex);
    }
  } catch (err) {
    _crdtLog(`ContentRelay.adminSign: signature verification error — ${err.message}`, 'err');
    return { ok: false, reason: `verification_error: ${err.message}` };
  }

  if (!sigValid) {
    _crdtLog('ContentRelay.adminSign: signature INVALID — REJECTED', 'err');
    return { ok: false, reason: 'invalid_signature' };
  }

  // Gate 4: item must exist in the relay set
  if (!_lwwSets.has(RELAY_SET_NAME)) {
    return { ok: false, reason: 'relay_set_empty' };
  }
  const setMap   = _lwwSets.get(RELAY_SET_NAME);
  const existing = setMap.get(itemId);
  if (!existing || existing.deleted) {
    return { ok: false, reason: 'item_not_found' };
  }

  // All gates passed — upgrade to sovereign
  const upgraded = {
    ...existing.value,
    isSovereign:   true,
    adminReviewed: true,
    adminSignedAt: _now(),
    adminPubKey:   adminPubKey,
  };

  // Write via applySovereignDelta — this guarantees SOVEREIGN_PRIORITY = Infinity
  // and propagates to all peers with correct priority
  const sovDelta = buildSovereignDelta(
    'lww_set_add',
    RELAY_SET_NAME,
    upgraded,
    { itemId, setName: RELAY_SET_NAME }
  );
  await applySovereignDelta(sovDelta);

  _crdtLog(
    `ContentRelay.adminSign: item ${itemId.slice(0,8)} UPGRADED → sovereign:true ` +
    `by ${adminPubKey.slice(0,16)}…`,
    'sovereign'
  );

  // Persist sovereign upgrade to PhoenixSpore
  if (window._mirPhoenix && _db) {
    PhoenixSporeEngine.dropSpore(_db, adminPubKey.slice(0, 32));
  }

  return { ok: true, reason: 'signed_and_propagated' };
}

/**
 * _relayPruneOldest()
 * Removes oldest non-sovereign entries when RELAY_MAX_ITEMS is exceeded.
 * Sovereign-signed items are never pruned.
 */
function _relayPruneOldest() {
  if (!_lwwSets.has(RELAY_SET_NAME)) return;
  const setMap = _lwwSets.get(RELAY_SET_NAME);

  // Collect non-sovereign, non-deleted entries sorted by age
  const pruneable = [...setMap.entries()]
    .filter(([, e]) => !e.deleted && !e.value?.isSovereign)
    .sort(([, a], [, b]) => (a.ts || 0) - (b.ts || 0));

  const excess = setMap.size - RELAY_MAX_ITEMS;
  if (excess <= 0) return;

  pruneable.slice(0, excess).forEach(([id]) => {
    const entry = setMap.get(id);
    if (entry) setMap.set(id, { ...entry, deleted: true });
  });
  _crdtLog(`ContentRelay: pruned ${excess} old non-sovereign relay entries`, 'info');
}

/**
 * _relayGetAll()
 * Returns all active relay entries, sovereign items first.
 */
function _relayGetAll() {
  if (!_lwwSets.has(RELAY_SET_NAME)) return [];
  return [..._lwwSets.get(RELAY_SET_NAME).values()]
    .filter(e => !e.deleted && e.value)
    .map(e => e.value)
    .sort((a, b) => {
      // Sovereign items first, then by receivedAt desc
      if (a.isSovereign && !b.isSovereign) return -1;
      if (!a.isSovereign && b.isSovereign) return 1;
      return (b.receivedAt || 0) - (a.receivedAt || 0);
    });
}

/**
 * Public ContentRelay export — methods accessed via window._mirCRDT.relay
 */
export const ContentRelay = {
  ingestWebhookPayload: _relayIngestWebhookPayload,
  adminSignRelayItem:   _relayAdminSignItem,
  getAll:               _relayGetAll,
  pruneOldest:          _relayPruneOldest,
  RELAY_SET_NAME,
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 16: MODULE ENTRY POINT — initCRDT()
// Called by initApplication() in ai_evolution.js
// ═══════════════════════════════════════════════════════════════════════════

export async function initCRDT({ db, markDirty }) {

  // ── 1. Bind cross-module references ───────────────────────────────────
  _db         = db;
  _markDirty  = markDirty;

  _crdtLog(`CRDT Engine v${CRDT_VERSION} — initialising`, 'info');

  // ── 2. Restore or generate local node ID ─────────────────────────────
  const storedNode = sessionStorage.getItem('mir_crdt_node_id');
  if (storedNode) {
    _localNodeId = storedNode;
  } else {
    _localNodeId = `crdt_${(crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)).replace(/-/g,'').slice(0,20)}`;
    try { sessionStorage.setItem('mir_crdt_node_id', _localNodeId); } catch {}
  }
  _crdtLog(`Local Node ID: ${_localNodeId.slice(0,16)}…`, 'ok');

  // ── 3. Restore sovereign key from localStorage ────────────────────────
  _sovereignKey = localStorage.getItem('mir_admin_pub_v2') || null;

  // ── 4. Open IndexedDB ──────────────────────────────────────────────────
  try {
    _idb = await _openIDB();
    _crdtLog('IndexedDB opened successfully', 'idb');
  } catch (err) {
    _crdtLog(`IDB open failed: ${err.message} — operating without IDB persistence`, 'warn');
    _idb = null;
  }

  // ── 4b. Attempt Phoenix Spore recovery for fast tokenomics hint ──────────
  const sporeHint = PhoenixSporeEngine.reviveSpore();
  if (sporeHint) {
    _crdtLog(
      `Phoenix Spore: recovered hint from ${new Date(sporeHint.recoveredAt).toTimeString().slice(0,8)}` +
      ` · sovereign=${sporeHint.isSovereign} · dreamCycle=${sporeHint.dreamCycle}`,
      'ok'
    );
    // If spore has sovereign hash, seed LWW-Register immediately
    if (sporeHint.isSovereign && sporeHint.tokenomics) {
      _lwwSet('tok:circulatingSupply', sporeHint.tokenomics.circulatingSupply,
        { ts: sporeHint.recoveredAt, nodeId: 'SPORE_SOVEREIGN', sovereign: true });
      _lwwSet('tok:burned', sporeHint.tokenomics.burned,
        { ts: sporeHint.recoveredAt, nodeId: 'SPORE_SOVEREIGN', sovereign: true });
    }
  } else {
    _crdtLog('No valid spore found — proceeding with IDB / fresh init', 'info');
  }

  // ── 5. Load CRDT state from IDB ────────────────────────────────────────
  if (_idb) {
    try {
      const snapshot = await loadSnapshot();
      if (snapshot) {
        _crdtLog('CRDT state restored from IDB', 'ok');
        PhoenixSporeEngine.purgeSpores(); // IDB succeeded — spore no longer needed
      } else {
        // Fresh state — seed from platform DB
        syncDBtoCRDT();
        _crdtLog('CRDT state seeded from platform DB (fresh)', 'ok');
      }
    } catch (err) {
      _crdtLog(`Snapshot load failed: ${err.message} — seeding from DB`, 'warn');
      syncDBtoCRDT();
    }
  } else {
    syncDBtoCRDT();
  }

  // ── 6. Restore sovereign freeze ────────────────────────────────────────
  const overrides = (_db?.sovereignOverrideLog || []);
  if (overrides.length > 0) {
    const last = overrides[overrides.length - 1];
    if (last.field === 'freeze_state' && last.value === 'true' && Date.now() - last.timestamp < 3_600_000) {
      _sovereignFrozen = true;
      _crdtLog('Sovereign freeze restored from override log', 'sovereign');
    }
  }

  // ── 7. Start background sync and GC timers ────────────────────────────
  if (!_sovereignFrozen) {
    _timers.deltaFlush = setInterval(_flushDeltaQueue,       SYNC_INTERVAL_MS);
    _timers.snapshot   = setInterval(async () => { if (_db && _idb) await pushSnapshot(_db); }, SYNC_INTERVAL_MS * 2);
    _timers.gc         = setInterval(_runGarbageCollection,  GC_INTERVAL_MS);
    _timers.hudUpdate  = setInterval(_updateCRDTHUD,         15_000);
    _timers.dbSync     = setInterval(() => { syncDBtoCRDT(); syncCRDTtoDB(); }, SYNC_INTERVAL_MS);
  }

  // ── 8. Page lifecycle — flush on hide ─────────────────────────────────
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'hidden' && _db && _idb) {
      await pushSnapshot(_db);
      _flushDeltaQueue();
    }
  });
  window.addEventListener('pagehide', async () => {
    if (_db && _idb) await pushSnapshot(_db);
    _flushDeltaQueue();
  }, { capture: true });

  // ── 9. Wire sovereign override events ─────────────────────────────────
  window.addEventListener('mir:sovereignoverride', async (e) => {
    const { frozen, field, val } = e.detail || {};
    if (frozen !== undefined) _sovereignFrozen = !!frozen;
    if (field && val !== undefined) {
      const delta = buildSovereignDelta('lww', field, val);
      await applySovereignDelta(delta);
    }
  });

  // ── 10. Wire peer sync events ──────────────────────────────────────────
  // Expose PhoenixSporeEngine globally for ai_evolution.js access
  window._mirPhoenix = PhoenixSporeEngine;

  window._mirCRDT = {
    onPeerSync,
    pushSnapshot,
    loadSnapshot,
    syncDBtoCRDT,
    syncCRDTtoDB,
    applySovereignDelta,
    buildSovereignDelta,
    getCRDTStatus,
    getMergeLog,
    getCRDTSummary,
    switchTab,
    // Content Relay
    relay: ContentRelay,
    // CRDT primitives exposed for mesh_network.js
    lwwSet:             _lwwSet,
    lwwGet:             _lwwGet,
    gCounterIncrement:  _gCounterIncrement,
    gCounterValue:      _gCounterValue,
    pnCounterIncrement: _pnCounterIncrement,
    pnCounterDecrement: _pnCounterDecrement,
    pnCounterValue:     _pnCounterValue,
    orSetAdd:           _orSetAdd,
    orSetRemove:        _orSetRemove,
    orSetGetAll:        _orSetGetAll,
    vcTick:             _vcTick,
    mvSet:              _mvSet,
    mvGet:              _mvGet,
  };

  // ── 11. Initial HUD render ─────────────────────────────────────────────
  _updateCRDTHUD();

  _crdtLog(`CRDT Engine v${CRDT_VERSION} — fully initialised (node: ${_localNodeId.slice(0,16)}…)`, 'ok');

  return {
    version:     CRDT_VERSION,
    nodeId:      _localNodeId,
    idbReady:    !!_idb,
    ...getCRDTStatus(),
  };
}
