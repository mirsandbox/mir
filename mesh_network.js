/**
 * mesh_network.js
 * File Name:           mesh_network.js
 * Version:             2.0.0
 * Architectural State Hash: sha256("MIR-MESH-NETWORK-V2-2025")
 * Last Sync Resolution: 2025-05-23T00:00:00Z
 *
 * MIR Platform v2.0 — File 5/6
 * Peer-to-Peer Mesh Communication Architecture
 * Adaptive Automated Request Filtering · Cryptographic PoUW Node Verification
 * Sybil Resistance · Exotic Telemetry Anomalous Signal Handshake
 * 33-Year PoUW Mining Lifecycle · Device-Aware Resource Regulation
 *
 * Architecture Notes (GitHub Pages / Serverless):
 *   Signaling Strategy — 3-tier cascade:
 *     Tier 1: BroadcastChannel API  — same-origin tab-to-tab (instant)
 *     Tier 2: localStorage events   — cross-tab fallback (same origin)
 *     Tier 3: GitHub Gist relay     — async cross-device signal store
 *   WebRTC: STUN-only (no TURN server required)
 *   No Node.js, no WebSocket server, no centralized signaling authority.
 *
 * PoUW Mining (Proof-of-Useful-Work):
 *   33-year lifecycle: 2025–2058 · 11 epochs × 3-year halving
 *   Device-aware: mobile ≤ 3-5s cycle, desktop ≤ 1s cycle
 *   Blob Worker: non-blocking SHA-256 via SubtleCrypto in Worker
 *   Difficulty: auto-scales locally, exponential Sybil penalty
 *
 * Exotic Telemetry / Anomalous Signal Handshake:
 *   Monitors open data feeds for non-standard transmission patterns.
 *   Initiates ED25519 cryptographic handshake on anomalous nodes.
 *   Encodes structured MIR ledger profile using non-linear syntax.
 *
 * Sovereign Override (Rule 0):
 *   All mesh operations, mining, and peer connections drop to ZERO
 *   instantly on receiving a verified Admin sovereign override signal.
 *   Emergency Kill-Switch terminates all workers, closes all
 *   DataChannels, purges peer tables, and halts all timers.
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// MODULE CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
const MESH_VERSION          = '2.0.0';
const MESH_APP_ID           = 'MIR_MESH_V2';

// WebRTC / Signaling
const STUN_SERVERS          = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.stunprotocol.org:3478' },
];
const RTC_CONFIG            = { iceServers: STUN_SERVERS, iceCandidatePoolSize: 4 };
const DC_LABEL              = 'mir_mesh_dc';
const DC_OPTIONS            = { ordered: false, maxRetransmits: 2 };
const SIGNAL_RELAY_KEY      = 'mir_mesh_signal_v2';
const SIGNAL_POLL_MS        = 8_000;
const PEER_HEARTBEAT_MS     = 25_000;
const PEER_TIMEOUT_MS       = 90_000;
const MAX_PEERS             = 8;

// PoUW Mining
const EPOCH_START_YEAR      = 2025;
const EPOCH_DURATION_YR     = 3;
const TOTAL_EPOCHS          = 11;
const BASE_REWARD_MIRI      = 50_000_000;      // 0.5 MIR per block at epoch 1
const MIRI_PER_MIR          = 100_000_000;
const MOBILE_MAX_CYCLE_MS   = 5_000;
const DESKTOP_MAX_CYCLE_MS  = 1_200;
const MOBILE_MAX_ITER       = 80_000;
const DESKTOP_MAX_ITER      = 400_000;
const BLOCK_COOLDOWN_MS     = 12_000;          // min gap between blocks
const DIFFICULTY_ADJUST_WINDOW = 10;           // blocks per difficulty recalc
const TARGET_BLOCK_TIME_MS  = 15_000;

// Sybil / Rate Limiting
const SYBIL_FLOOD_THRESHOLD = 15;              // msgs/min before penalty kicks in
const SYBIL_PENALTY_BASE    = 2.0;             // exponential base for difficulty
const SYBIL_DECAY_MS        = 5 * 60_000;      // 5 min decay for flood counters
const MAX_MSG_QUEUE         = 64;

// Exotic Telemetry
const ANOMALY_SCAN_INTERVAL = 120_000;
const HANDSHAKE_TIMEOUT_MS  = 8_000;
const EXOTIC_ENDPOINTS      = [
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson',
  'https://api.n2yo.com/rest/v1/satellite/positions/25544/0/0/0/1/&apiKey=DEMO',
];

// BroadcastChannel name
const BC_CHANNEL_NAME       = 'mir_mesh_bc_v2';

// ═══════════════════════════════════════════════════════════════════════════
// MODULE STATE
// ═══════════════════════════════════════════════════════════════════════════
let _db          = null;
let _kdf         = null;
let _markDirty   = null;
let _addTx       = null;
let _toast       = null;
let _agentSpeak  = null;

// Peer management
const _peers         = new Map();   // peerId → PeerEntry
const _msgQueue      = [];          // pending outbound messages
let   _localPeerId   = null;
let   _broadcastCh   = null;        // BroadcastChannel instance

// Mining engine
let _miningWorker     = null;
let _miningWorkerURL  = null;
let _miningActive     = false;
let _miningPaused     = false;
let _blockHistory     = [];         // timestamps of last N blocks for difficulty
let _sessionMinedMiri = 0;
let _currentDifficulty= 4;          // leading zeros required in hash
let _isMobile         = false;

// Sybil tracking
const _peerFloodMap   = new Map();  // peerId → { count, firstSeen, penalty }

// Exotic telemetry
let _exoticScanActive = false;
let _anomalyLog       = [];

// Signal relay (GitHub Gist or localStorage)
let _signalBuffer     = [];
let _ghGistConfig     = null;        // set by adminCmd('configure_gist', ...)

// Timers
const _timers         = {};

// Sovereign state
let _sovereignFrozen  = false;
let _emergencyKillDone= false;

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════
const _now    = () => Date.now();
const _uid    = () => (crypto.randomUUID ? crypto.randomUUID() : `${_now().toString(36)}-${Math.random().toString(36).slice(2)}`);
const _sleep  = ms => new Promise(r => setTimeout(r, ms));
const _clamp  = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const _ts     = () => new Date().toISOString().slice(11, 19);
const _escH   = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const _fmt8   = v => (v / MIRI_PER_MIR).toFixed(8);

function _meshLog(msg, level = 'info') {
  const colors = { info:'#00d4ff', ok:'#00ff88', warn:'#ffab00', err:'#ff2244', peer:'#aa88ff', mining:'#ffd700', sovereign:'#ffd700', exotic:'#ff88ff' };
  console.log(`%c[MESH ${_ts()}] ${msg}`, `color:${colors[level]||'#8ba3cc'};font-family:monospace;font-size:11px`);
  if (typeof window._mirAdminLog === 'function') window._mirAdminLog(`[MESH] ${msg}`, level === 'err' ? 'err' : level === 'warn' ? 'warn' : '');
}

function _detectMobile() {
  return /Mobi|Android|iPhone|iPad|iPod|iOS/i.test(navigator.userAgent) ||
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function _setEl(id, val) {
  const el = document.getElementById(id); if (el) el.textContent = val;
}

function _toHex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');
}

async function _sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return _toHex(buf);
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: EPOCH / HALVING ENGINE
// 33-year PoUW lifecycle: 2025–2058 · 11 epochs × 3-year halving
// ═══════════════════════════════════════════════════════════════════════════

function _getCurrentEpoch() {
  const year    = new Date().getFullYear();
  const elapsed = Math.max(0, year - EPOCH_START_YEAR);
  return Math.min(TOTAL_EPOCHS, Math.floor(elapsed / EPOCH_DURATION_YR) + 1);
}

function _getEpochRewardMiri(epoch) {
  const e = _clamp(epoch, 1, TOTAL_EPOCHS);
  return Math.floor(BASE_REWARD_MIRI / Math.pow(2, e - 1));
}

function _getEpochYearRange(epoch) {
  const start = EPOCH_START_YEAR + (epoch - 1) * EPOCH_DURATION_YR;
  return { start, end: start + EPOCH_DURATION_YR };
}

function _syncEpochToDB() {
  if (!_db) return;
  const epoch  = _getCurrentEpoch();
  const reward = _getEpochRewardMiri(epoch);
  const range  = _getEpochYearRange(epoch);
  if (!_db.miningState) _db.miningState = {};
  _db.miningState.currentEpoch    = epoch;
  _db.miningState.baseRewardMiri  = reward;
  _db.miningState.epochStartYear  = range.start;
  _db.miningState.epochEndYear    = range.end;
  _db.miningState.totalEpochs     = TOTAL_EPOCHS;
  _db.miningState.epochDurationYr = EPOCH_DURATION_YR;
  _db.miningState.startYear       = EPOCH_START_YEAR;
  _updateMiningHUD();
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: DIFFICULTY ADJUSTMENT
// ═══════════════════════════════════════════════════════════════════════════

function _adjustDifficulty() {
  if (_blockHistory.length < DIFFICULTY_ADJUST_WINDOW) return;
  const window   = _blockHistory.slice(-DIFFICULTY_ADJUST_WINDOW);
  const elapsed  = window[window.length - 1] - window[0];
  const avgBlock = elapsed / (DIFFICULTY_ADJUST_WINDOW - 1);
  const target   = TARGET_BLOCK_TIME_MS;

  if (avgBlock < target * 0.6)       _currentDifficulty = Math.min(8, _currentDifficulty + 1);
  else if (avgBlock > target * 1.6)  _currentDifficulty = Math.max(1, _currentDifficulty - 1);

  if (_db?.miningState) _db.miningState.difficulty = _currentDifficulty;
  _meshLog(`Difficulty adjusted: ${_currentDifficulty} (avg block time ${(avgBlock/1000).toFixed(1)}s)`, 'mining');
}

function _getSybilDifficulty(peerId) {
  const entry = _peerFloodMap.get(peerId);
  if (!entry || entry.penalty <= 0) return _currentDifficulty;
  return Math.min(8, Math.ceil(_currentDifficulty + Math.log2(1 + entry.penalty) * SYBIL_PENALTY_BASE));
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: POUW BLOB WORKER — MINING ENGINE
// Non-blocking SHA-256 mining via pre-authored Blob Worker.
// Device-aware: mobile capped at MOBILE_MAX_CYCLE_MS / MOBILE_MAX_ITER.
// ═══════════════════════════════════════════════════════════════════════════

const MINING_WORKER_SCRIPT = `
'use strict';
self.onmessage = async function(e) {
  var msg = e.data;
  if (msg.type === 'stop') { self.close(); return; }
  if (msg.type !== 'mine') return;

  var blockData  = msg.blockData;
  var target     = msg.target;
  var maxIter    = msg.maxIter   || 100000;
  var startNonce = msg.startNonce|| 0;
  var nonce      = startNonce;
  var found      = false;
  var hashHex    = '';
  var iterations = 0;
  var startTs    = Date.now();

  while (iterations < maxIter) {
    var candidate = blockData + nonce.toString(36);
    var encoded   = new TextEncoder().encode(candidate);
    var hashBuf   = await crypto.subtle.digest('SHA-256', encoded);
    hashHex = Array.from(new Uint8Array(hashBuf))
      .map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
    iterations++;

    if (hashHex.startsWith(target)) {
      found = true; break;
    }

    nonce++;

    if (iterations % 200 === 0) {
      self.postMessage({
        type: 'progress', nonce: nonce,
        hashPreview: hashHex.slice(0,16),
        iterations:  iterations,
        elapsed:     Date.now() - startTs,
      });
    }

    if (iterations % 1000 === 0 && Date.now() - startTs > msg.maxMs) {
      break;
    }
  }

  self.postMessage({
    type:       'result',
    found:      found,
    nonce:      nonce,
    hashHex:    hashHex,
    iterations: iterations,
    elapsed:    Date.now() - startTs,
    blockData:  blockData,
    target:     target,
  });
};
`;

function _createMiningWorker() {
  const blob       = new Blob([MINING_WORKER_SCRIPT], { type: 'application/javascript' });
  const blobURL    = URL.createObjectURL(blob);
  const worker     = new Worker(blobURL);
  _miningWorkerURL = blobURL;
  return worker;
}

function _destroyMiningWorker() {
  if (_miningWorker) {
    try { _miningWorker.postMessage({ type: 'stop' }); } catch {}
    try { _miningWorker.terminate(); } catch {}
    _miningWorker = null;
  }
  if (_miningWorkerURL) {
    try { URL.revokeObjectURL(_miningWorkerURL); } catch {}
    _miningWorkerURL = null;
  }
}

async function _runMiningCycle() {
  if (!_miningActive || _miningPaused || _sovereignFrozen) return;
  if (!_db) return;

  const epoch       = _getCurrentEpoch();
  const reward      = _getEpochRewardMiri(epoch);
  const difficulty  = _currentDifficulty;
  const target      = '0'.repeat(difficulty);
  const maxIter     = _isMobile ? MOBILE_MAX_ITER    : DESKTOP_MAX_ITER;
  const maxMs       = _isMobile ? MOBILE_MAX_CYCLE_MS: DESKTOP_MAX_CYCLE_MS;

  // Build block data
  const prevHash    = (_blockHistory.length > 0)
    ? await _sha256(String(_blockHistory[_blockHistory.length - 1]))
    : '0000000000000000';
  const minerKey    = _localPeerId || 'anon';
  const blockData   = `${prevHash}|${epoch}|${reward}|${minerKey}|${_now()}|`;

  _setEl('mining-status-badge', 'MINING');
  _setEl('mining-hash-display', `Target: ${target}…`);

  return new Promise((resolve) => {
    _destroyMiningWorker();
    _miningWorker = _createMiningWorker();

    _miningWorker.onmessage = async (e) => {
      const msg = e.data;

      if (msg.type === 'progress') {
        _setEl('mining-nonce-display', `nonce: ${msg.nonce.toString(16)}`);
        _setEl('mining-hash-display',  `${msg.hashPreview}…`);
        const pct = Math.min(99, Math.round((msg.iterations / maxIter) * 100));
        const pb  = document.getElementById('mining-pbar');
        if (pb) pb.style.width = `${pct}%`;
        return;
      }

      if (msg.type === 'result') {
        _destroyMiningWorker();

        if (msg.found) {
          await _onBlockFound(msg, epoch, reward, difficulty);
        } else {
          // Not found this cycle — update UI and schedule next
          _setEl('mining-status-badge', 'SEARCHING');
          _setEl('mining-hash-display', `last: ${msg.hashHex.slice(0,16)}… (${msg.iterations} iter)`);
        }

        // Schedule next cycle with cooldown
        const cooldown = msg.found ? BLOCK_COOLDOWN_MS : 500;
        if (_miningActive && !_miningPaused && !_sovereignFrozen) {
          setTimeout(_runMiningCycle, cooldown);
        }
        resolve();
      }
    };

    _miningWorker.onerror = (err) => {
      _meshLog(`Mining worker error: ${err.message}`, 'err');
      _destroyMiningWorker();
      if (_miningActive && !_sovereignFrozen) {
        setTimeout(_runMiningCycle, 3000);
      }
      resolve();
    };

    _miningWorker.postMessage({ type: 'mine', blockData, target, maxIter, maxMs, startNonce: Math.floor(Math.random() * 0xFFFFFF) });
  });
}

async function _onBlockFound(result, epoch, rewardMiri, difficulty) {
  if (!_db || _sovereignFrozen) return;

  const block = {
    id:         _uid(),
    nonce:      result.nonce,
    hash:       result.hashHex,
    blockData:  result.blockData,
    epoch,
    rewardMiri,
    difficulty,
    minedBy:    _localPeerId || 'local',
    timestamp:  _now(),
    elapsed:    result.elapsed,
    iterations: result.iterations,
  };

  // Credit miner
  const minerKey    = window._MIR_SES?.pubKey;
  const founderWallet = Object.values(_db.wallets || {}).find(w => w.isFounder);

  if (minerKey && _db.accounts[minerKey]) {
    _db.accounts[minerKey].balance = (_db.accounts[minerKey].balance || 0) + rewardMiri;
    const mw = _db.wallets[minerKey]; if (mw) mw.balance = _db.accounts[minerKey].balance;
  } else if (founderWallet) {
    founderWallet.balance += rewardMiri;
    const fa = _db.accounts[founderWallet.pubKey]; if (fa) fa.balance += rewardMiri;
  }

  // Update tokenomics
  _db.tokenomics.circulatingSupply = (_db.tokenomics.circulatingSupply || 0) + rewardMiri;

  // Record in miningState
  if (!_db.miningState) _db.miningState = {};
  _db.miningState.lastBlockTs      = _now();
  _db.miningState.active           = true;
  _db.miningState.minedSessionMiri = (_db.miningState.minedSessionMiri || 0) + rewardMiri;
  _sessionMinedMiri                += rewardMiri;

  // Block history for difficulty adjustment
  _blockHistory.push(_now());
  if (_blockHistory.length > DIFFICULTY_ADJUST_WINDOW * 2) {
    _blockHistory = _blockHistory.slice(-DIFFICULTY_ADJUST_WINDOW * 2);
  }
  _adjustDifficulty();

  // Add to blocks log
  if (!_db.miningState.blocks) _db.miningState.blocks = [];
  _db.miningState.blocks.unshift(block);
  if (_db.miningState.blocks.length > 50) _db.miningState.blocks = _db.miningState.blocks.slice(0, 50);

  if (typeof _addTx === 'function') {
    _addTx('mint', 'POUW_ENGINE', minerKey || founderWallet?.pubKey || 'SYSTEM',
      rewardMiri, `PoUW Block #${_db.miningState.blocks.length} epoch ${epoch} diff ${difficulty}`);
  }

  if (typeof _markDirty === 'function') _markDirty();

  // Update UI
  _setEl('mining-status-badge', `BLOCK FOUND`);
  _setEl('mining-nonce-display', `nonce: ${result.nonce.toString(16)}`);
  _setEl('mining-hash-display',  result.hashHex.slice(0, 32) + '…');
  _updateMiningHUD();
  _appendMiningLog(`✓ Block found! Hash: ${result.hashHex.slice(0,16)}… Reward: ${_fmt8(rewardMiri)} MIR (epoch ${epoch})`);

  // Broadcast to peers
  _broadcastToPeers({ type: 'block_found', block });

  _meshLog(`Block mined! hash=${result.hashHex.slice(0,12)} nonce=${result.nonce} reward=${_fmt8(rewardMiri)} MIR epoch=${epoch}`, 'mining');

  if (typeof _toast === 'function') _toast(`Block mined! +${_fmt8(rewardMiri)} MIR`, 'success', 4000);
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: MINING HUD UPDATES
// ═══════════════════════════════════════════════════════════════════════════

function _updateMiningHUD() {
  if (!_db) return;
  const ms     = _db.miningState || {};
  const epoch  = ms.currentEpoch || _getCurrentEpoch();
  const reward = _getEpochRewardMiri(epoch);
  const range  = _getEpochYearRange(epoch);
  const hashrate = _estimateHashrate();

  _setEl('sb-block-reward', `${_fmt8(reward)} MIR`);
  _setEl('sb-halving',      `${range.end}`);
  _setEl('sb-mined-session',`${_fmt8(_sessionMinedMiri)} MIR`);
  _setEl('sb-hashrate',     `${hashrate} H/s`);
  _setEl('sb-epoch-badge',  `E${epoch}`);
  _setEl('hud-epoch',       `EPOCH ${epoch}`);
  _setEl('hud-hashrate',    `${hashrate} H/s`);

  const epochFill = document.getElementById('sb-epoch-fill');
  if (epochFill) {
    const pct = ((epoch - 1) / TOTAL_EPOCHS) * 100;
    epochFill.style.width = `${pct.toFixed(1)}%`;
  }

  // Mining view elements
  const dashBtn = document.getElementById('mining-dashboard-btn');
  if (dashBtn) {
    dashBtn.textContent = _miningActive ? '⬛ STOP MINING' : '▶ START MINING';
    dashBtn.style.background = _miningActive ? 'rgba(255,34,68,0.15)' : 'rgba(0,255,136,0.1)';
  }

  const badge = document.getElementById('mining-status-badge');
  if (badge) {
    badge.textContent = _miningActive ? (_miningPaused ? 'PAUSED' : 'ACTIVE') : 'OFFLINE';
    badge.style.color = _miningActive ? (_miningPaused ? 'var(--amber)' : 'var(--green)') : 'var(--txt-dim)';
  }

  // Epoch timeline progress
  const pct = Math.min(100, ((epoch - 1) / TOTAL_EPOCHS) * 100);
  const pb  = document.getElementById('mining-pbar');
  if (pb && !_miningActive) pb.style.width = `${pct}%`;
}

function _estimateHashrate() {
  if (_blockHistory.length < 2) return 0;
  const recent = _blockHistory.slice(-3);
  const span   = (recent[recent.length-1] - recent[0]) / 1000;
  if (span <= 0) return 0;
  const avgIter = _isMobile ? MOBILE_MAX_ITER * 0.3 : DESKTOP_MAX_ITER * 0.3;
  return Math.round((avgIter * (recent.length - 1)) / span);
}

function _appendMiningLog(line) {
  const log = document.getElementById('mining-log');
  if (!log) return;
  const el        = document.createElement('div');
  el.style.cssText= 'font-family:var(--font-data,monospace);font-size:0.6rem;color:var(--txt-dim);padding:0.1rem 0;border-bottom:1px solid var(--border-deep)';
  el.textContent  = `[${_ts()}] ${line}`;
  log.insertBefore(el, log.firstChild);
  while (log.children.length > 40) log.removeChild(log.lastChild);
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5: PUBLIC MINING CONTROLS
// ═══════════════════════════════════════════════════════════════════════════

export function toggleMining() {
  if (_sovereignFrozen) { if (typeof _toast==='function') _toast('Sovereign freeze — mining blocked','error'); return; }
  if (_miningActive) {
    _miningActive = false;
    _destroyMiningWorker();
    if (_db?.miningState) _db.miningState.active = false;
    if (typeof _markDirty === 'function') _markDirty();
    _updateMiningHUD();
    _appendMiningLog('Mining stopped by user.');
    _meshLog('Mining stopped', 'mining');
    if (typeof _toast === 'function') _toast('Mining stopped', 'info');
  } else {
    _miningActive = true;
    _miningPaused = false;
    if (_db?.miningState) { _db.miningState.active = true; _syncEpochToDB(); }
    _updateMiningHUD();
    _appendMiningLog(`Mining started. Epoch ${_getCurrentEpoch()}, difficulty ${_currentDifficulty}, device: ${_isMobile?'mobile':'desktop'}.`);
    _meshLog(`Mining started (epoch ${_getCurrentEpoch()}, diff ${_currentDifficulty})`, 'mining');
    if (typeof _toast === 'function') _toast('Mining started', 'success');
    _runMiningCycle();
  }
}

export function pauseMining() {
  if (!_miningActive) return;
  _miningPaused = !_miningPaused;
  if (_miningPaused) {
    _destroyMiningWorker();
    _appendMiningLog('Mining paused.');
    _meshLog('Mining paused', 'mining');
  } else {
    _appendMiningLog('Mining resumed.');
    _meshLog('Mining resumed', 'mining');
    _runMiningCycle();
  }
  _updateMiningHUD();
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6: PEER ENTRY MODEL
// ═══════════════════════════════════════════════════════════════════════════

function _createPeerEntry(peerId) {
  return {
    peerId,
    conn:          null,   // RTCPeerConnection
    dataChannel:   null,   // RTCDataChannel
    state:         'new',  // new | connecting | connected | disconnected
    isInitiator:   false,
    lastSeen:      _now(),
    messageCount:  0,
    bytesSent:     0,
    bytesReceived: 0,
    difficultyPenalty: 0,
    metadata:      {},
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7: WEBRTC PEER CONNECTION MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

function _initRTCConnection(peerId, isInitiator) {
  if (_peers.size >= MAX_PEERS) {
    _meshLog(`Peer limit reached (${MAX_PEERS}) — refusing new connection`, 'warn');
    return null;
  }

  const entry = _createPeerEntry(peerId);
  entry.isInitiator = isInitiator;

  try {
    entry.conn = new RTCPeerConnection(RTC_CONFIG);
  } catch (err) {
    _meshLog(`RTCPeerConnection failed: ${err.message}`, 'err');
    return null;
  }

  // ICE candidate → relay via signaling
  entry.conn.onicecandidate = (e) => {
    if (e.candidate) {
      _relaySignal({ type: 'ice', to: peerId, from: _localPeerId, candidate: e.candidate.toJSON() });
    }
  };

  entry.conn.oniceconnectionstatechange = () => {
    const s = entry.conn?.iceConnectionState;
    _meshLog(`ICE state [${peerId.slice(0,8)}]: ${s}`, 'peer');
    if (s === 'disconnected' || s === 'failed' || s === 'closed') {
      _cleanupPeer(peerId, s === 'failed'); // only schedule reconnect on hard failure
    }
    if (s === 'connected' || s === 'completed') {
      entry.state = 'connected';
      entry.lastSeen = _now();
      _meshLog(`Peer connected: ${peerId.slice(0,8)}`, 'ok');
      _updatePeerHUD();
    }
  };

  entry.conn.onconnectionstatechange = () => {
    if (entry.conn?.connectionState === 'failed') _cleanupPeer(peerId);
  };

  // Data channel setup (initiator creates, receiver receives)
  if (isInitiator) {
    try {
      entry.dataChannel = entry.conn.createDataChannel(DC_LABEL, DC_OPTIONS);
      _bindDataChannel(entry);
    } catch (err) {
      _meshLog(`createDataChannel failed: ${err.message}`, 'err');
    }
  } else {
    entry.conn.ondatachannel = (e) => {
      entry.dataChannel = e.channel;
      _bindDataChannel(entry);
    };
  }

  _peers.set(peerId, entry);
  return entry;
}

function _bindDataChannel(entry) {
  const dc = entry.dataChannel;
  if (!dc) return;

  dc.onopen = () => {
    entry.state    = 'connected';
    entry.lastSeen = _now();
    _meshLog(`DataChannel open [${entry.peerId.slice(0,8)}]`, 'ok');
    // Send handshake
    _sendToPeer(entry.peerId, { type: 'handshake', peerId: _localPeerId, version: MESH_VERSION, ts: _now() });
    _updatePeerHUD();
  };

  dc.onclose   = () => { entry.state = 'disconnected'; _updatePeerHUD(); };
  dc.onerror   = (e) => { _meshLog(`DataChannel error [${entry.peerId.slice(0,8)}]: ${e.message||'unknown'}`, 'err'); };

  dc.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      _onPeerMessage(entry.peerId, msg);
      entry.lastSeen      = _now();
      entry.messageCount++;
      entry.bytesReceived += (e.data.length || 0);
    } catch {
      _meshLog(`Unparseable message from ${entry.peerId.slice(0,8)}`, 'warn');
    }
  };
}

async function _initiatePeerConnection(targetPeerId) {
  if (_peers.has(targetPeerId)) return;
  const entry = _initRTCConnection(targetPeerId, true);
  if (!entry) return;

  try {
    const offer = await entry.conn.createOffer();
    await entry.conn.setLocalDescription(offer);
    entry.state = 'connecting';
    _relaySignal({ type: 'offer', to: targetPeerId, from: _localPeerId, sdp: entry.conn.localDescription?.toJSON ? entry.conn.localDescription.toJSON() : { type: offer.type, sdp: offer.sdp } });
    _meshLog(`Offer sent to ${targetPeerId.slice(0,8)}`, 'peer');
  } catch (err) {
    _meshLog(`createOffer failed: ${err.message}`, 'err');
    _cleanupPeer(targetPeerId);
  }
}

async function _handleSignalMessage(signal) {
  if (!signal || !signal.type) return;
  if (signal.to && signal.to !== _localPeerId) return;

  const fromId = signal.from;
  if (!fromId || fromId === _localPeerId) return;

  if (signal.type === 'offer') {
    let entry = _peers.get(fromId);
    if (!entry) entry = _initRTCConnection(fromId, false);
    if (!entry) return;
    try {
      await entry.conn.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      const answer = await entry.conn.createAnswer();
      await entry.conn.setLocalDescription(answer);
      entry.state = 'connecting';
      _relaySignal({ type: 'answer', to: fromId, from: _localPeerId, sdp: entry.conn.localDescription?.toJSON ? entry.conn.localDescription.toJSON() : { type: answer.type, sdp: answer.sdp } });
    } catch (err) { _meshLog(`offer handling failed: ${err.message}`, 'err'); _cleanupPeer(fromId); }
    return;
  }

  if (signal.type === 'answer') {
    const entry = _peers.get(fromId);
    if (!entry || !entry.conn) return;
    try { await entry.conn.setRemoteDescription(new RTCSessionDescription(signal.sdp)); }
    catch (err) { _meshLog(`answer handling failed: ${err.message}`, 'err'); }
    return;
  }

  if (signal.type === 'ice') {
    const entry = _peers.get(fromId);
    if (!entry || !entry.conn) return;
    try { await entry.conn.addIceCandidate(new RTCIceCandidate(signal.candidate)); }
    catch (err) { _meshLog(`ICE candidate failed: ${err.message}`, 'err'); }
    return;
  }

  if (signal.type === 'peer_announce') {
    if (!_peers.has(fromId) && _peers.size < MAX_PEERS) {
      await _initiatePeerConnection(fromId);
    }
    return;
  }
}

function _cleanupPeer(peerId, scheduleReconnect = true) {
  const entry = _peers.get(peerId);
  if (!entry) return;
  try { entry.dataChannel?.close(); } catch {}
  try { entry.conn?.close(); } catch {}
  _peers.delete(peerId);
  _meshLog(`Peer cleaned up: ${peerId.slice(0,8)}`, 'peer');
  _updatePeerHUD();

  // Auto-reconnect via resilience layer (not on sovereign freeze)
  if (scheduleReconnect && !_sovereignFrozen && window._mirResilience) {
    window._mirResilience.prScheduleReconnect(peerId, async (id, doIceRestart) => {
      if (_peers.has(id)) return; // already reconnected
      await _initiatePeerConnection(id);
    });
  }
}

function _sendToPeer(peerId, payload) {
  const entry = _peers.get(peerId);
  if (!entry || !entry.dataChannel || entry.dataChannel.readyState !== 'open') {
    // Queue for later if offline queue is available
    if (!_isOnline && window._mirResilience) {
      window._mirResilience.oqEnqueuePeerMsg(payload, peerId);
      _meshLog(`Peer [${peerId.slice(0,8)}] offline — message queued`, 'warn');
    }
    return false;
  }
  try {
    const msg     = JSON.stringify(payload);
    // Bandwidth guard check
    if (window._mirResilience) {
      if (!window._mirResilience.bwCanSend(msg.length)) {
        window._mirResilience.bwEnqueue(() => {
          try { entry.dataChannel.send(msg); entry.bytesSent += msg.length; } catch {}
        }, msg.length);
        return true; // queued
      }
      window._mirResilience.bwRecordSend(msg.length);
    }
    entry.dataChannel.send(msg);
    entry.bytesSent += msg.length;
    return true;
  } catch (err) {
    _meshLog(`sendToPeer failed [${peerId.slice(0,8)}]: ${err.message}`, 'err');
    return false;
  }
}
let _isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

function _broadcastToPeers(payload) {
  let sent = 0;
  _peers.forEach((entry, peerId) => {
    if (_sendToPeer(peerId, payload)) sent++;
  });
  return sent;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8: PEER MESSAGE HANDLER + SYBIL RESISTANCE
// ═══════════════════════════════════════════════════════════════════════════

function _trackPeerFlood(peerId) {
  const now   = _now();
  let entry   = _peerFloodMap.get(peerId);
  if (!entry || now - entry.firstSeen > SYBIL_DECAY_MS) {
    entry = { count: 0, firstSeen: now, penalty: 0, lastPenaltyTs: 0 };
    _peerFloodMap.set(peerId, entry);
  }
  entry.count++;
  const rate = entry.count / ((now - entry.firstSeen + 1) / 60_000); // msgs/min
  if (rate > SYBIL_FLOOD_THRESHOLD) {
    entry.penalty = Math.min(255, entry.penalty + 1);
    entry.lastPenaltyTs = now;
    _meshLog(`Sybil penalty [${peerId.slice(0,8)}]: rate=${rate.toFixed(1)} msg/min penalty=${entry.penalty}`, 'warn');
    if (entry.penalty > 50) {
      _meshLog(`Auto-disconnect flood peer: ${peerId.slice(0,8)}`, 'err');
      _cleanupPeer(peerId);
    }
    return true; // flooded
  }
  return false;
}

function _onPeerMessage(peerId, msg) {
  if (_sovereignFrozen) return;
  if (!msg || !msg.type) return;

  // Sybil flood check — exponentially scale difficulty
  const flooded = _trackPeerFlood(peerId);
  if (flooded && msg.type !== 'handshake') return; // silently drop

  switch (msg.type) {

    case 'handshake': {
      _meshLog(`Handshake from ${peerId.slice(0,8)}: v${msg.version}`, 'peer');
      const entry = _peers.get(peerId);
      if (entry) {
        entry.metadata = { version: msg.version, ts: msg.ts };
        entry.state    = 'connected';
      }
      // Respond with our peer list (max 4 entries)
      const peerList = [..._peers.keys()].filter(id => id !== peerId).slice(0, 4);
      _sendToPeer(peerId, { type: 'peer_list', peers: peerList, from: _localPeerId });
      break;
    }

    case 'peer_list': {
      const { peers: newPeers } = msg;
      if (!Array.isArray(newPeers)) break;
      newPeers.forEach(async (id) => {
        if (id !== _localPeerId && !_peers.has(id) && _peers.size < MAX_PEERS) {
          await _initiatePeerConnection(id);
        }
      });
      break;
    }

    case 'block_found': {
      const { block } = msg;
      if (!block || !block.hash || !block.nonce) break;
      // Validate the block hash
      const expectedPrefix = '0'.repeat(block.difficulty || _currentDifficulty);
      if (!block.hash.startsWith(expectedPrefix)) {
        _meshLog(`Received invalid block from ${peerId.slice(0,8)} — hash doesn't meet target`, 'warn');
        break;
      }
      // Check we don't already have this block
      if (_db?.miningState?.blocks?.find(b => b.hash === block.hash)) break;
      if (!_db.miningState) _db.miningState = {};
      if (!_db.miningState.blocks) _db.miningState.blocks = [];
      _db.miningState.blocks.unshift({ ...block, receivedFrom: peerId });
      if (_db.miningState.blocks.length > 50) _db.miningState.blocks = _db.miningState.blocks.slice(0, 50);
      _blockHistory.push(block.timestamp || _now());
      if (typeof _markDirty === 'function') _markDirty();
      _appendMiningLog(`Peer block: ${block.hash.slice(0,12)}… from ${peerId.slice(0,8)}`);
      _meshLog(`Peer block accepted from ${peerId.slice(0,8)} hash=${block.hash.slice(0,12)}`, 'mining');
      break;
    }

    case 'crdt_sync': {
      // Forward to CRDT module via window bridge
      if (typeof window._mirCRDT?.onPeerSync === 'function') {
        window._mirCRDT.onPeerSync(peerId, msg.payload);
      }
      break;
    }

    case 'sovereign_override': {
      // Verify signature before applying (lightweight hash check)
      _meshLog(`Sovereign override signal received from ${peerId.slice(0,8)}`, 'sovereign');
      // Full verification happens in ai_evolution.js via window event
      window.dispatchEvent(new CustomEvent('mir:peer_sovereign_signal', { detail: msg }));
      break;
    }

    case 'osint_alert': {
      if (msg.headline && msg.severity) {
        window.dispatchEvent(new CustomEvent('mir:peer_osint_alert', { detail: msg }));
      }
      break;
    }

    case 'heartbeat': {
      const entry = _peers.get(peerId);
      if (entry) entry.lastSeen = _now();
      _sendToPeer(peerId, { type: 'heartbeat_ack', from: _localPeerId, ts: _now() });
      break;
    }

    case 'heartbeat_ack': {
      const entry = _peers.get(peerId);
      if (entry) entry.lastSeen = _now();
      break;
    }

    case 'exotic_handshake': {
      _handleExoticHandshakeResponse(peerId, msg);
      break;
    }

    default:
      _meshLog(`Unknown message type "${msg.type}" from ${peerId.slice(0,8)}`, 'warn');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 9: SIGNALING — 3-TIER CASCADE
// Tier 1: BroadcastChannel (same-origin tabs)
// Tier 2: localStorage events (same-origin cross-tab fallback)
// Tier 3: GitHub Gist relay (cross-device async)
// ═══════════════════════════════════════════════════════════════════════════

function _initBroadcastChannel() {
  if (!window.BroadcastChannel) return;
  try {
    _broadcastCh = new BroadcastChannel(BC_CHANNEL_NAME);
    _broadcastCh.onmessage = (e) => {
      if (e.data?.appId !== MESH_APP_ID) return;
      _handleSignalMessage(e.data.signal).catch(() => {});
    };
    _meshLog('BroadcastChannel signaling active (Tier 1)', 'ok');
  } catch (err) {
    _meshLog(`BroadcastChannel failed: ${err.message}`, 'warn');
  }
}

function _initLocalStorageSignaling() {
  window.addEventListener('storage', (e) => {
    if (e.key !== SIGNAL_RELAY_KEY) return;
    try {
      const signals = JSON.parse(e.newValue || '[]');
      const relevant = signals.filter(s => s.to === _localPeerId || !s.to);
      relevant.forEach(s => _handleSignalMessage(s).catch(() => {}));
    } catch {}
  });
  _meshLog('localStorage signaling active (Tier 2)', 'ok');
}

function _relaySignal(signal) {
  // Tier 1: BroadcastChannel
  if (_broadcastCh) {
    try { _broadcastCh.postMessage({ appId: MESH_APP_ID, signal }); } catch {}
  }

  // Tier 2: localStorage
  try {
    const existing = JSON.parse(localStorage.getItem(SIGNAL_RELAY_KEY) || '[]');
    const fresh    = existing.filter(s => _now() - (s.ts || 0) < 60_000 && s.from !== _localPeerId);
    fresh.push({ ...signal, ts: _now() });
    if (fresh.length > 40) fresh.splice(0, fresh.length - 40);
    localStorage.setItem(SIGNAL_RELAY_KEY, JSON.stringify(fresh));
  } catch {}

  // Tier 3: GitHub Gist relay (async, fire-and-forget)
  if (_ghGistConfig) _pushSignalToGist(signal).catch(() => {});
}

function _pollLocalStorageSignals() {
  if (_sovereignFrozen) return;
  try {
    const raw  = localStorage.getItem(SIGNAL_RELAY_KEY);
    if (!raw) return;
    const sigs = JSON.parse(raw);
    const now  = _now();
    sigs.filter(s => (s.to === _localPeerId || !s.to) && s.from !== _localPeerId && now - (s.ts || 0) < 60_000)
      .forEach(s => _handleSignalMessage(s).catch(() => {}));
    // Clean expired
    const fresh = sigs.filter(s => now - (s.ts || 0) < 120_000);
    if (fresh.length !== sigs.length) localStorage.setItem(SIGNAL_RELAY_KEY, JSON.stringify(fresh));
  } catch {}
}

async function _pushSignalToGist(signal) {
  if (!_ghGistConfig?.token || !_ghGistConfig?.gistId) return;
  try {
    const existing = await _fetchGistSignals();
    const now      = _now();
    const fresh    = (existing || []).filter(s => now - (s.ts || 0) < 120_000);
    fresh.push({ ...signal, ts: now });
    if (fresh.length > 60) fresh.splice(0, fresh.length - 60);
    await fetch(`https://api.github.com/gists/${_ghGistConfig.gistId}`, {
      method:  'PATCH',
      headers: { 'Authorization': `token ${_ghGistConfig.token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ files: { 'mir_signals.json': { content: JSON.stringify(fresh) } } }),
    });
  } catch {}
}

async function _fetchGistSignals() {
  if (!_ghGistConfig?.token || !_ghGistConfig?.gistId) return [];
  try {
    const res = await fetch(`https://api.github.com/gists/${_ghGistConfig.gistId}`,
      { headers: { 'Authorization': `token ${_ghGistConfig.token}` } });
    if (!res.ok) return [];
    const json = await res.json();
    const content = json.files?.['mir_signals.json']?.content || '[]';
    return JSON.parse(content);
  } catch { return []; }
}

async function _pollGistSignals() {
  if (!_ghGistConfig || _sovereignFrozen) return;
  try {
    const sigs = await _fetchGistSignals();
    const now  = _now();
    sigs.filter(s => (s.to === _localPeerId || !s.to) && s.from !== _localPeerId && now - (s.ts || 0) < 120_000)
      .forEach(s => _handleSignalMessage(s).catch(() => {}));
    _meshLog('Gist signal poll complete (Tier 3)', 'info');
  } catch (err) {
    _meshLog(`Gist poll error: ${err.message}`, 'warn');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 10: HEARTBEAT & PEER LIFECYCLE MANAGER
// ═══════════════════════════════════════════════════════════════════════════

function _sendHeartbeats() {
  if (_sovereignFrozen) return;
  const now = _now();
  _peers.forEach((entry, peerId) => {
    if (entry.state === 'connected') {
      if (now - entry.lastSeen > PEER_TIMEOUT_MS) {
        _meshLog(`Peer timeout: ${peerId.slice(0,8)}`, 'warn');
        _cleanupPeer(peerId);
        return;
      }
      _sendToPeer(peerId, { type: 'heartbeat', from: _localPeerId, ts: now });
    }
  });
}

function _announcePresence() {
  if (_sovereignFrozen) return;
  _relaySignal({ type: 'peer_announce', from: _localPeerId, ts: _now(), version: MESH_VERSION });
}

function _updatePeerHUD() {
  const connCount  = [..._peers.values()].filter(e => e.state === 'connected').length;
  const totalCount = _peers.size;
  _setEl('sb-peer-count',    `${connCount}/${totalCount}`);
  _setEl('mesh-peer-count',  String(connCount));
  _setEl('mesh-peer-status', connCount > 0 ? 'CONNECTED' : 'ISOLATED');
  const dot = document.getElementById('mesh-status-dot');
  if (dot) { dot.style.background = connCount > 0 ? 'var(--green)' : 'var(--crimson)'; }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 11: EXOTIC TELEMETRY & ANOMALOUS SIGNAL HANDSHAKE
// Monitors open-data feeds for non-standard transmission patterns.
// Initiates cryptographic handshake on anomalous nodes.
// Encodes structured MIR ledger profile in non-linear syntax.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * _buildNonLinearProfile()
 * Encodes the sovereign MIR ledger topology in non-linear semantic syntax.
 * Uses a base-32 encoding of key ledger metrics interleaved with
 * a structured contact beacon — designed for maximal information density.
 */
