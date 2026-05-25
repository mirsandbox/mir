/**
 * welcome_overlay.js
 * Version:      1.0.0
 * Arch Hash:    0cd97f1b6a24d823
 * Last Sync:    PHASE-3
 *
 * MIR Platform — Sovereign Onboarding Flow
 *
 * Self-contained module. Injects CSS + HTML into DOM, then runs.
 * Called once from index.html after boot overlay hides.
 *
 * Flow:
 *   Step 0: Welcome — What is MIR
 *   Step 1: Public Key explained (safe to share)
 *   Step 2: Private Key explained + security warning
 *   Step 3: Cryptographic Access Gate (optional referral key)
 *   Step 4: Generate or Import identity
 *
 * Cross-module interfaces:
 *   Calls: window._mirKDF.generateIdentity()       (identity_kdf.js)
 *   Calls: window._mirKDF.saveKeyLocally()          (identity_kdf.js)
 *   Calls: window._mirKDF.exportEncryptedBackup()   (identity_kdf.js)
 *   Calls: window.openAuthModal()                   (ai_evolution.js)
 *   Reads: window._MIR_DB                           (ai_evolution.js)
 *   Reads: localStorage['mir_onboarding_done_v2']   (first-visit flag)
 */

'use strict';

const WO_VERSION      = '1.0.0';
const VISITED_KEY     = 'mir_onboarding_done_v2';
const ACCESS_KEY_KEY  = 'mir_access_key_v2';
const TOTAL_STEPS     = 5;

