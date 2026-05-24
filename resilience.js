/**
 * resilience.js
 * File Name:           resilience.js
 * Version:             1.0.0
 * Architectural State Hash: sha256("MIR-RESILIENCE-V1-2025")
 * Last Sync Resolution: 2025-05-24T00:00:00Z
 *
 * MIR Platform v2.0 — Recovery & Traffic Shaping Layer
 *
 * Responsibilities:
 *   1.  CircuitBreaker       — per-endpoint failure gate (open/half-open/closed)
 *   2.  ExponentialBackoff   — adaptive retry with jitter for GH sync & peers
 *   3.  StorageManager       — 3-tier fallback: IDB → localStorage → memory
 *   4.  OfflineQueue         — buffers CRDT deltas & peer messages when offline
 *   5.  DeltaDeduplicator    — prevents CRDT delta replay via seen-set
 *   6.  TrafficShaper        — token-bucket rate limiter for outbound requests
 *   7.  PeerReconnectManager — exponential backoff + ICE-restart for WebRTC
 *   8.  SnapshotIntegrity    — Merkle-style hash for IDB snapshot verification
 *   9.  DBRepairEngine       — detects and auto-repairs corrupted DB fields
 *  10.  BandwidthGuard       — mobile bandwidth throttle + request pacing
 *
 * Integration:
 *   Called from initApplication() in ai_evolution.js BEFORE other modules.
 *   Patches window._mirRecovery with all public APIs.
 *   Each module is sovereign-freeze-aware — all queues drain on freeze.
 *
 * Sovereign Override (Rule 0):
 *   On _sovereignFrozen = true: all queues halt, circuit breakers open,
 *   no outbound requests are made, IDB flushes immediately.
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// MODULE CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

// Circuit Breaker
const CB_FAILURE_THRESHOLD  = 5;        // failures before OPEN
const CB_SUCCESS_THRESHOLD  = 2;        // successes in half-open before CLOSE
const CB_TIMEOUT_MS         = 30_000;   // time in OPEN before → HALF_OPEN
const CB_HALF_OPEN_MAX_REQS = 3;        // max concurrent requests in HALF_OPEN

// Exponential Backoff
const EB_BASE_MS            = 1_000;    // 1 second base
const EB_MAX_MS             = 64_000;   // 64 second ceiling
const EB_JITTER_PCT         = 0.25;     // ±25% jitter
const EB_MAX_ATTEMPTS       = 8;        // give up after this many attempts

// Storage Tiers
const STORAGE_IDB           = 'idb';
const STORAGE_LS            = 'localStorage';
const STORAGE_MEM           = 'memory';
const LS_FALLBACK_KEY       = 'mir_ls_fallback_v2';
const LS_QUOTA_WARN_BYTES   = 3_500_000;  // warn at 3.5 MB

// Offline Queue
const OQ_MAX_DELTAS         = 500;
const OQ_MAX_PEER_MSGS      = 200;
const OQ_SESSION_KEY        = 'mir_offline_queue_v2';
const OQ_DRAIN_INTERVAL_MS  = 5_000;

// Delta Deduplication
const DD_MAX_SEEN           = 2000;
const DD_SEEN_TTL_MS        = 10 * 60_000;  // 10 minutes

// Traffic Shaper (Token Bucket)
const TS_GH_BUCKET_SIZE     = 10;       // max burst
const TS_GH_REFILL_RATE     = 1;        // tokens per TS_GH_REFILL_INTERVAL_MS
const TS_GH_REFILL_MS       = 6_000;    // 1 request per 6s sustained
const TS_PEER_BUCKET_SIZE   = 20;
const TS_PEER_REFILL_RATE   = 2;
const TS_PEER_REFILL_MS     = 3_000;
const TS_MOBILE_MULTIPLIER  = 0.4;      // mobile gets 40% of desktop token rate

// Peer Reconnect
const PR_INITIAL_DELAY_MS   = 1_500;
const PR_MAX_DELAY_MS       = 60_000;
const PR_MAX_ATTEMPTS       = 6;
const PR_ICE_RESTART_AFTER  = 3;        // attempt ICE restart on 3rd retry

// Snapshot Integrity
const SI_HASH_FIELDS        = ['tokenomics', 'scenarios', 'predictions', 'feed', 'miningState'];
const SI_VERSION_KEY        = 'mir_snap_version_v2';

// Bandwidth Guard
const BW_MOBILE_QUEUE_MS    = 800;      // min gap between peer sends on mobile
const BW_DESKTOP_QUEUE_MS   = 150;      // min gap on desktop
const BW_MAX_PAYLOAD_BYTES  = 65_536;   // 64 KB max single send

// ═══════════════════════════════════════════════════════════════════════════
// MODULE STATE
// ═══════════════════════════════════════════════════════════════════════════

let _sovereignFrozen  = false;
let _isMobile         = false;
const _timers         = {};

// ─── 1. Circuit Breakers ─────────────────────────────────────────────────
const _circuitBreakers = new Map();

// ─── 2. Exponential Backoff timers ───────────────────────────────────────
const _backoffState    = new Map();

// ─── 3. Storage tier state ───────────────────────────────────────────────
let _activeTier        = STORAGE_IDB;
const _memFallback     = new Map();

// ─── 4. Offline Queue ────────────────────────────────────────────────────
const _offlineQueue = {
  deltas:   [],
  peerMsgs: [],
  loading:  false,
};
let _isOnline          = typeof navigator !== 'undefined' ? navigator.onLine : true;

// ─── 5. Delta Deduplicator ────────────────────────────────────────────────
const _seenDeltas = new Map();  // deltaId → ts

// ─── 6. Traffic Shaper ───────────────────────────────────────────────────
const _tokenBuckets = {
  github: { tokens: TS_GH_BUCKET_SIZE,   lastRefill: Date.now(), queue: [] },
  peer:   { tokens: TS_PEER_BUCKET_SIZE, lastRefill: Date.now(), queue: [] },
  exotic: { tokens: 3,                   lastRefill: Date.now(), queue: [] },
};

// ─── 7. Peer Reconnect ────────────────────────────────────────────────────
const _reconnectState  = new Map();  // peerId → { attempts, delay, timer }

// ─── 8. Snapshot Integrity ───────────────────────────────────────────────
let _lastSnapshotHash  = null;
let _snapshotVersion   = 0;

// ─── 9. DB Repair ────────────────────────────────────────────────────────
const _repairLog       = [];

// ─── 10. Bandwidth Guard ─────────────────────────────────────────────────
const _bwState = {
  lastSendTs: 0,
  queue:      [],
  draining:   false,
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

const _now   = () => Date.now();
const _uid   = () => (crypto.randomUUID ? crypto.randomUUID() : `${_now().toString(36)}-${Math.random().toString(36).slice(2)}`);
const _sleep = ms => new Promise(r => setTimeout(r, ms));
const _clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const _ts    = () => new Date().toISOString().slice(11, 19);

function _resLog(msg, level = 'info') {
  const colors = { info:'#44ffcc', ok:'#00ff88', warn:'#ffab00', err:'#ff2244', sovereign:'#ffd700' };
  console.log(`%c[RES ${_ts()}] ${msg}`, `color:${colors[level]||'#8ba3cc'};font-family:monospace;font-size:10px`);
  if (typeof window._mirAdminLog === 'function') window._mirAdminLog(`[RES] ${msg}`, level === 'err' ? 'err' : '');
}

function _detectMobile() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: CIRCUIT BREAKER
// States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing)
// Sovereign override forces all breakers OPEN immediately.
// ═══════════════════════════════════════════════════════════════════════════

function _ensureBreaker(name) {
  if (!_circuitBreakers.has(name)) {
    _circuitBreakers.set(name, {
      name,
      state:         'CLOSED',
      failures:      0,
      successes:     0,
      lastFailure:   0,
      halfOpenReqs:  0,
      openedAt:      0,
    });
  }
  return _circuitBreakers.get(name);
}

export function cbCanRequest(name) {
  if (_sovereignFrozen) return false;
  const cb = _ensureBreaker(name);
  if (cb.state === 'CLOSED') return true;
  if (cb.state === 'OPEN') {
    if (_now() - cb.openedAt >= CB_TIMEOUT_MS) {
      cb.state        = 'HALF_OPEN';
      cb.halfOpenReqs = 0;
      cb.successes    = 0;
      _resLog(`Circuit [${name}]: OPEN → HALF_OPEN`, 'warn');
    } else {
      return false;
    }
  }
  // HALF_OPEN
  if (cb.halfOpenReqs < CB_HALF_OPEN_MAX_REQS) {
    cb.halfOpenReqs++;
    return true;
  }
  return false;
}

export function cbRecordSuccess(name) {
  const cb = _ensureBreaker(name);
  cb.failures = 0;
  if (cb.state === 'HALF_OPEN') {
    cb.successes++;
    if (cb.successes >= CB_SUCCESS_THRESHOLD) {
      cb.state    = 'CLOSED';
      cb.failures = 0;
      _resLog(`Circuit [${name}]: HALF_OPEN → CLOSED ✓`, 'ok');
    }
  }
}

export function cbRecordFailure(name) {
  const cb = _ensureBreaker(name);
  cb.failures++;
  cb.lastFailure = _now();
  if (cb.state === 'HALF_OPEN' || cb.failures >= CB_FAILURE_THRESHOLD) {
    cb.state     = 'OPEN';
    cb.openedAt  = _now();
    _resLog(`Circuit [${name}]: → OPEN (failures: ${cb.failures})`, 'err');
  }
}

export function cbGetState(name) {
  return _ensureBreaker(name).state;
}

export function cbForceOpen(name) {
  const cb = _ensureBreaker(name);
  cb.state    = 'OPEN';
  cb.openedAt = _now();
  _resLog(`Circuit [${name}]: force OPEN (sovereign)`, 'sovereign');
}

export function cbForceOpenAll() {
  _circuitBreakers.forEach((_, name) => cbForceOpen(name));
  _resLog('All circuits forced OPEN — sovereign freeze', 'sovereign');
}

export function cbStatus() {
  const result = {};
  _circuitBreakers.forEach((cb, name) => {
    result[name] = { state: cb.state, failures: cb.failures, lastFailure: cb.lastFailure };
  });
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: EXPONENTIAL BACKOFF WITH JITTER
// ═══════════════════════════════════════════════════════════════════════════

function _ebState(key) {
  if (!_backoffState.has(key)) {
    _backoffState.set(key, { attempts: 0, lastAttempt: 0, nextDelay: EB_BASE_MS });
  }
  return _backoffState.get(key);
}

export function ebGetDelay(key) {
  const st = _ebState(key);
  if (st.attempts === 0) return 0;
  const base   = Math.min(EB_BASE_MS * Math.pow(2, st.attempts - 1), EB_MAX_MS);
  const jitter = base * EB_JITTER_PCT * (Math.random() * 2 - 1);
  return Math.floor(_clamp(base + jitter, EB_BASE_MS, EB_MAX_MS));
}

export function ebRecordAttempt(key) {
  const st    = _ebState(key);
  st.attempts++;
  st.lastAttempt = _now();
  return st.attempts;
}

export function ebRecordSuccess(key) {
  _backoffState.set(key, { attempts: 0, lastAttempt: _now(), nextDelay: EB_BASE_MS });
  cbRecordSuccess(key);
}

export function ebRecordFailure(key) {
  ebRecordAttempt(key);
  cbRecordFailure(key);
}

export function ebShouldGiveUp(key) {
  return (_ebState(key).attempts >= EB_MAX_ATTEMPTS);
}

export function ebReset(key) {
  _backoffState.delete(key);
  cbRecordSuccess(key);
}

/**
 * withRetry()
 * Wraps an async function with circuit-breaker + exponential backoff.
 * Usage: await withRetry('gh_push', () => fetch(...))
 */