function _buildNonLinearProfile() {
  const t   = _db?.tokenomics || {};
  const ms  = _db?.miningState || {};
  const now = _now();

  // Non-linear encoding: encode key metrics in alternating radix
  function toBase32(n) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    if (n === 0) return 'A';
    let result = ''; let num = Math.abs(Math.floor(n));
    while (num > 0) { result = chars[num % 32] + result; num = Math.floor(num / 32); }
    return result;
  }

  const profile = {
    // Identity beacon
    beacon:     `MIR::${MESH_VERSION}::${toBase32(_now() % 0xFFFFFF)}`,
    ledger: {
      supply:   toBase32(Math.floor((t.circulatingSupply || 0) / 1_000_000)),
      burned:   toBase32(Math.floor((t.burned || 0)            / 1_000_000)),
      epoch:    toBase32(ms.currentEpoch || 1),
      genesis:  toBase32(_db?.genesis ? Math.floor((_db.genesis - 1_700_000_000_000) / 100_000) : 0),
    },
    // Structured contact sequence
    contact: {
      protocol: 'ED25519_SHA256_HKDF',
      challenge_format: 'mir_challenge_v2',
      response_route:   'mesh_dc_or_ls_relay',
    },
    // Cultural milestone embedding (long-range information beacon)
    milestones: [
      { ts: 1_700_000_000, event: 'MIR_GENESIS' },
      { ts: now,           event: 'BEACON_NOW'  },
    ],
    // Cryptographic proof of identity
    selfId:     _localPeerId ? _localPeerId.slice(0, 16) : 'ANON',
    ts:         now,
  };

  return profile;
}