// ─────────────────────────────────────────────────────────────────────────
// CSS — Tactical HUD theme, mobile-first
// ─────────────────────────────────────────────────────────────────────────
const WO_CSS = `
#wo-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 99990;
  background: rgba(0,0,0,0.97);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
#wo-overlay.wo-open { display: flex; }

.wo-panel {
  width: min(520px, 96vw);
  margin: auto;
  background: #020a14;
  border: 1px solid #00ff00;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 0 60px rgba(0,255,0,0.12),
              0 0 120px rgba(0,255,0,0.04),
              inset 0 0 40px rgba(0,255,0,0.02);
  overflow: hidden;
  /* scanline */
  background-image: repeating-linear-gradient(
    0deg, transparent 0px, transparent 3px,
    rgba(0,255,0,0.012) 3px, rgba(0,255,0,0.012) 4px
  );
  max-height: 90vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* Header */
.wo-header {
  padding: 1.1rem 1.3rem 0.7rem;
  border-bottom: 1px solid #0a1a0a;
  flex-shrink: 0;
}
.wo-brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.5rem;
}
.wo-brand-hex {
  font-size: 1.4rem;
  color: #00ff00;
  text-shadow: 0 0 12px rgba(0,255,0,0.6);
  animation: wo-pulse 2s ease-in-out infinite;
  line-height: 1;
}
@keyframes wo-pulse {
  0%,100% { opacity:1; text-shadow:0 0 12px rgba(0,255,0,0.6); }
  50%      { opacity:0.7; text-shadow:0 0 24px rgba(0,255,0,0.9); }
}
.wo-brand-title {
  font-family: 'Orbitron', var(--font-hud, monospace);
  font-size: 0.72rem;
  font-weight: 900;
  color: #00ff00;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  text-shadow: 0 0 10px rgba(0,255,0,0.4);
}
.wo-brand-sub {
  font-family: var(--font-data, monospace);
  font-size: 0.56rem;
  color: #1a3a1a;
  letter-spacing: 0.08em;
}
.wo-step-indicator {
  display: flex;
  gap: 0.3rem;
  align-items: center;
}
.wo-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: #0a1a0a;
  border: 1px solid #1a3a1a;
  transition: all 0.2s;
}
.wo-dot.wo-active {
  background: #00ff00;
  border-color: #00ff00;
  box-shadow: 0 0 6px rgba(0,255,0,0.5);
}
.wo-dot.wo-done {
  background: #003300;
  border-color: #00aa00;
}

/* Step content */
.wo-step {
  display: none;
  padding: 1.2rem 1.3rem;
  flex-direction: column;
  gap: 0.85rem;
  animation: wo-fadein 0.25s ease;
  flex: 1;
}
.wo-step.wo-active { display: flex; }
@keyframes wo-fadein {
  from { opacity:0; transform:translateY(6px); }
  to   { opacity:1; transform:translateY(0); }
}

.wo-step-num {
  font-family: var(--font-hud, monospace);
  font-size: 0.55rem;
  color: #1a4a1a;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.wo-step-title {
  font-family: 'Orbitron', var(--font-hud, monospace);
  font-size: 0.75rem;
  font-weight: 700;
  color: #00ff00;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-shadow: 0 0 8px rgba(0,255,0,0.3);
}
.wo-body {
  font-family: var(--font-data, monospace);
  font-size: 0.72rem;
  color: #4a7a5a;
  line-height: 1.65;
}

/* Key cards */
.wo-key-card {
  border: 1px solid #0d1f0d;
  border-radius: 4px;
  padding: 0.85rem 1rem;
  background: rgba(0,255,0,0.02);
}
.wo-key-card.wo-pub  { border-color: #003300; }
.wo-key-card.wo-priv { border-color: #330000; background: rgba(255,0,0,0.02); }
.wo-key-label {
  font-family: 'Orbitron', var(--font-hud, monospace);
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 0.4rem;
}
.wo-pub  .wo-key-label { color: #00cc00; }
.wo-priv .wo-key-label { color: #cc3300; }
.wo-key-desc {
  font-family: var(--font-data, monospace);
  font-size: 0.68rem;
  line-height: 1.55;
}
.wo-pub  .wo-key-desc { color: #3a6a3a; }
.wo-priv .wo-key-desc { color: #5a3030; }
.wo-key-rule {
  font-size: 0.6rem;
  margin-top: 0.35rem;
  opacity: 0.7;
}

/* Warning banner */
.wo-warning {
  border: 1px solid #660000;
  background: rgba(180,0,0,0.06);
  border-radius: 3px;
  padding: 0.7rem 0.9rem;
  font-family: var(--font-data, monospace);
  font-size: 0.67rem;
  color: #cc2200;
  line-height: 1.55;
}
.wo-warning-title {
  font-family: 'Orbitron', var(--font-hud, monospace);
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: #ff2200;
  margin-bottom: 0.35rem;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

/* Access Gate */
.wo-gate-box {
  border: 1px solid #003300;
  border-radius: 4px;
  padding: 0.9rem 1rem;
  background: rgba(0,255,0,0.025);
}
.wo-gate-label {
  font-family: 'Orbitron', var(--font-hud, monospace);
  font-size: 0.58rem;
  color: #00aa00;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
}
.wo-gate-input {
  width: 100%;
  box-sizing: border-box;
  background: #000;
  border: 1px solid #1a3a1a;
  border-radius: 3px;
  color: #00ff00;
  font-family: 'Share Tech Mono', var(--font-data, monospace);
  font-size: 0.68rem;
  padding: 0.5rem 0.7rem;
  outline: none;
  transition: border-color 0.15s;
  caret-color: #00ff00;
  -webkit-appearance: none;
}
.wo-gate-input:focus { border-color: #00ff00; }
.wo-gate-input::placeholder { color: #1a3a1a; }
.wo-gate-hint {
  font-family: var(--font-data, monospace);
  font-size: 0.6rem;
  color: #1a3a1a;
  margin-top: 0.4rem;
}
.wo-gate-valid { color: #00cc00 !important; }
.wo-gate-skip {
  font-size: 0.6rem;
  color: #1a3a1a;
  cursor: pointer;
  text-decoration: underline;
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
  margin-top: 0.3rem;
  display: inline-block;
}
.wo-gate-skip:hover { color: #3a6a3a; }

/* Identity step */
.wo-identity-actions {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.wo-id-display {
  background: #000;
  border: 1px solid #0a1a0a;
  border-radius: 3px;
  padding: 0.6rem 0.8rem;
  display: none;
}
.wo-id-display.wo-visible { display: block; }
.wo-id-label {
  font-family: 'Orbitron', var(--font-hud, monospace);
  font-size: 0.55rem;
  letter-spacing: 0.08em;
  margin-bottom: 0.3rem;
}
.wo-id-label.wo-pub-lbl  { color: #00aa00; }
.wo-id-label.wo-priv-lbl { color: #cc3300; }
.wo-id-val {
  font-family: 'Share Tech Mono', var(--font-data, monospace);
  font-size: 0.6rem;
  word-break: break-all;
  line-height: 1.5;
  color: #2a5a2a;
}
.wo-priv .wo-id-val { color: #5a2a2a; }

/* Buttons */
.wo-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  width: 100%;
  box-sizing: border-box;
  padding: 0.65rem 1rem;
  border-radius: 3px;
  font-family: 'Orbitron', var(--font-hud, monospace);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid;
  min-height: 44px; /* iOS touch target */
  -webkit-tap-highlight-color: transparent;
}
.wo-btn-primary {
  background: rgba(0,255,0,0.1);
  border-color: #00ff00;
  color: #00ff00;
}
.wo-btn-primary:hover:not(:disabled) {
  background: rgba(0,255,0,0.18);
  box-shadow: 0 0 14px rgba(0,255,0,0.25);
}
.wo-btn-primary:active { transform: scale(0.98); }
.wo-btn-secondary {
  background: transparent;
  border-color: #1a3a1a;
  color: #2a5a2a;
}
.wo-btn-secondary:hover { border-color: #00aa00; color: #00aa00; }
.wo-btn-danger {
  background: rgba(180,0,0,0.07);
  border-color: #660000;
  color: #cc2200;
}
.wo-btn-danger:hover { background: rgba(180,0,0,0.14); border-color: #aa0000; }
.wo-btn:disabled { opacity: 0.35; cursor: not-allowed; }

/* Nav row */
.wo-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.8rem 1.3rem;
  border-top: 1px solid #0a1a0a;
  gap: 0.5rem;
  flex-shrink: 0;
}
.wo-nav-skip {
  background: transparent;
  border: none;
  color: #1a3a1a;
  font-family: var(--font-data, monospace);
  font-size: 0.6rem;
  cursor: pointer;
  padding: 0.3rem;
  min-height: 44px;
  display: flex;
  align-items: center;
  -webkit-tap-highlight-color: transparent;
}
.wo-nav-skip:hover { color: #3a6a3a; }
.wo-nav-next {
  display: flex;
  gap: 0.5rem;
}

/* Generating spinner */
.wo-spinner {
  display: none;
  width: 16px; height: 16px;
  border: 2px solid #003300;
  border-top-color: #00ff00;
  border-radius: 50%;
  animation: wo-spin 0.6s linear infinite;
  flex-shrink: 0;
}
.wo-generating .wo-spinner { display: block; }
@keyframes wo-spin { to { transform: rotate(360deg); } }

/* Mobile optimisations */
@media (max-width: 420px) {
  .wo-panel { border-radius: 0; min-height: 100vh; max-height: 100vh; }
  .wo-step  { padding: 1rem; }
  .wo-step-title { font-size: 0.68rem; }
  .wo-body  { font-size: 0.7rem; }
}
`;