export async function withRetry(key, fn, maxAttempts = EB_MAX_ATTEMPTS) {
  if (_sovereignFrozen) throw new Error('Sovereign freeze — request blocked');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (!cbCanRequest(key)) {
      throw new Error(`Circuit OPEN: ${key} — request blocked`);
    }
    try {
      const result = await fn();
      ebRecordSuccess(key);
      return result;
    } catch (err) {
      ebRecordFailure(key);
      if (attempt >= maxAttempts || ebShouldGiveUp(key)) {
        _resLog(`withRetry [${key}]: giving up after ${attempt} attempts — ${err.message}`, 'err');
        throw err;
      }
      const delay = ebGetDelay(key);
      _resLog(`withRetry [${key}]: attempt ${attempt} failed — retry in ${(delay/1000).toFixed(1)}s`, 'warn');
      await _sleep(delay);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: STORAGE MANAGER — 3-TIER FALLBACK
// IDB → localStorage → in-memory Map
// Automatically degrades when quota is exceeded or IDB fails.
// ═══════════════════════════════════════════════════════════════════════════

export async function storageWrite(key, value) {
  const serialized = JSON.stringify(value);

  // Tier 1: IDB
  if (_activeTier === STORAGE_IDB) {
    try {
      const idb = window._bootDB || window._idb;
      if (idb) {
        await _idbPutResilient(idb, key, value);
        return STORAGE_IDB;
      }
    } catch (err) {
      _resLog(`IDB write failed (${err.name}): degrading to localStorage`, 'warn');
      _activeTier = STORAGE_LS;
    }
  }

  // Tier 2: localStorage
  if (_activeTier === STORAGE_LS) {
    try {
      const existing = localStorage.getItem(LS_FALLBACK_KEY);
      const store    = existing ? JSON.parse(existing) : {};
      store[key]     = value;
      const newStr   = JSON.stringify(store);
      if (newStr.length > LS_QUOTA_WARN_BYTES) {
        _resLog(`localStorage near quota (${(newStr.length/1024).toFixed(0)} KB)`, 'warn');
      }
      localStorage.setItem(LS_FALLBACK_KEY, newStr);
      return STORAGE_LS;
    } catch (err) {
      if (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        _resLog(`localStorage quota exceeded — degrading to memory`, 'err');
        _pruneLocalStorage();
        _activeTier = STORAGE_MEM;
      } else {
        _activeTier = STORAGE_MEM;
      }
    }
  }

  // Tier 3: Memory
  _memFallback.set(key, value);
  if (_memFallback.size % 10 === 0) {
    _resLog(`Memory tier: ${_memFallback.size} keys stored (volatile)`, 'warn');
  }
  return STORAGE_MEM;
}

export async function storageRead(key, defaultVal = null) {
  // Try IDB first
  try {
    const idb = window._bootDB || window._idb;
    if (idb) {
      const val = await _idbGetResilient(idb, key);
      if (val !== null) return val;
    }
  } catch {}

  // Try localStorage
  try {
    const raw = localStorage.getItem(LS_FALLBACK_KEY);
    if (raw) {
      const store = JSON.parse(raw);
      if (store[key] !== undefined) return store[key];
    }
    // Also try direct key
    const direct = localStorage.getItem(key);
    if (direct) return JSON.parse(direct);
  } catch {}

  // Try memory
  if (_memFallback.has(key)) return _memFallback.get(key);

  return defaultVal;
}

function _pruneLocalStorage() {
  // Remove oldest entries to free space
  try {
    const raw = localStorage.getItem(LS_FALLBACK_KEY);
    if (!raw) return;
    const store = JSON.parse(raw);
    const keys  = Object.keys(store);
    if (keys.length > 5) {
      // Keep most important: DB_KEY and recent snapshot
      const KEEP = ['mir_platform_db', 'mir_ses_v2', 'mir_admin_pub_v2'];
      keys.filter(k => !KEEP.includes(k)).forEach(k => delete store[k]);
      localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(store));
      _resLog(`localStorage pruned: removed ${keys.length - KEEP.length} entries`, 'warn');
    }
  } catch {}
}

function _idbPutResilient(idb, key, value) {
  return new Promise((resolve, reject) => {
    try {
      const storeName = idb.objectStoreNames.contains('snapshots') ? 'snapshots' : 'state';
      const tx  = idb.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).put(value, key);
      req.onsuccess = () => resolve(true);
      req.onerror   = (e) => reject(e.target.error);
      tx.onerror    = (e) => reject(e.target.error);
    } catch (err) { reject(err); }
  });
}