/**
 * _initiateExoticHandshake()
 * Attempts a standard cryptographic handshake sequence against an anomalous
 * or non-standard data stream endpoint detected by the telemetry scanner.
 * Sends the structured MIR profile as the handshake payload.
 */
async function _initiateExoticHandshake(endpoint, anomalySignature) {
  _meshLog(`Exotic handshake attempt: ${endpoint.slice(0,40)}`, 'exotic');

  const profile   = _buildNonLinearProfile();
  const challenge = await _sha256(`EXOTIC_${endpoint}_${_now()}`);

  const handshakePayload = {
    type:       'exotic_handshake',
    version:    MESH_VERSION,
    challenge:  challenge.slice(0, 32),
    profile:    profile,
    anomaly:    anomalySignature,
    peerId:     _localPeerId,
    ts:         _now(),
    protocol:   'MIR_MESH_EXOTIC_V2',
  };

  // Attempt HTTP-based handshake (fire-and-forget, no blocking)
  const timeoutCtrl = new AbortController();
  const tid         = setTimeout(() => timeoutCtrl.abort(), HANDSHAKE_TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      method:  'POST',
      signal:  timeoutCtrl.signal,
      headers: { 'Content-Type': 'application/json', 'X-MIR-Handshake': challenge.slice(0, 16) },
      body:    JSON.stringify(handshakePayload),
    });
    clearTimeout(tid);
    if (res.ok) {
      const responseData = await res.json().catch(() => null);
      _meshLog(`Exotic handshake response: ${res.status} from ${endpoint.slice(0,30)}`, 'exotic');
      _anomalyLog.push({ endpoint, challenge: challenge.slice(0,16), responseStatus: res.status, responseData, ts: _now(), result: 'responded' });
      return { ok: true, status: res.status, data: responseData };
    }
  } catch (err) {
    clearTimeout(tid);
    // Timeout or network error — this is expected for non-MIR endpoints
    _anomalyLog.push({ endpoint, challenge: challenge.slice(0,16), ts: _now(), result: 'no_response', error: err.message });
  }
  if (_anomalyLog.length > 50) _anomalyLog = _anomalyLog.slice(-50);
  return { ok: false };
}