// ─────────────────────────────────────────────────────────────────────────
// HTML TEMPLATE
// ─────────────────────────────────────────────────────────────────────────
function _buildHTML() {
  return `
<div id="wo-overlay" role="dialog" aria-modal="true" aria-label="MIR Platform Onboarding">
  <div class="wo-panel" id="wo-panel">

    <!-- Header -->
    <div class="wo-header">
      <div class="wo-brand">
        <div class="wo-brand-hex">⬡</div>
        <div>
          <div class="wo-brand-title">MIR Platform</div>
          <div class="wo-brand-sub">SOVEREIGN INTELLIGENCE NETWORK · v2.0</div>
        </div>
      </div>
      <div class="wo-step-indicator" id="wo-dots"></div>
    </div>

    <!-- Step 0: Welcome -->
    <div class="wo-step wo-active" id="wo-step-0">
      <div class="wo-step-num">Initialisation · Step 1 of ${TOTAL_STEPS}</div>
      <div class="wo-step-title">Sovereign Node Activation</div>
      <div class="wo-body">
        MIR is a <strong style="color:#00cc00">decentralised sovereign intelligence platform</strong>.
        It runs entirely in your browser — no central servers, no custodians.
      </div>
      <div class="wo-body">
        You will analyse geopolitical scenarios, contribute intelligence,
        earn reputation (FRS), mine MIR tokens, and trade peer-to-peer.
        Your identity is a <strong style="color:#00cc00">cryptographic keypair</strong>
        generated locally — it never leaves your device unless you export it.
      </div>
      <div class="wo-body" style="color:#1a4a1a;font-size:0.65rem">
        ▸ This orientation takes approximately 2 minutes.<br>
        ▸ All steps can be completed on mobile.
      </div>
    </div>

    <!-- Step 1: Public Key -->
    <div class="wo-step" id="wo-step-1">
      <div class="wo-step-num">Identity Architecture · Step 2 of ${TOTAL_STEPS}</div>
      <div class="wo-step-title">Your Public Key — Open Channel</div>
      <div class="wo-key-card wo-pub">
        <div class="wo-key-label">🔓 Public Key = Your Network Address</div>
        <div class="wo-key-desc">
          Your public key is a long hex string that uniquely identifies you on the MIR network.
          Think of it as your bank account number — share it freely.
        </div>
        <div class="wo-key-rule">✓ Safe to share &nbsp;·&nbsp; ✓ Receive MIR &nbsp;·&nbsp; ✓ Post publicly &nbsp;·&nbsp; ✓ Others verify your signatures</div>
      </div>
      <div class="wo-body">
        Every intelligence post, prediction, and transaction you make is
        cryptographically signed with your key. Peers verify your identity
        without any central authority.
      </div>
    </div>

    <!-- Step 2: Private Key + Warning -->
    <div class="wo-step" id="wo-step-2">
      <div class="wo-step-num">Identity Architecture · Step 3 of ${TOTAL_STEPS}</div>
      <div class="wo-step-title">Your Private Key — Sovereign Secret</div>
      <div class="wo-key-card wo-priv">
        <div class="wo-key-label">🔑 Private Key = Your Permanent Sovereign Identity</div>
        <div class="wo-key-desc">
          Your private key proves you own your account. It signs every action you take.
          It is generated once, locally, and never transmitted over the network.
        </div>
        <div class="wo-key-rule" style="color:#663333">✗ Never share &nbsp;·&nbsp; ✗ Never cloud-store &nbsp;·&nbsp; ✗ No screenshots</div>
      </div>
      <div class="wo-warning">
        <div class="wo-warning-title">⚠ CRITICAL SECURITY DIRECTIVE</div>
        MIR is fully decentralised. There is <strong>NO</strong> password reset,
        <strong>NO</strong> account recovery, and <strong>NO</strong> customer support.
        If you lose your private key, your account and all funds are
        <strong>permanently and irrecoverably lost</strong>.
        After generating your key, use the EXPORT BACKUP function immediately
        to create an AES-256-GCM encrypted .json backup file.
      </div>
    </div>

    <!-- Step 3: Access Gate (referral key) -->
    <div class="wo-step" id="wo-step-3">
      <div class="wo-step-num">Node Activation · Step 4 of ${TOTAL_STEPS}</div>
      <div class="wo-step-title">Cryptographic Access Gate</div>
      <div class="wo-body">
        If you received an <strong style="color:#00cc00">Access Key</strong> from an existing
        MIR node operator, enter it below. Activating via an Access Key routes
        50% of your initial mining rewards to your inviter as a peer incentive.
      </div>
      <div class="wo-gate-box">
        <div class="wo-gate-label">◈ Access Key (ED25519 Public Key Hash)</div>
        <input type="text"
               id="wo-access-key-input"
               class="wo-gate-input"
               placeholder="mir_acc_..."
               maxlength="120"
               autocomplete="off"
               spellcheck="false"
               autocorrect="off"
               autocapitalize="none"
               inputmode="text"/>
        <div class="wo-gate-hint" id="wo-gate-hint">Enter the Access Key provided by your inviter, or skip.</div>
        <button class="wo-gate-skip" onclick="window._mirWelcome._skipAccess()">
          No Access Key — continue without referral
        </button>
      </div>
    </div>

    <!-- Step 4: Generate Identity -->
    <div class="wo-step" id="wo-step-4">
      <div class="wo-step-num">Sovereign Identity · Step 5 of ${TOTAL_STEPS}</div>
      <div class="wo-step-title">Generate Your Sovereign Identity</div>
      <div class="wo-body">
        Click <strong style="color:#00cc00">GENERATE MY SOVEREIGN IDENTITY</strong>
        to create a new ED25519 keypair locally in your browser.
        Your keys are generated using the Web Crypto API — never sent to any server.
      </div>

      <!-- Generated key display -->
      <div class="wo-id-display" id="wo-id-pub-display">
        <div class="wo-id-label wo-pub-lbl">PUBLIC KEY — share freely</div>
        <div class="wo-id-val" id="wo-id-pub-val">—</div>
      </div>
      <div class="wo-id-display" id="wo-id-priv-display" style="border-color:#1a0a0a">
        <div class="wo-id-label wo-priv-lbl">PRIVATE KEY — never share — copy now</div>
        <div class="wo-id-val" id="wo-id-priv-val" style="color:#5a2a2a">—</div>
      </div>

      <div class="wo-identity-actions">
        <button class="wo-btn wo-btn-primary" id="wo-gen-btn"
                onclick="window._mirWelcome._generateIdentity()">
          <span class="wo-spinner" id="wo-gen-spinner"></span>
          GENERATE MY SOVEREIGN IDENTITY
        </button>

        <!-- Post-generation actions (hidden until generated) -->
        <div id="wo-post-gen" style="display:none;display:flex;flex-direction:column;gap:0.5rem">
          <button class="wo-btn wo-btn-secondary" id="wo-export-btn"
                  onclick="window._mirWelcome._exportBackup()">
            ⬇ DOWNLOAD ENCRYPTED BACKUP (.json)
          </button>
          <button class="wo-btn wo-btn-primary" id="wo-proceed-btn"
                  onclick="window._mirWelcome._proceedToApp()">
            ⬡ ACTIVATE SOVEREIGN NODE →
          </button>
        </div>

        <!-- Alternative: already have a key -->
        <button class="wo-btn wo-btn-secondary" id="wo-import-btn"
                onclick="window._mirWelcome._openImport()">
          Already have a key — Login
        </button>
      </div>
    </div>

    <!-- Navigation -->
    <div class="wo-nav">
      <button class="wo-nav-skip" id="wo-skip-btn"
              onclick="window._mirWelcome.close()">
        SKIP INTRO
      </button>
      <div class="wo-nav-next">
        <button class="wo-btn wo-btn-secondary" id="wo-back-btn"
                style="padding:0.55rem 0.9rem;width:auto"
                onclick="window._mirWelcome.back()">
          ← BACK
        </button>
        <button class="wo-btn wo-btn-primary" id="wo-next-btn"
                style="padding:0.55rem 0.9rem;width:auto;min-width:100px"
                onclick="window._mirWelcome.next()">
          NEXT →
        </button>
      </div>
    </div>

  </div>
</div>
`;
}