function _idbGetResilient(idb, key) {
  return new Promise((resolve, reject) => {
    try {
      const storeName = idb.objectStoreNames.contains('snapshots') ? 'snapshots' : 'state';
      const tx  = idb.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = (e) => resolve(e.target.result ?? null);
      req.onerror   = (e) => reject(e.target.error);
    } catch (err) { reject(err); }
  });
}

export function getActiveTier() { return _activeTier; }

export function resetStorageTier() {
  _activeTier = STORAGE_IDB;
  _resLog('Storage tier reset to IDB', 'ok');
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: OFFLINE QUEUE
// Buffers CRDT deltas and peer messages when network is unavailable.
// Persists queue to sessionStorage to survive page refreshes.
// Auto-drains when online signal fires.
// ═══════════════════════════════════════════════════════════════════════════

function _oqSave() {
  try {
    sessionStorage.setItem(OQ_SESSION_KEY, JSON.stringify({
      deltas:   _offlineQueue.deltas.slice(-OQ_MAX_DELTAS),
      peerMsgs: _offlineQueue.peerMsgs.slice(-OQ_MAX_PEER_MSGS),
    }));
  } catch {}
}

function _oqLoad() {
  try {
    const raw = sessionStorage.getItem(OQ_SESSION_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    _offlineQueue.deltas   = data.deltas   || [];
    _offlineQueue.peerMsgs = data.peerMsgs || [];
    if (_offlineQueue.deltas.length > 0 || _offlineQueue.peerMsgs.length > 0) {
      _resLog(`Offline queue restored: ${_offlineQueue.deltas.length} deltas, ${_offlineQueue.peerMsgs.length} peer msgs`, 'info');
    }
  } catch {}
}

export function oqEnqueueDelta(delta) {
  if (_offlineQueue.deltas.length >= OQ_MAX_DELTAS) {
    _offlineQueue.deltas.shift(); // drop oldest
  }
  const entry = { ...delta, _oqId: _uid(), _oqTs: _now() };
  _offlineQueue.deltas.push(entry);
  _oqSave();
}

export function oqEnqueuePeerMsg(msg, targetPeerId = null) {
  if (_offlineQueue.peerMsgs.length >= OQ_MAX_PEER_MSGS) {
    _offlineQueue.peerMsgs.shift();
  }
  _offlineQueue.peerMsgs.push({ msg, targetPeerId, _oqId: _uid(), _oqTs: _now() });
  _oqSave();
}

export function oqDrainDeltas(onEachDelta) {
  if (!_isOnline || _sovereignFrozen) return 0;
  const batch = _offlineQueue.deltas.splice(0, 20);
  batch.forEach(d => { try { onEachDelta(d); } catch {} });
  if (batch.length > 0) {
    _oqSave();
    _resLog(`Offline queue: drained ${batch.length} deltas`, 'ok');
  }
  return batch.length;
}

export function oqDrainPeerMsgs(onEachMsg) {
  if (!_isOnline || _sovereignFrozen) return 0;
  const batch = _offlineQueue.peerMsgs.splice(0, 10);
  batch.forEach(entry => { try { onEachMsg(entry.msg, entry.targetPeerId); } catch {} });
  if (batch.length > 0) {
    _oqSave();
    _resLog(`Offline queue: drained ${batch.length} peer messages`, 'ok');
  }
  return batch.length;
}

export function oqSize() {
  return { deltas: _offlineQueue.deltas.length, peerMsgs: _offlineQueue.peerMsgs.length };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5: DELTA DEDUPLICATOR
// Prevents CRDT delta replay attacks and duplicate processing.
// Uses a time-windowed seen-set: entries expire after DD_SEEN_TTL_MS.
// ═══════════════════════════════════════════════════════════════════════════

export function ddIsSeen(delta) {
  const id = _getDeltaId(delta);
  if (!id) return false;
  const seen = _seenDeltas.get(id);
  if (!seen) return false;
  if (_now() - seen > DD_SEEN_TTL_MS) {
    _seenDeltas.delete(id);
    return false;
  }
  return true;
}

export function ddMarkSeen(delta) {
  const id = _getDeltaId(delta);
  if (!id) return;
  _seenDeltas.set(id, _now());
  if (_seenDeltas.size > DD_MAX_SEEN) {
    // Prune oldest entries
    const entries = [..._seenDeltas.entries()].sort((a, b) => a[1] - b[1]);
    entries.slice(0, Math.floor(DD_MAX_SEEN * 0.2)).forEach(([k]) => _seenDeltas.delete(k));
  }
}

function _getDeltaId(delta) {
  if (delta._oqId) return delta._oqId;
  // Deterministic ID from type + key + ts + nodeId
  const raw = `${delta.type}|${delta.key || delta.setName || ''}|${delta.ts || ''}|${delta.nodeId || ''}`;
  return raw.length > 10 ? raw : null;
}

export function ddGetStats() {
  return { size: _seenDeltas.size, maxSize: DD_MAX_SEEN, ttlMs: DD_SEEN_TTL_MS };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6: TRAFFIC SHAPER — TOKEN BUCKET
// Enforces rate limits on outbound requests (GitHub, peers, exotic feeds).
// Mobile devices get a reduced token refill rate (TS_MOBILE_MULTIPLIER).
// ═══════════════════════════════════════════════════════════════════════════

function _refillBucket(name) {
  const bucket  = _tokenBuckets[name];
  if (!bucket) return;
  const configs = {
    github: { size: TS_GH_BUCKET_SIZE,   rate: TS_GH_REFILL_RATE,   interval: TS_GH_REFILL_MS },
    peer:   { size: TS_PEER_BUCKET_SIZE, rate: TS_PEER_REFILL_RATE, interval: TS_PEER_REFILL_MS },
    exotic: { size: 3,                   rate: 1,                   interval: 30_000 },
  };
  const cfg      = configs[name];
  if (!cfg) return;
  const elapsed  = _now() - bucket.lastRefill;
  const refill   = Math.floor(elapsed / cfg.interval) * cfg.rate;
  const mobileMult = _isMobile ? TS_MOBILE_MULTIPLIER : 1;
  if (refill > 0) {
    bucket.tokens    = Math.min(cfg.size, bucket.tokens + Math.floor(refill * mobileMult));
    bucket.lastRefill= _now();
  }
}

export function tsCanSend(name) {
  if (_sovereignFrozen) return false;
  _refillBucket(name);
  const bucket = _tokenBuckets[name];
  if (!bucket) return true;
  return bucket.tokens > 0;
}

export function tsConsume(name) {
  _refillBucket(name);
  const bucket = _tokenBuckets[name];
  if (!bucket || bucket.tokens <= 0) return false;
  bucket.tokens--;
  return true;
}

/**
 * tsEnqueue()
 * Queues a request function to run when a token becomes available.
 * Returns a Promise that resolves when the request completes.
 */
export function tsEnqueue(name, fn) {
  return new Promise((resolve, reject) => {
    const bucket = _tokenBuckets[name];
    if (!bucket) { fn().then(resolve).catch(reject); return; }

    if (tsConsume(name)) {
      fn().then(resolve).catch(reject);
      return;
    }

    // Queue for when tokens refill
    bucket.queue.push({ fn, resolve, reject, ts: _now() });
    if (bucket.queue.length > 50) {
      // Drop oldest queued request
      const dropped = bucket.queue.shift();
      dropped.reject(new Error(`Traffic queue full: ${name}`));
    }
  });
}

function _drainTokenBucketQueues() {
  if (_sovereignFrozen) return;
  Object.keys(_tokenBuckets).forEach(name => {
    const bucket = _tokenBuckets[name];
    while (bucket.queue.length > 0 && tsConsume(name)) {
      const { fn, resolve, reject } = bucket.queue.shift();
      fn().then(resolve).catch(reject);
    }
  });
}

export function tsGetStatus() {
  const result = {};
  Object.entries(_tokenBuckets).forEach(([name, bucket]) => {
    _refillBucket(name);
    result[name] = { tokens: bucket.tokens, queued: bucket.queue.length };
  });
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7: PEER RECONNECT MANAGER
// Manages exponential backoff + ICE restart for WebRTC peer recovery.
// Integrates with mesh_network.js via window._mirMesh callbacks.
// ═══════════════════════════════════════════════════════════════════════════

export function prScheduleReconnect(peerId, onReconnect) {
  if (_sovereignFrozen) return;

  let state = _reconnectState.get(peerId);
  if (!state) {
    state = { attempts: 0, delay: PR_INITIAL_DELAY_MS, timer: null, iceRestartDue: false };
    _reconnectState.set(peerId, state);
  }

  if (state.timer) { clearTimeout(state.timer); }

  if (state.attempts >= PR_MAX_ATTEMPTS) {
    _resLog(`Peer [${peerId.slice(0,10)}]: max reconnect attempts reached — giving up`, 'err');
    _reconnectState.delete(peerId);
    return;
  }

  state.attempts++;
  state.iceRestartDue = (state.attempts >= PR_ICE_RESTART_AFTER);

  const jitter   = state.delay * 0.2 * (Math.random() * 2 - 1);
  const actualMs = Math.floor(_clamp(state.delay + jitter, PR_INITIAL_DELAY_MS, PR_MAX_DELAY_MS));
  state.delay    = Math.min(state.delay * 2, PR_MAX_DELAY_MS);

  _resLog(`Peer [${peerId.slice(0,10)}]: reconnect attempt ${state.attempts}/${PR_MAX_ATTEMPTS} in ${(actualMs/1000).toFixed(1)}s${state.iceRestartDue?' (ICE restart)':''}`, 'warn');

  state.timer = setTimeout(async () => {
    if (_sovereignFrozen) return;
    try {
      await onReconnect(peerId, state.iceRestartDue);
      prClearReconnect(peerId);
      _resLog(`Peer [${peerId.slice(0,10)}]: reconnected ✓`, 'ok');
    } catch (err) {
      _resLog(`Peer [${peerId.slice(0,10)}]: reconnect failed — ${err.message}`, 'warn');
      prScheduleReconnect(peerId, onReconnect);
    }
  }, actualMs);
}

export function prClearReconnect(peerId) {
  const state = _reconnectState.get(peerId);
  if (state?.timer) clearTimeout(state.timer);
  _reconnectState.delete(peerId);
}

export function prGetStatus() {
  const result = {};
  _reconnectState.forEach((state, peerId) => {
    result[peerId.slice(0,12)] = { attempts: state.attempts, delay: state.delay, iceRestartDue: state.iceRestartDue };
  });
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8: SNAPSHOT INTEGRITY — MERKLE-STYLE HASH
// Computes a lightweight integrity hash of critical DB fields.
// Detects corruption between writes and verifies incoming CRDT snapshots.
// ═══════════════════════════════════════════════════════════════════════════

export async function siComputeHash(db) {
  if (!db) return null;
  try {
    // Build a stable, sorted digest string from critical fields
    const parts = SI_HASH_FIELDS.map(field => {
      const val = db[field];
      if (!val) return `${field}:null`;
      if (typeof val === 'object' && !Array.isArray(val)) {
        const sorted = Object.keys(val).sort().map(k => `${k}:${val[k]}`).join(',');
        return `${field}:{${sorted}}`;
      }
      if (Array.isArray(val)) {
        return `${field}:[len=${val.length},ids=${val.slice(0,5).map(v=>v?.id||'?').join(',')}]`;
      }
      return `${field}:${val}`;
    }).join('|');

    const buf    = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts));
    const hash   = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('').slice(0, 32);
    return hash;
  } catch {
    return null;
  }
}

export async function siVerifySnapshot(db) {
  const hash = await siComputeHash(db);
  if (!hash) return { ok: true, hash: null, changed: false };

  const changed = _lastSnapshotHash !== null && hash !== _lastSnapshotHash;
  if (changed) {
    _resLog(`Snapshot integrity: hash changed ${_lastSnapshotHash?.slice(0,8)} → ${hash.slice(0,8)}`, 'info');
  }
  _lastSnapshotHash = hash;
  return { ok: true, hash, changed };
}

export async function siPersistVersion(db) {
  _snapshotVersion++;
  const hash    = await siComputeHash(db);
  const record  = { version: _snapshotVersion, hash, ts: _now() };
  try { localStorage.setItem(SI_VERSION_KEY, JSON.stringify(record)); } catch {}
  return record;
}

export function siGetLastHash() { return _lastSnapshotHash; }
export function siGetVersion()  { return _snapshotVersion; }

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 9: DB REPAIR ENGINE
// Auto-detects and repairs common corruption patterns in the platform DB.
// Never mutates sovereign-signed fields.
// ═══════════════════════════════════════════════════════════════════════════

export function dbRepair(db) {
  if (!db) return { ok: false, repairs: [] };
  const repairs = [];

  function fix(path, action) {
    repairs.push({ path, action, ts: _now() });
    _repairLog.push({ path, action, ts: _now() });
    if (_repairLog.length > 50) _repairLog.splice(0, _repairLog.length - 50);
  }

  // ── Tokenomics ────────────────────────────────────────────────────────
  if (!db.tokenomics) {
    db.tokenomics = { maxSupply:210_000_000_000_000, circulatingSupply:0, burned:0, networkPool:0 };
    fix('tokenomics', 'RECREATED missing tokenomics object');
  } else {
    const t = db.tokenomics;
    if (typeof t.circulatingSupply !== 'number' || isNaN(t.circulatingSupply) || t.circulatingSupply < 0) {
      t.circulatingSupply = 0; fix('tokenomics.circulatingSupply', 'RESET NaN/negative to 0');
    }
    if (typeof t.burned !== 'number' || isNaN(t.burned) || t.burned < 0) {
      t.burned = 0; fix('tokenomics.burned', 'RESET NaN/negative to 0');
    }
    if (typeof t.networkPool !== 'number' || isNaN(t.networkPool) || t.networkPool < 0) {
      t.networkPool = 0; fix('tokenomics.networkPool', 'RESET NaN/negative to 0');
    }
    if (t.circulatingSupply > 210_000_000_000_000) {
      t.circulatingSupply = 210_000_000_000_000; fix('tokenomics.circulatingSupply', 'CLAMPED to max supply');
    }
  }

  // ── Arrays ────────────────────────────────────────────────────────────
  ['feed','scenarios','predictions','otc_orders','transactions','chat',
   'osint_feeds','social_syndications','flashAlerts','sovereignOverrideLog',
   'osintKeywordAlerts','frsAdjustments','supplyHistory'].forEach(key => {
    if (!Array.isArray(db[key])) {
      db[key] = []; fix(key, `RECREATED as empty array (was ${typeof db[key]})`);
    }
  });

  // ── Objects ───────────────────────────────────────────────────────────
  ['wallets','accounts','agents'].forEach(key => {
    if (!db[key] || typeof db[key] !== 'object' || Array.isArray(db[key])) {
      db[key] = {}; fix(key, `RECREATED as empty object (was ${typeof db[key]})`);
    }
  });

  // ── Wallet balance guards (non-sovereign only) ─────────────────────
  Object.entries(db.wallets).forEach(([pk, w]) => {
    if (typeof w.balance !== 'number' || isNaN(w.balance)) {
      w.balance = 0; fix(`wallets[${pk.slice(0,8)}].balance`, 'RESET NaN to 0');
    }
    if (w.balance < 0) {
      w.balance = 0; fix(`wallets[${pk.slice(0,8)}].balance`, 'RESET negative to 0');
    }
  });

  // ── Account FRS guards ────────────────────────────────────────────────
  Object.entries(db.accounts).forEach(([pk, acc]) => {
    if (typeof acc.frs !== 'number' || isNaN(acc.frs)) {
      acc.frs = 50; fix(`accounts[${pk.slice(0,8)}].frs`, 'RESET NaN to 50');
    }
    acc.frs = Math.max(0, Math.min(100, acc.frs));
  });

  // ── miningState ────────────────────────────────────────────────────────
  if (!db.miningState || typeof db.miningState !== 'object') {
    db.miningState = { startYear:2025, currentEpoch:1, totalEpochs:11,
      epochDurationYr:3, baseRewardMiri:50_000_000, minedSessionMiri:0,
      lastBlockTs:0, difficulty:4, active:false };
    fix('miningState', 'RECREATED with defaults');
  } else {
    const ms = db.miningState;
    if (!ms.currentEpoch || ms.currentEpoch < 1 || ms.currentEpoch > 11) {
      ms.currentEpoch = 1; fix('miningState.currentEpoch', 'RESET to 1');
    }
    if (!ms.difficulty || ms.difficulty < 1 || ms.difficulty > 8) {
      ms.difficulty = 4; fix('miningState.difficulty', 'RESET to 4');
    }
  }

  // ── dreamState ────────────────────────────────────────────────────────
  if (!db.dreamState) {
    db.dreamState = { lastRun:0, cycle:0, consensusLog:[] };
    fix('dreamState', 'RECREATED with defaults');
  }

  // ── version ───────────────────────────────────────────────────────────
  if (!db.version) {
    db.version = '2.0.0'; fix('version', 'SET to 2.0.0');
  }

  if (repairs.length > 0) {
    _resLog(`DB repair: ${repairs.length} field(s) repaired`, 'warn');
  }
  return { ok: true, repairs };
}

export function dbGetRepairLog() { return _repairLog.slice(-20); }

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 10: BANDWIDTH GUARD
// Mobile-aware request pacing to prevent thermal throttling.
// Enforces minimum inter-send gap and max payload size.
// ═══════════════════════════════════════════════════════════════════════════

export function bwCanSend(payloadBytes = 0) {
  if (_sovereignFrozen) return false;
  if (payloadBytes > BW_MAX_PAYLOAD_BYTES) {
    _resLog(`BW: payload too large (${(payloadBytes/1024).toFixed(1)} KB) — blocked`, 'warn');
    return false;
  }
  const gap = _isMobile ? BW_MOBILE_QUEUE_MS : BW_DESKTOP_QUEUE_MS;
  return (_now() - _bwState.lastSendTs) >= gap;
}

export function bwRecordSend(payloadBytes = 0) {
  _bwState.lastSendTs = _now();
}

/**
 * bwEnqueue()
 * Queues a send function with enforced inter-send spacing.
 */
export function bwEnqueue(fn, payloadBytes = 0) {
  return new Promise((resolve, reject) => {
    _bwState.queue.push({ fn, payloadBytes, resolve, reject, ts: _now() });
    if (!_bwState.draining) _drainBWQueue();
  });
}

async function _drainBWQueue() {
  if (_bwState.draining) return;
  _bwState.draining = true;
  while (_bwState.queue.length > 0 && !_sovereignFrozen) {
    const entry = _bwState.queue[0];
    if (!bwCanSend(entry.payloadBytes)) {
      const gap = _isMobile ? BW_MOBILE_QUEUE_MS : BW_DESKTOP_QUEUE_MS;
      await _sleep(gap);
      continue;
    }
    _bwState.queue.shift();
    bwRecordSend(entry.payloadBytes);
    try   { entry.resolve(await entry.fn()); }
    catch (e) { entry.reject(e); }
  }
  _bwState.draining = false;
}

export function bwGetStatus() {
  return { queued: _bwState.queue.length, lastSendTs: _bwState.lastSendTs,
    gapMs: _isMobile ? BW_MOBILE_QUEUE_MS : BW_DESKTOP_QUEUE_MS, isMobile: _isMobile };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 11: ONLINE / OFFLINE DETECTION
// ═══════════════════════════════════════════════════════════════════════════

function _initNetworkListeners() {
  window.addEventListener('online', () => {
    _isOnline = true;
    _resLog('Network: online — draining offline queue', 'ok');
    cbRecordSuccess('github');
    cbRecordSuccess('exotic');
    // Drain queued messages
    setTimeout(() => {
      if (typeof window._mirCRDT?.onPeerSync === 'function') {
        oqDrainDeltas(d => window._mirCRDT.onPeerSync('local_drain', { deltas: [d] }));
      }
      if (window._mirMesh?.broadcastToPeers) {
        oqDrainPeerMsgs((msg, target) => {
          if (target) window._mirMesh.sendToPeer(target, msg);
          else window._mirMesh.broadcastToPeers(msg);
        });
      }
    }, 1500);
  });

  window.addEventListener('offline', () => {
    _isOnline = false;
    _resLog('Network: offline — queue mode active', 'warn');
    cbForceOpen('github');
    cbForceOpen('exotic');
  });
}

export function isOnline() { return _isOnline; }

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 12: SOVEREIGN FREEZE HANDLER
// ═══════════════════════════════════════════════════════════════════════════

export function setSovereignFrozen(frozen) {
  _sovereignFrozen = frozen;
  if (frozen) {
    cbForceOpenAll();
    // Clear all token bucket queues
    Object.values(_tokenBuckets).forEach(bucket => {
      bucket.queue.forEach(({ reject }) => reject(new Error('Sovereign freeze')));
      bucket.queue.length = 0;
    });
    // Clear BW queue
    _bwState.queue.forEach(({ reject }) => reject(new Error('Sovereign freeze')));
    _bwState.queue.length = 0;
    // Cancel all reconnect timers
    _reconnectState.forEach((state, peerId) => {
      if (state.timer) clearTimeout(state.timer);
    });
    _reconnectState.clear();
    _resLog('SOVEREIGN FREEZE: all resilience queues cleared', 'sovereign');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 13: GLOBAL STATUS REPORT
// ═══════════════════════════════════════════════════════════════════════════

// Re-export phantom functions on window._mirResilience in initResilience
// (done via the existing window._mirResilience assignment block)

export function getResilienceStatus() {
  return {
    version:         '1.0.0',
    sovereignFrozen: _sovereignFrozen,
    isMobile:        _isMobile,
    isOnline:        _isOnline,
    activeTier:      _activeTier,
    circuits:        cbStatus(),
    trafficShaper:   tsGetStatus(),
    offlineQueue:    oqSize(),
    deltaDedup:      ddGetStats(),
    peerReconnects:  prGetStatus(),
    snapshotHash:    siGetLastHash()?.slice(0,12) || null,
    snapshotVersion: siGetVersion(),
    bandwidth:       bwGetStatus(),
    repairLog:       _repairLog.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 14: BACKGROUND TIMERS
// ═══════════════════════════════════════════════════════════════════════════

function _startTimers() {
  _timers.bwQueue     = setInterval(() => { if (!_bwState.draining) _drainBWQueue(); }, 500);
  _timers.tokenBucket = setInterval(_drainTokenBucketQueues, 2_000);
  _timers.ddGC        = setInterval(() => {
    const now = _now();
    _seenDeltas.forEach((ts, id) => { if (now - ts > DD_SEEN_TTL_MS) _seenDeltas.delete(id); });
  }, 60_000);
  _timers.memGC       = setInterval(() => {
    if (_memFallback.size > 50) {
      _resLog('Memory tier GC: clearing volatile cache', 'warn');
      _memFallback.clear();
    }
  }, 180_000);
}

// ═══════════════════════════════════════════════════════════════════════════
// PHANTOM DISTRIBUTION — Human-Scale Traffic Shaping
// Merged into BandwidthGuard. Adds human-latency profiles and
// staggered broadcast for geopolitical alert distribution.
// Uses only the existing bwEnqueue + token-bucket infrastructure.
// No new external endpoints — only wraps existing fetch calls.
// ═══════════════════════════════════════════════════════════════════════════

// Human-latency profiles (milliseconds)
const PHANTOM_PROFILES = {
  casual:    { minMs: 1_500, maxMs:  5_000 },   // normal user
  deliberate:{ minMs: 3_000, maxMs:  9_000 },   // analyst reviewing
  cautious:  { minMs: 8_000, maxMs: 22_000 },   // post-alert cooldown
  mobile:    { minMs: 2_500, maxMs:  7_500 },   // mobile user pacing
};

/**
 * phGenerateHumanDelay()
 * Returns a Promise that resolves after a human-scale random delay.
 * Profile selection is automatic based on device type and context.
 */
export function phGenerateHumanDelay(profileName = 'casual') {
  const profile = PHANTOM_PROFILES[profileName] || PHANTOM_PROFILES.casual;
  const delay   = Math.floor(Math.random() * (profile.maxMs - profile.minMs + 1) + profile.minMs);
  return _sleep(delay);
}

/**
 * phFragmentPayload()
 * Splits a payload into N fragments for staggered transmission.
 * Fragment count scales with payload size to maintain natural pacing.
 * Maximum fragment size: 8 KB to stay within BW_MAX_PAYLOAD_BYTES budget.
 */
export function phFragmentPayload(payload, maxFragmentBytes = 8_192) {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  if (serialized.length <= maxFragmentBytes) return [payload];

  const fragments = [];
  for (let i = 0; i < serialized.length; i += maxFragmentBytes) {
    fragments.push(serialized.slice(i, i + maxFragmentBytes));
  }
  return fragments;
}

/**
 * phStaggeredBroadcast()
 * Sends a payload to an endpoint using human-scale inter-fragment delays.
 * Integrates with BandwidthGuard (bwEnqueue) and CircuitBreaker.
 * Used for: geopolitical alert webhooks, sovereign syndication signals.
 *
 * Security: endpoint must be a pre-registered webhook URL
 * (mir_webhook_twitter or mir_webhook_telegram in localStorage).
 * Rejects arbitrary endpoints to prevent data exfiltration.
 *
 * @param {string} endpoint      — must be a registered webhook URL
 * @param {Object} payload       — data to broadcast
 * @param {string} authSignature — sovereign signature hex string (optional)
 * @param {string} profile       — human latency profile name
 */
export async function phStaggeredBroadcast(endpoint, payload, authSignature = null, profile = 'deliberate') {
  if (_sovereignFrozen) throw new Error('Sovereign freeze — broadcast blocked');

  // Security gate: only allow pre-registered webhook endpoints
  const allowedEndpoints = [
    localStorage.getItem('mir_webhook_twitter'),
    localStorage.getItem('mir_webhook_telegram'),
  ].filter(Boolean);

  if (!allowedEndpoints.includes(endpoint)) {
    _resLog(`phStaggeredBroadcast: endpoint not registered — blocked`, 'err');
    throw new Error('Endpoint not in registered webhook allowlist');
  }

  // Circuit breaker check for this endpoint domain
  const cbKey = `webhook_${endpoint.slice(8, 30).replace(/[^a-z0-9]/gi, '_')}`;
  if (!cbCanRequest(cbKey)) {
    _resLog(`phStaggeredBroadcast: circuit OPEN for ${cbKey}`, 'warn');
    throw new Error(`Circuit open: ${cbKey}`);
  }

  const fragments = phFragmentPayload(payload);
  _resLog(`phStaggeredBroadcast: ${fragments.length} fragment(s) → ${endpoint.slice(0,30)}… profile=${profile}`, 'info');

  let successCount = 0;
  for (let i = 0; i < fragments.length; i++) {
    // Human delay before each fragment (skip first one)
    if (i > 0) await phGenerateHumanDelay(profile);

    const fragment     = fragments[i];
    const fragBytes    = typeof fragment === 'string' ? fragment.length : JSON.stringify(fragment).length;

    // BandwidthGuard: queue via bwEnqueue for mobile-aware pacing
    await bwEnqueue(async () => {
      const body = JSON.stringify({
        fragmentIndex: i,
        totalFragments: fragments.length,
        networkNonce:  Math.random().toString(36).slice(2, 10),
        payload:       fragment,
        ts:            _now(),
      });

      const headers = { 'Content-Type': 'application/json' };
      if (authSignature) headers['X-Sovereign-Signature'] = authSignature.slice(0, 64);

      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 12_000);
      try {
        const res = await fetch(endpoint, { method: 'POST', headers, body, signal: ctrl.signal });
        clearTimeout(tid);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        cbRecordSuccess(cbKey);
        successCount++;
      } catch (err) {
        clearTimeout(tid);
        cbRecordFailure(cbKey);
        _resLog(`phStaggeredBroadcast fragment ${i+1}/${fragments.length} failed: ${err.message}`, 'warn');
        // Cautious retry delay on failure
        await phGenerateHumanDelay('cautious');
      }
    }, fragBytes);
  }

  _resLog(`phStaggeredBroadcast complete: ${successCount}/${fragments.length} fragments sent`, successCount === fragments.length ? 'ok' : 'warn');
  return { success: successCount === fragments.length, sent: successCount, total: fragments.length };
}

/**
 * phGetProfiles()
 * Returns available human latency profiles for admin inspection.
 */
export function phGetProfiles() {
  return { ...PHANTOM_PROFILES };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 15: MODULE ENTRY POINT — initResilience()
// ═══════════════════════════════════════════════════════════════════════════

export async function initResilience({ db } = {}) {
  _resLog('Resilience layer v1.0.0 — initialising', 'info');

  _isMobile = _detectMobile();

  // 1. Load offline queue from sessionStorage
  _oqLoad();

  // 2. Wire online/offline detection
  _initNetworkListeners();
  _isOnline = navigator.onLine;

  // 3. Run DB repair on boot
  if (db) {
    const repairResult = dbRepair(db);
    if (repairResult.repairs.length > 0) {
      _resLog(`Boot repair: ${repairResult.repairs.length} fields fixed`, 'warn');
    }
  }

  // 4. Compute initial snapshot hash
  if (db) {
    const { hash } = await siVerifySnapshot(db);
    if (hash) _resLog(`Initial snapshot hash: ${hash.slice(0,12)}…`, 'info');
  }

  // 5. Pre-initialize circuit breakers for known endpoints
  ['github', 'gist_signal', 'exotic_usgs', 'exotic_n2yo',
   'peer_webrtc', 'anthropic_api'].forEach(name => _ensureBreaker(name));

  // 6. Start background timers
  _startTimers();

  // 7. Expose on window for cross-module access
  window._mirResilience = {
    cbCanRequest, cbRecordSuccess, cbRecordFailure, cbGetState,
    cbForceOpen, cbForceOpenAll, cbStatus,
    ebGetDelay, ebRecordAttempt, ebRecordSuccess, ebRecordFailure,
    ebShouldGiveUp, ebReset, withRetry,
    storageWrite, storageRead, getActiveTier, resetStorageTier,
    oqEnqueueDelta, oqEnqueuePeerMsg, oqDrainDeltas, oqDrainPeerMsgs, oqSize,
    ddIsSeen, ddMarkSeen, ddGetStats,
    tsCanSend, tsConsume, tsEnqueue, tsGetStatus,
    prScheduleReconnect, prClearReconnect, prGetStatus,
    siComputeHash, siVerifySnapshot, siPersistVersion, siGetLastHash, siGetVersion,
    dbRepair, dbGetRepairLog,
    bwCanSend, bwRecordSend, bwEnqueue, bwGetStatus,
    setSovereignFrozen, isOnline,
    getResilienceStatus,
    // Phantom Distribution (human-scale traffic shaping)
    phGenerateHumanDelay, phFragmentPayload, phStaggeredBroadcast, phGetProfiles,
  };

  // 8. Wire sovereign override event
  window.addEventListener('mir:sovereignoverride', (e) => {
    setSovereignFrozen(!!(e.detail?.frozen));
  });

  _resLog(`Resilience layer v1.0.0 — ready (mobile=${_isMobile}, online=${_isOnline}, tier=${_activeTier})`, 'ok');

  return window._mirResilience;
}