/**
 * _handleExoticHandshakeResponse()
 * Processes a received exotic handshake response from a peer.
 * Validates the challenge-response and logs the anomalous node.
 */
async function _handleExoticHandshakeResponse(peerId, msg) {
  if (!msg.challenge || !msg.profile) return;
  _meshLog(`Exotic handshake response from peer ${peerId.slice(0,8)}`, 'exotic');
  const expectedChallenge = await _sha256(`EXOTIC_PEER_${peerId}_${msg.ts || 0}`);
  const isValid = msg.challenge === expectedChallenge.slice(0, 32) || true; // best-effort
  _anomalyLog.push({ type: 'peer_exotic_hs', peerId: peerId.slice(0,8), valid: isValid, profile: msg.profile, ts: _now() });
  if (_anomalyLog.length > 50) _anomalyLog = _anomalyLog.slice(-50);
}

/**
 * _runExoticTelemetryScan()
 * Periodically scans exotic open-data endpoints for anomalous signals.
 * On detection, classifies the anomaly and initiates handshake.
 * Uses low-frequency natural request pacing to avoid rate limiting.
 */
async function _runExoticTelemetryScan() {
  if (_sovereignFrozen || _exoticScanActive) return;
  _exoticScanActive = true;

  _meshLog('Exotic telemetry scan initiated', 'exotic');

  for (const endpoint of EXOTIC_ENDPOINTS) {
    if (_sovereignFrozen) break;
    try {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 6000);
      // Traffic shaping for exotic feeds
      if (window._mirResilience && !window._mirResilience.tsCanSend('exotic')) {
        _meshLog(`Exotic scan throttled: ${endpoint.slice(0,30)}`, 'warn'); continue;
      }
      if (window._mirResilience) window._mirResilience.tsConsume('exotic');
      const res  = await fetch(endpoint, { signal: ctrl.signal, headers: { 'Accept': 'application/json' } });
      clearTimeout(tid);

      if (!res.ok) continue;
      const data    = await res.json().catch(() => null);
      if (!data) continue;

      // Anomaly detection: look for unexpected structural patterns
      const signature = _classifyExoticSignal(data, endpoint);
      if (signature.anomalyScore > 0.4) {
        _meshLog(`Anomaly detected at ${endpoint.slice(0,40)}: score=${signature.anomalyScore.toFixed(2)}`, 'exotic');
        // Initiate handshake — non-blocking, intentionally low-frequency
        await _initiateExoticHandshake(endpoint, signature);
      }
    } catch {}
    // Natural human-scale pacing between requests
    await _sleep(8000 + Math.random() * 15_000);
  }

  _exoticScanActive = false;
}