// ─────────────────────────────────────────────────────────────────────────
// CONTROLLER
// ─────────────────────────────────────────────────────────────────────────

let _step        = 0;
let _accessKey   = '';
let _generatedKP = null;
let _injected    = false;

function _$(id) { return document.getElementById(id); }

function _updateDots() {
  const container = _$('wo-dots');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < TOTAL_STEPS; i++) {
    const dot = document.createElement('div');
    dot.className = 'wo-dot' +
      (i === _step ? ' wo-active' : i < _step ? ' wo-done' : '');
    container.appendChild(dot);
  }
}

function _updateNav() {
  const nextBtn = _$('wo-next-btn');
  const backBtn = _$('wo-back-btn');
  const skipBtn = _$('wo-skip-btn');

  if (nextBtn) {
    if (_step === TOTAL_STEPS - 1) {
      nextBtn.style.display = 'none'; // Identity step has own buttons
    } else {
      nextBtn.style.display = '';
      nextBtn.textContent   = _step === TOTAL_STEPS - 2 ? 'PROCEED →' : 'NEXT →';
    }
  }
  if (backBtn) backBtn.style.display = _step === 0 ? 'none' : '';
  if (skipBtn) skipBtn.textContent   = _step === TOTAL_STEPS - 1 ? 'SKIP FOR NOW' : 'SKIP INTRO';
}

function _goTo(n) {
  const clamped = Math.max(0, Math.min(TOTAL_STEPS - 1, n));
  for (let i = 0; i < TOTAL_STEPS; i++) {
    const el = _$(`wo-step-${i}`);
    if (el) el.classList.toggle('wo-active', i === clamped);
  }
  _step = clamped;
  _updateDots();
  _updateNav();
  // Scroll panel to top on step change
  const panel = _$('wo-panel');
  if (panel) panel.scrollTop = 0;
}

async function _generateIdentity() {
  const genBtn = _$('wo-gen-btn');
  const spinner= _$('wo-gen-spinner');
  if (genBtn) { genBtn.disabled = true; genBtn.classList.add('wo-generating'); }
  if (spinner) spinner.style.display = 'block';

  try {
    let kp = null;
    // Use identity_kdf.js bridge
    if (window._mirKDF?.generateIdentity) {
      kp = await window._mirKDF.generateIdentity();
    } else if (typeof window.generateKeypair === 'function') {
      // Fallback: use ai_evolution.js generateKeypair which sets _pendingKeypair
      await window.generateKeypair();
      // Get from DOM display
      const pubEl  = document.getElementById('gen-pubkey');
      const privEl = document.getElementById('gen-privkey');
      if (pubEl && privEl) {
        kp = { pubKey: pubEl.textContent.trim(), privKeyB64: privEl.textContent.trim() };
      }
    }

    if (!kp?.pubKey) throw new Error('Key generation failed — Web Crypto API unavailable');

    _generatedKP = kp;

    // Display
    const pubDisplay  = _$('wo-id-pub-display');
    const privDisplay = _$('wo-id-priv-display');
    const pubVal      = _$('wo-id-pub-val');
    const privVal     = _$('wo-id-priv-val');
    const postGen     = _$('wo-post-gen');
    const importBtn   = _$('wo-import-btn');

    if (pubVal)  pubVal.textContent  = kp.pubKey;
    if (privVal) privVal.textContent = kp.privKeyB64 || kp.privKey || '—';
    if (pubDisplay)  pubDisplay.classList.add('wo-visible');
    if (privDisplay) privDisplay.classList.add('wo-visible');
    if (postGen)  { postGen.style.display = 'flex'; }
    if (genBtn)   genBtn.style.display  = 'none';
    if (importBtn)importBtn.style.display= 'none';

    // Save to localStorage
    if (window._mirKDF?.saveKeyLocally) {
      window._mirKDF.saveKeyLocally(kp.privKeyB64 || kp.privKey || '', kp.pubKey, '');
    }

    // Store access key referral if set
    if (_accessKey) {
      try { localStorage.setItem(ACCESS_KEY_KEY, _accessKey); } catch {}
    }

  } catch (err) {
    console.error('[WO] Identity generation failed:', err.message);
    const genBtn2 = _$('wo-gen-btn');
    if (genBtn2) {
      genBtn2.textContent = '⚠ GENERATION FAILED — RETRY';
      genBtn2.disabled    = false;
      genBtn2.classList.remove('wo-generating');
    }
  } finally {
    if (spinner) spinner.style.display = 'none';
  }
}