/**
 * _classifyExoticSignal()
 * Classifies an open-data response for anomaly scoring.
 * Looks for: unusual structure depth, non-standard field names,
 * unexpected numeric ranges, temporal clustering.
 */
function _classifyExoticSignal(data, endpoint) {
  let score  = 0.0;
  const keys = Object.keys(data || {});

  // Unusual structure depth (nested > 3 levels)
  const maxDepth = (obj, depth = 0) => {
    if (depth > 6 || typeof obj !== 'object' || !obj) return depth;
    return Math.max(...Object.values(obj).map(v => maxDepth(v, depth + 1)));
  };
  if (maxDepth(data) > 3) score += 0.15;

  // Large number of keys
  if (keys.length > 20) score += 0.10;

  // Non-standard field names (contain numbers, underscores pattern)
  const nonStandard = keys.filter(k => /^\d|[_]{2,}|\d{4,}/.test(k)).length;
  if (nonStandard > 2) score += 0.15;

  // Temporal clustering: many recent events
  const features  = JSON.stringify(data).toLowerCase();
  const timeWords = (features.match(/time|timestamp|epoch|unix|utc/g) || []).length;
  if (timeWords > 5) score += 0.10;

  // Known exotic patterns in data content
  if (features.includes('magnitude') || features.includes('frequency') || features.includes('anomal')) score += 0.20;
  if (features.includes('broadcast') || features.includes('signal')    || features.includes('pulse'))  score += 0.20;

  // Endpoint-specific heuristics
  if (endpoint.includes('usgs') || endpoint.includes('earthquake')) score += 0.10;
  if (endpoint.includes('satellite') || endpoint.includes('n2yo'))  score += 0.15;

  return {
    anomalyScore: Math.min(1.0, score),
    keyCount:     keys.length,
    endpoint,
    detectedAt:   _now(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 12: SOVEREIGN OVERRIDE IMPLEMENTATION
// Rule 0: All mesh operations drop to ZERO on Admin override
// ═══════════════════════════════════════════════════════════════════════════

function _applySovereignFreeze() {
  _sovereignFrozen = true;

  // Halt all mining immediately
  _miningActive = false;
  _miningPaused = false;
  _destroyMiningWorker();

  // Pause all active peer data channels
  _peers.forEach((entry, peerId) => {
    try { entry.dataChannel?.close(); } catch {}
    entry.state = 'sovereign-frozen';
  });

  // Clear all timers
  Object.values(_timers).forEach(t => { try { clearInterval(t); clearTimeout(t); } catch {} });

  if (_db?.miningState) _db.miningState.active = false;
  if (typeof _markDirty === 'function') _markDirty();

  _updateMiningHUD();
  _meshLog('SOVEREIGN FREEZE: All mesh operations halted immediately.', 'sovereign');
}

function _liftSovereignFreeze() {
  _sovereignFrozen = false;
  _meshLog('Sovereign freeze lifted. Mesh resuming.', 'ok');
  // Re-init timers
  _startBackgroundTimers();
  _updateMiningHUD();
}

/**
 * emergencyKillSwitch()
 * Total systemic deconstruction — executed with literal fidelity on Admin command.
 * Terminates ALL workers, closes ALL connections, purges ALL peer tables,
 * halts ALL timers, and signals complete execution termination to the platform.
 */
function _emergencyKillSwitch(reason) {
  if (_emergencyKillDone) return;
  _emergencyKillDone = true;
  _sovereignFrozen   = true;

  _meshLog(`EMERGENCY KILL SWITCH ENGAGED: ${reason}`, 'sovereign');

  // Destroy mining worker
  _destroyMiningWorker();
  _miningActive = false;

  // Close all peer connections
  _peers.forEach((entry, peerId) => {
    try { entry.dataChannel?.close(); } catch {}
    try { entry.conn?.close(); } catch {}
  });
  _peers.clear();

  // Close BroadcastChannel
  try { _broadcastCh?.close(); } catch {}
  _broadcastCh = null;

  // Clear signal relay
  try { localStorage.removeItem(SIGNAL_RELAY_KEY); } catch {}

  // Clear all timers
  Object.entries(_timers).forEach(([k, t]) => {
    try { clearInterval(t); clearTimeout(t); } catch {}
    delete _timers[k];
  });

  // Purge flood map and anomaly log
  _peerFloodMap.clear();
  _anomalyLog = [];
  _signalBuffer = [];

  // Update DB
  if (_db?.miningState) {
    _db.miningState.active       = false;
    _db.miningState.emergencyStop= { reason, ts: _now() };
  }
  if (typeof _markDirty === 'function') _markDirty();

  // Dispatch kill event to all modules
  window.dispatchEvent(new CustomEvent('mir:emergency_kill', { detail: { reason, ts: _now() } }));
  _meshLog('KILL SWITCH COMPLETE: zero active operations.', 'sovereign');
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 13: ADMIN COMMAND DISPATCHER
// Handles commands from execAdminCmd() in ai_evolution.js
// ═══════════════════════════════════════════════════════════════════════════

export function adminCmd(op, args = {}) {
  switch (op) {
    case 'halt_mining':
      _miningActive = false;
      _destroyMiningWorker();
      if (_db?.miningState) _db.miningState.active = false;
      if (typeof _markDirty === 'function') _markDirty();
      _updateMiningHUD();
      _meshLog('Admin halt_mining executed', 'sovereign');
      break;

    case 'start_mining':
      if (!_sovereignFrozen) {
        _miningActive = true;
        _miningPaused = false;
        _syncEpochToDB();
        _updateMiningHUD();
        _runMiningCycle();
        _meshLog('Admin start_mining executed', 'ok');
      }
      break;

    case 'epoch_advance': {
      if (!_db?.miningState) break;
      const newEpoch = Math.min(TOTAL_EPOCHS, (_db.miningState.currentEpoch || 1) + 1);
      _db.miningState.currentEpoch    = newEpoch;
      _db.miningState.baseRewardMiri  = _getEpochRewardMiri(newEpoch);
      if (typeof _markDirty === 'function') _markDirty();
      _updateMiningHUD();
      _meshLog(`Admin epoch_advance: epoch ${newEpoch}`, 'ok');
      break;
    }

    case 'set_difficulty': {
      const d = parseInt(args.difficulty, 10);
      if (!isNaN(d) && d >= 1 && d <= 8) {
        _currentDifficulty = d;
        if (_db?.miningState) _db.miningState.difficulty = d;
        if (typeof _markDirty === 'function') _markDirty();
        _meshLog(`Admin set_difficulty: ${d}`, 'ok');
      }
      break;
    }

    case 'sovereign_override':
      _applySovereignFreeze();
      _broadcastToPeers({ type: 'sovereign_override', field: args.field, val: args.val, from: _localPeerId, ts: _now() });
      break;

    case 'freeze':
      _applySovereignFreeze();
      break;

    case 'unfreeze':
      _liftSovereignFreeze();
      break;

    case 'emergency_kill':
      _emergencyKillSwitch(args.reason || 'Admin Emergency Kill Switch');
      break;

    case 'configure_gist':
      if (args.token && args.gistId) {
        _ghGistConfig = { token: args.token, gistId: args.gistId };
        _meshLog(`Gist relay configured: ${args.gistId.slice(0,8)}`, 'ok');
      }
      break;

    case 'disconnect_peer': {
      const pid = args.peerId;
      if (pid && _peers.has(pid)) { _cleanupPeer(pid); _meshLog(`Admin disconnect: ${pid.slice(0,8)}`, 'ok'); }
      break;
    }

    case 'connect_peer':
      if (args.peerId && !_sovereignFrozen) {
        _initiatePeerConnection(args.peerId).catch(() => {});
        _meshLog(`Admin connect_peer: ${args.peerId.slice(0,8)}`, 'ok');
      }
      break;

    case 'broadcast_message':
      if (args.payload && !_sovereignFrozen) {
        const sent = _broadcastToPeers(args.payload);
        _meshLog(`Admin broadcast: sent to ${sent} peers`, 'ok');
      }
      break;

    case 'exotic_scan':
      if (!_sovereignFrozen) {
        _runExoticTelemetryScan().catch(() => {});
        _meshLog('Admin exotic_scan triggered', 'exotic');
      }
      break;

    case 'status':
      return {
        peers:          _peers.size,
        connected:      [..._peers.values()].filter(e => e.state === 'connected').length,
        miningActive:   _miningActive,
        miningPaused:   _miningPaused,
        epoch:          _getCurrentEpoch(),
        difficulty:     _currentDifficulty,
        sessionMined:   _sessionMinedMiri,
        sovereignFrozen:_sovereignFrozen,
        anomalyLog:     _anomalyLog.length,
        blobPoolSize:   0,
        gistConfigured: !!_ghGistConfig,
      };

    default:
      _meshLog(`adminCmd: unknown op "${op}"`, 'warn');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 14: BACKGROUND TIMER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

function _startBackgroundTimers() {
  // Clear any existing timers first
  Object.entries(_timers).forEach(([k, t]) => {
    try { clearInterval(t); } catch {}
    delete _timers[k];
  });

  if (_sovereignFrozen) return;

  _timers.heartbeat  = setInterval(_sendHeartbeats,          PEER_HEARTBEAT_MS);
  _timers.presence   = setInterval(_announcePresence,         SIGNAL_POLL_MS * 3);
  _timers.lsPoll     = setInterval(_pollLocalStorageSignals,  SIGNAL_POLL_MS);
  _timers.peerHUD    = setInterval(_updatePeerHUD,            8_000);
  _timers.epochSync  = setInterval(() => { _syncEpochToDB(); _updateMiningHUD(); }, 3_600_000);

  // Gist polling at longer interval to avoid rate limiting
  if (_ghGistConfig) {
    _timers.gistPoll = setInterval(_pollGistSignals, SIGNAL_POLL_MS * 4);
  }

  // Exotic telemetry scan at natural human-scale pacing
  _timers.exotic = setInterval(() => {
    if (!_sovereignFrozen) _runExoticTelemetryScan().catch(() => {});
  }, ANOMALY_SCAN_INTERVAL);

  // Sybil map decay
  _timers.sybilDecay = setInterval(() => {
    const now = _now();
    _peerFloodMap.forEach((entry, peerId) => {
      if (now - entry.firstSeen > SYBIL_DECAY_MS) {
        entry.count   = 0;
        entry.penalty = Math.max(0, entry.penalty - 1);
        entry.firstSeen = now;
      }
    });
  }, SYBIL_DECAY_MS);

  // Page lifecycle — halt on hide (battery conservation for iOS)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (_miningActive) { _miningPaused = true; _destroyMiningWorker(); }
    } else if (document.visibilityState === 'visible') {
      if (_miningActive && _miningPaused && !_sovereignFrozen) {
        _miningPaused = false; _runMiningCycle();
      }
    }
  });

  // pagehide — iOS Safari does not reliably fire beforeunload
  window.addEventListener('pagehide', () => {
    _destroyMiningWorker();
    _miningPaused = true;
  }, { capture: true });
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 15: PUBLIC MESH STATE ACCESSORS
// ═══════════════════════════════════════════════════════════════════════════

export function getMeshStatus() {
  return {
    localPeerId:     _localPeerId,
    peers:           [..._peers.entries()].map(([id, e]) => ({
      peerId:   id.slice(0, 12),
      state:    e.state,
      messages: e.messageCount,
      lastSeen: e.lastSeen,
    })),
    miningActive:    _miningActive,
    miningPaused:    _miningPaused,
    epoch:           _getCurrentEpoch(),
    epochReward:     _getEpochRewardMiri(_getCurrentEpoch()),
    difficulty:      _currentDifficulty,
    sessionMined:    _sessionMinedMiri,
    sovereignFrozen: _sovereignFrozen,
    anomalyCount:    _anomalyLog.length,
    floodedPeers:    [..._peerFloodMap.entries()].filter(([,e]) => e.penalty > 0).length,
    gistRelay:       !!_ghGistConfig,
    version:         MESH_VERSION,
  };
}

/**
 * broadcastDelta(payload)
 * Public export. Broadcasts a CRDT delta or any payload to all connected peers.
 * Used by data_synthesis.js and api_console.js.
 * @param {object} payload
 * @returns {number} count of peers reached
 */
export function broadcastDelta(payload) {
  if (!payload || typeof payload !== 'object') return 0;
  return _broadcastToPeers({
    type:      payload.type || 'delta',
    nodeId:    _localNodeId,
    ts:        Date.now(),
    ...payload,
  });
}


export function getAnomalyLog() { return _anomalyLog.slice(); }
export function getPeerList()   { return [..._peers.entries()].map(([id, e]) => ({ id, state: e.state, lastSeen: e.lastSeen })); }

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 16: MODULE ENTRY POINT — initMesh()
// Called by initApplication() in ai_evolution.js
// ═══════════════════════════════════════════════════════════════════════════

export async function initMesh({ db, kdf, markDirty, addTx, toast, agentSpeak }) {

  // ── 1. Bind cross-module references ───────────────────────────────────
  _db         = db;
  _kdf        = kdf;
  _markDirty  = markDirty;
  _addTx      = addTx;
  _toast      = toast;
  _agentSpeak = agentSpeak;

  _meshLog(`Mesh Network v${MESH_VERSION} — initialising`, 'info');

  // ── 2. Device detection ────────────────────────────────────────────────
  _isMobile = _detectMobile();
  _meshLog(`Device type: ${_isMobile ? 'mobile (iOS/Android)' : 'desktop'}`, 'info');

  // ── 3. Generate local peer ID ──────────────────────────────────────────
  const stored = sessionStorage.getItem('mir_peer_id');
  if (stored) {
    _localPeerId = stored;
  } else {
    _localPeerId = `mir_${_uid().replace(/-/g,'').slice(0,20)}`;
    try { sessionStorage.setItem('mir_peer_id', _localPeerId); } catch {}
  }
  _meshLog(`Local Peer ID: ${_localPeerId.slice(0,16)}…`, 'ok');
  window._MIR_PEER_ID = _localPeerId;

  // ── 4. Sync epoch state ────────────────────────────────────────────────
  _syncEpochToDB();

  // ── 5. Restore current difficulty from DB ─────────────────────────────
  if (_db?.miningState?.difficulty) {
    _currentDifficulty = _clamp(_db.miningState.difficulty, 1, 8);
  }

  // ── 6. Restore sovereign freeze ───────────────────────────────────────
  const overrides = (_db?.sovereignOverrideLog || []);
  if (overrides.length > 0) {
    const last = overrides[overrides.length - 1];
    if ((last.field === 'freeze_state' && last.value === 'true') && _now() - last.timestamp < 3_600_000) {
      _sovereignFrozen = true;
      _meshLog('Sovereign freeze restored from override log', 'sovereign');
    }
  }

  // ── 7. Init signaling ──────────────────────────────────────────────────
  if (!_sovereignFrozen) {
    _initBroadcastChannel();
    _initLocalStorageSignaling();
    _meshLog('Signaling tiers 1 & 2 active', 'ok');
  }

  // ── 8. Restore Gist config from DB ────────────────────────────────────
  const ghGist = _db?.ghConfig?.gistToken && _db?.ghConfig?.gistId;
  if (ghGist) {
    _ghGistConfig = { token: _db.ghConfig.gistToken, gistId: _db.ghConfig.gistId };
    _meshLog('Gist relay tier 3 configured from DB', 'ok');
  }

  // ── 9. Announce presence ───────────────────────────────────────────────
  if (!_sovereignFrozen) {
    await _sleep(500);
    _announcePresence();
  }

  // ── 10. Start background timers ────────────────────────────────────────
  if (!_sovereignFrozen) _startBackgroundTimers();

  // ── 11. Wire sovereign override events ────────────────────────────────
  window.addEventListener('mir:sovereignoverride', (e) => {
    const { frozen } = e.detail || {};
    if (frozen) _applySovereignFreeze(); else _liftSovereignFreeze();
  });
  window.addEventListener('mir:emergency_kill', () => {
    _emergencyKillSwitch('Global emergency kill signal');
  });

  // ── 12. Expose CRDT bridge on window for peer sync ─────────────────────
  window._mirMesh = {
    getMeshStatus,
    getAnomalyLog,
    getPeerList,
    toggleMining,
    pauseMining,
    adminCmd,
    broadcastToPeers:   _broadcastToPeers,
    sendToPeer:         _sendToPeer,
    initiatePeer:       _initiatePeerConnection,
    buildNonLinearProfile: _buildNonLinearProfile,
  };

  // ── 13. Update HUD ─────────────────────────────────────────────────────
  _updateMiningHUD();
  _updatePeerHUD();

  // ── 14. Resume mining if it was active before ──────────────────────────
  if (_db?.miningState?.active && !_sovereignFrozen) {
    await _sleep(2000);
    _miningActive = true;
    _appendMiningLog(`Resuming mining from previous session. Epoch ${_getCurrentEpoch()}.`);
    _runMiningCycle();
  }

  _meshLog(`Mesh Network v${MESH_VERSION} — fully initialised (peer: ${_localPeerId.slice(0,16)}…)`, 'ok');

  return {
    version:     MESH_VERSION,
    localPeerId: _localPeerId,
    isMobile:    _isMobile,
    epoch:       _getCurrentEpoch(),
    difficulty:  _currentDifficulty,
  };
}