async function _exportBackup() {
  if (!_generatedKP) return;
  const password = window.prompt(
    'Set a backup password (minimum 8 characters):\n\n' +
    'This password encrypts your private key in the .json file.\n' +
    'You MUST remember it — it cannot be recovered.'
  );
  if (!password) return;
  if (password.length < 8) {
    window.alert('Password too short. Please use at least 8 characters.');
    return;
  }
  try {
    if (window._mirKDF?.exportEncryptedBackup) {
      const ok = await window._mirKDF.exportEncryptedBackup(
        _generatedKP.privKeyB64 || _generatedKP.privKey || '',
        _generatedKP.pubKey,
        '',
        password
      );
      if (ok) window.alert('Encrypted backup downloaded.\nStore it safely — you need BOTH the file and your password to restore.');
    } else {
      // Manual fallback download
      const payload = JSON.stringify({
        version: 'MIR-IDENTITY-BACKUP-V2',
        pubKey:  _generatedKP.pubKey,
        note:    'ENCRYPT THIS FILE — raw export fallback (identity_kdf.js not available)',
        privKey: _generatedKP.privKeyB64,
        warning: 'KEEP PRIVATE. Never share this file.',
        ts:      Date.now(),
      }, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `MIR_IDENTITY_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  } catch (err) {
    console.error('[WO] Export failed:', err.message);
  }
}

function _proceedToApp() {
  try { localStorage.setItem(VISITED_KEY, '1'); } catch {}
  _close();
  // Open auth modal to complete registration
  if (_generatedKP && typeof window.openAuthModal === 'function') {
    // Pre-fill the register form if possible
    setTimeout(() => {
      window.openAuthModal();
      const tab = document.getElementById('auth-register');
      const loginTab = document.querySelector('.tab-btn');
      if (loginTab) {
        // Click register tab
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(t => {
          if (t.textContent.includes('REGISTER')) t.click();
        });
      }
      // Pre-fill generated keypair
      setTimeout(() => {
        const pubEl  = document.getElementById('gen-pubkey');
        const privEl = document.getElementById('gen-privkey');
        const kpDisp = document.getElementById('keypair-display');
        if (pubEl && privEl && _generatedKP) {
          pubEl.textContent  = _generatedKP.pubKey;
          privEl.textContent = _generatedKP.privKeyB64 || '';
          if (kpDisp) kpDisp.style.display = 'block';
        }
      }, 100);
    }, 300);
  }
}

function _openImport() {
  try { localStorage.setItem(VISITED_KEY, '1'); } catch {}
  _close();
  if (typeof window.openAuthModal === 'function') {
    setTimeout(() => window.openAuthModal(), 300);
  }
}

function _skipAccess() {
  _accessKey = '';
  const hint = _$('wo-gate-hint');
  if (hint) { hint.textContent = 'Continuing without referral.'; hint.className = 'wo-gate-hint wo-gate-valid'; }
  setTimeout(() => _goTo(_step + 1), 400);
}

// Validate access key input
function _onAccessKeyInput(val) {
  _accessKey = val.trim();
  const hint = _$('wo-gate-hint');
  if (!hint) return;
  if (!_accessKey) {
    hint.textContent = 'Enter the Access Key provided by your inviter, or skip.';
    hint.className   = 'wo-gate-hint';
  } else if (_accessKey.length >= 16) {
    hint.textContent = '✓ Access Key accepted — peer referral reward will activate on first block.';
    hint.className   = 'wo-gate-hint wo-gate-valid';
  } else {
    hint.textContent = 'Key too short — Access Keys are at least 16 characters.';
    hint.className   = 'wo-gate-hint';
    hint.style.color = '#663333';
  }
}

function _open() {
  const ov = _$('wo-overlay');
  if (ov) ov.classList.add('wo-open');
  _goTo(0);
}

function _close() {
  const ov = _$('wo-overlay');
  if (ov) ov.classList.remove('wo-open');
  try { localStorage.setItem(VISITED_KEY, '1'); } catch {}
}

// ─────────────────────────────────────────────────────────────────────────
// DOM INJECTION
// ─────────────────────────────────────────────────────────────────────────
function _inject() {
  if (_injected) return;
  _injected = true;

  // Inject CSS
  const style    = document.createElement('style');
  style.id       = 'wo-styles';
  style.textContent = WO_CSS;
  document.head.appendChild(style);

  // Inject HTML
  const container       = document.createElement('div');
  container.innerHTML   = _buildHTML();
  document.body.appendChild(container.firstElementChild);

  // Wire access key input
  const akInput = _$('wo-access-key-input');
  if (akInput) {
    akInput.addEventListener('input', () => _onAccessKeyInput(akInput.value));
  }

  // Keyboard
  document.addEventListener('keydown', e => {
    const ov = _$('wo-overlay');
    if (!ov?.classList.contains('wo-open')) return;
    if (e.key === 'ArrowRight' || e.key === 'Enter' && _step < TOTAL_STEPS - 1) {
      e.preventDefault();
      module_exports.next();
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      module_exports.back();
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────
// PUBLIC MODULE EXPORTS
// ─────────────────────────────────────────────────────────────────────────
const module_exports = {
  show() { _inject(); _open(); },
  close: _close,
  next() {
    if (_step < TOTAL_STEPS - 1) _goTo(_step + 1);
    else _close();
  },
  back() { if (_step > 0) _goTo(_step - 1); },

  // Exposed for onclick handlers in HTML
  _generateIdentity,
  _exportBackup,
  _proceedToApp,
  _openImport,
  _skipAccess,
};

export const show        = module_exports.show;
export const close       = module_exports.close;
export const next        = module_exports.next;
export const back        = module_exports.back;

/**
 * initWelcomeOverlay()
 * Main entry point. Call from index.html after boot completes.
 * Shows only on first visit; silent no-op on subsequent visits.
 */
export function initWelcomeOverlay() {
  // Inject DOM first (idempotent)
  _inject();

  // Expose on window for onclick handlers
  window._mirWelcome = module_exports;

  // First-visit check
  try {
    if (localStorage.getItem(VISITED_KEY)) return; // already onboarded
  } catch { return; }

  // Wait for boot overlay to hide
  const boot = document.getElementById('boot-overlay');
  if (!boot || boot.classList.contains('hidden')) {
    setTimeout(_open, 500);
    return;
  }

  // Watch for boot overlay to clear
  const obs = new MutationObserver(() => {
    if (boot.classList.contains('hidden')) {
      obs.disconnect();
      setTimeout(_open, 400);
    }
  });
  obs.observe(boot, { attributes: true, attributeFilter: ['class'] });
}
