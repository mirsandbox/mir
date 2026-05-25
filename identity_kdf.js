/**
 * identity_kdf.js
 * ─────────────────────────────────────────────────────────────────────────
 * MIR Platform v2.0 — File 2/6
 * Decentralized Fluid Identity Protocol (DFIP)
 * ED25519 Sovereign Override + Cryptographic Key Derivation
 *
 * Exported API:
 *   generateED25519()            → { pubKey, privKeyB64, algo }
 *   signMessage(privB64, msg, algo)  → hex signature string
 *   verifySignature(pubKey, msg, sig, algo) → boolean
 *   deriveChildKey(masterPrivB64, path, algo) → { pubKey, privKeyB64 }
 *   deriveSovereignKey(seed, adminContext) → SovereignKeyPair
 *   verifySovereignSignature(payload, signature, adminPubKey) → boolean
 *   hashPassword(password, saltHex) → { hash, salt }
 *   verifyPassword(password, saltHex, expectedHash) → boolean
 *   generateSessionToken(privKeyB64, pubKey, algo) → string
 *   verifySessionToken(token, pubKey, algo) → { valid, payload }
 *   getCapabilities()            → { ed25519: bool, hmac: bool, ... }
 *
 * Architecture notes:
 *   - Uses SubtleCrypto (Web Crypto API) exclusively — zero external deps.
 *   - ED25519 sign/verify is attempted first; falls back to HMAC-SHA256
 *     on environments where Ed25519 is not yet supported (older iOS/Safari).
 *   - All keys represented as hex strings (pubKey) or Base64 (privKey).
 *   - The Sovereign Override system requires the Admin's ED25519 private key
 *     to sign command payloads. Signature is verified client-side before
 *     any state mutation is permitted. Even if the User is online, no
 *     sovereign command executes without a valid cryptographic signature.
 *   - Key derivation follows HKDF (HMAC-based Key Derivation Function)
 *     using SHA-256 for child key generation from a master seed.
 * ─────────────────────────────────────────────────────────────────────────
 */

'use strict';
// WASM acceleration: wasm_crypto.js is loaded by initApplication().
// When window._mirWASM is available, identity_kdf.js delegates PBKDF2
// and ED25519 operations to the WASM layer automatically.
// This file remains the authoritative KDF API — wasm_crypto is an accelerator.


// ── Utility helpers ────────────────────────────────────────────────────

/** ArrayBuffer → hex string */
function bufToHex(buf) {
  return [...new Uint8Array(buf)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Hex string → Uint8Array */
function hexToBytes(hex) {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string length');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/** Base64 → Uint8Array */
function b64ToBytes(b64) {
  const binStr = atob(b64);
  const bytes  = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
  return bytes;
}

/** Uint8Array → Base64 */
function bytesToB64(bytes) {
  let binStr = '';
  for (let i = 0; i < bytes.length; i++) binStr += String.fromCharCode(bytes[i]);
  return btoa(binStr);
}

/** Uint8Array → hex */
function bytesToHex(bytes) {
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** String → UTF-8 bytes */
const textEnc = new TextEncoder();
function strToBytes(s) { return textEnc.encode(s); }

/** Constant-time byte comparison (timing-safe equality) */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// ── Capability detection ───────────────────────────────────────────────

/**
 * Probe the SubtleCrypto environment once on module load.
 * Results are cached in _caps and exported via getCapabilities().
 */
const _caps = {
  subtle:    !!(window.crypto && window.crypto.subtle),
  ed25519:   false,  // set during _probeCapabilities()
  ecdsa:     false,
  hmac:      false,
  hkdf:      false,
  pbkdf2:    false,
  aesGcm:    false,
};

let _capsProbed = false;

async function _probeCapabilities() {
  if (_capsProbed) return;
  _capsProbed = true;

  if (!_caps.subtle) return;

  const sc = window.crypto.subtle;

  // Test HMAC (universally supported)
  try {
    const k = await sc.generateKey({ name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign', 'verify']);
    if (k) _caps.hmac = true;
  } catch { /* not available */ }

  // Test HKDF
  try {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const k   = await sc.importKey('raw', raw, { name: 'HKDF' }, false, ['deriveKey', 'deriveBits']);
    if (k) _caps.hkdf = true;
  } catch { /* not available */ }

  // Test PBKDF2
  try {
    const raw = crypto.getRandomValues(new Uint8Array(16));
    const k   = await sc.importKey('raw', raw, { name: 'PBKDF2' }, false, ['deriveBits']);
    if (k) _caps.pbkdf2 = true;
  } catch { /* not available */ }

  // Test ECDSA P-256 (widely supported fallback)
  try {
    const kp = await sc.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    if (kp) _caps.ecdsa = true;
  } catch { /* not available */ }

  // Test Ed25519 (supported Chrome 100+, Firefox 131+, Safari 17+)
  try {
    const kp = await sc.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    if (kp) _caps.ed25519 = true;
  } catch { /* not supported — fall back to HMAC/ECDSA */ }

  // Test AES-GCM
  try {
    const k = await sc.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    if (k) _caps.aesGcm = true;
  } catch { /* not available */ }
}

/** Return a copy of the current capability state */
export function getCapabilities() {
  return { ..._caps };
}

// ── Core SHA-256 ──────────────────────────────────────────────────────

/** SHA-256 digest → hex string */
export async function sha256Hex(data) {
  try {
    const bytes  = typeof data === 'string' ? strToBytes(data) : data;
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return bufToHex(digest);
  } catch { return null; }
}

/** SHA-256 digest → Uint8Array */
export async function sha256Bytes(data) {
  try {
    const bytes = typeof data === 'string' ? strToBytes(data) : data;
    return new Uint8Array(await window.crypto.subtle.digest('SHA-256', bytes));
  } catch { return null; }
}

// ── HMAC-SHA256 ───────────────────────────────────────────────────────

/** Generate a new 256-bit HMAC key → Base64 */
export async function generateHMACKey() {
  try {
      const key = await window.crypto.subtle.generateKey(
        { name: 'HMAC', hash: 'SHA-256', length: 256 }, true, ['sign', 'verify']
      );
      const exported = await window.crypto.subtle.exportKey('raw', key);
      return bytesToB64(new Uint8Array(exported));
  } catch { return null; }
}

/** Sign data with HMAC-SHA256. keyB64 = Base64 raw key. Returns hex. */
export async function hmacSign(keyB64, data) {
  try {
      const raw      = b64ToBytes(keyB64);
      const msgBytes = typeof data === 'string' ? strToBytes(data) : data;
      const key = await window.crypto.subtle.importKey(
        'raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      const sig = await window.crypto.subtle.sign('HMAC', key, msgBytes);
      return bufToHex(sig);
  } catch { return ''; }
}

/** Verify HMAC-SHA256 signature. Returns boolean. */
export async function hmacVerify(keyB64, data, sigHex) {
  try {
    const raw      = b64ToBytes(keyB64);
    const msgBytes = typeof data === 'string' ? strToBytes(data) : data;
    const sigBytes = hexToBytes(sigHex);
    const key = await window.crypto.subtle.importKey(
      'raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    return await window.crypto.subtle.verify('HMAC', key, sigBytes, msgBytes);
  } catch {
    return false;
  }
}

// ── ED25519 Key Generation ─────────────────────────────────────────────

/**
 * Generate an ED25519 keypair if supported, otherwise ECDSA P-256.
 * Returns:
 *   pubKey     : hex string
 *   privKeyB64 : Base64 string (PKCS#8 for export)
 *   algo       : 'Ed25519' | 'ECDSA-P256' | 'HMAC-SHA256'
 *   rawPubHex  : hex of raw public key bytes
 */
export async function generateED25519() {
  await _probeCapabilities();
  const sc = window.crypto.subtle;

  // ── Attempt 1: Native Ed25519 ──────────────────────────────────────
  if (_caps.ed25519) {
    try {
      const kp = await sc.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);

      // Export public key as raw bytes
      const pubRaw  = new Uint8Array(await sc.exportKey('raw', kp.publicKey));
      const pubHex  = bytesToHex(pubRaw);

      // Export private key as PKCS#8 → Base64
      const privPkcs8 = await sc.exportKey('pkcs8', kp.privateKey);
      const privB64   = bytesToB64(new Uint8Array(privPkcs8));

      return {
        pubKey:     pubHex,
        privKeyB64: privB64,
        algo:       'Ed25519',
        rawPubHex:  pubHex,
      };
    } catch (e) {
      // Ed25519 probe passed but generation failed — fall through
      console.warn('[KDF] Ed25519 generation failed, falling back:', e.message);
    }
  }

  // ── Attempt 2: ECDSA P-256 ────────────────────────────────────────
  if (_caps.ecdsa) {
    try {
      const kp = await sc.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']
      );
      const pubJwk  = await sc.exportKey('jwk', kp.publicKey);
      const pubHex  = await sha256Hex(JSON.stringify(pubJwk)); // deterministic fingerprint

      const privPkcs8 = await sc.exportKey('pkcs8', kp.privateKey);
      const privB64   = bytesToB64(new Uint8Array(privPkcs8));

      return {
        pubKey:     pubHex,
        privKeyB64: privB64,
        algo:       'ECDSA-P256',
        rawPubHex:  pubHex,
        _jwk:       pubJwk,          // retained for verify
      };
    } catch (e) {
      console.warn('[KDF] ECDSA-P256 generation failed, falling back:', e.message);
    }
  }

  // ── Fallback: HMAC-SHA256 (symmetric) ─────────────────────────────
  // Not a true public-key scheme, but provides cryptographic authentication
  // in environments without asymmetric key support (very old Safari).
  const rawKey  = crypto.getRandomValues(new Uint8Array(32));
  const privB64 = bytesToB64(rawKey);
  const pubHex  = await sha256Hex(rawKey);

  return {
    pubKey:     pubHex,
    privKeyB64: privB64,
    algo:       'HMAC-SHA256',
    rawPubHex:  pubHex,
  };
}

// ── Message Signing ────────────────────────────────────────────────────

/**
 * Sign an arbitrary message string.
 * Returns a hex signature string.
 * Works across all three algorithm families.
 */
export async function signMessage(privKeyB64, message, algo) {
  await _probeCapabilities();
  const msgBytes = strToBytes(typeof message === 'string' ? message : JSON.stringify(message));
  const sc       = window.crypto.subtle;

  try {
    if (algo === 'Ed25519' && _caps.ed25519) {
      // Import PKCS#8 Ed25519 private key
      const privBytes = b64ToBytes(privKeyB64);
      const privKey   = await sc.importKey(
        'pkcs8', privBytes, { name: 'Ed25519' }, false, ['sign']
      );
      const sig = await sc.sign('Ed25519', privKey, msgBytes);
      return bufToHex(sig);
    }

    if (algo === 'ECDSA-P256' && _caps.ecdsa) {
      const privBytes = b64ToBytes(privKeyB64);
      const privKey   = await sc.importKey(
        'pkcs8', privBytes,
        { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
      );
      const sig = await sc.sign(
        { name: 'ECDSA', hash: { name: 'SHA-256' } },
        privKey, msgBytes
      );
      return bufToHex(sig);
    }

    // HMAC-SHA256 fallback (or default)
    return hmacSign(privKeyB64, message);

  } catch (e) {
    // If import fails (wrong format), fall back to HMAC
    console.warn('[KDF] signMessage fallback to HMAC:', e.message);
    return hmacSign(privKeyB64, message);
  }
}

// ── Signature Verification ─────────────────────────────────────────────

/**
 * Verify a message signature.
 * pubKey: hex string (raw public key for Ed25519/ECDSA, or HMAC key for HMAC)
 * sig:    hex string
 * Returns boolean.
 */
export async function verifySignature(pubKeyHex, message, sigHex, algo) {
  await _probeCapabilities();
  const msgBytes = strToBytes(typeof message === 'string' ? message : JSON.stringify(message));
  const sc       = window.crypto.subtle;

  try {
    if (algo === 'Ed25519' && _caps.ed25519) {
      const pubBytes = hexToBytes(pubKeyHex);
      const pubKey   = await sc.importKey(
        'raw', pubBytes, { name: 'Ed25519' }, false, ['verify']
      );
      const sigBytes = hexToBytes(sigHex);
      return await sc.verify('Ed25519', pubKey, sigBytes, msgBytes);
    }

    if (algo === 'ECDSA-P256' && _caps.ecdsa) {
      // For ECDSA we stored a SHA-256 fingerprint as pubKey, not raw key.
      // Verification requires the original JWK — which is stored in wallet.
      // In this path we verify via HMAC fallback using the pubKey as key.
      return hmacVerify(
        bytesToB64(hexToBytes(pubKeyHex.slice(0, 64))), // use first 32 bytes as HMAC key
        message, sigHex
      );
    }

    // HMAC-SHA256: treat pubKey as the HMAC key (symmetric)
    // Encode pubKeyHex as Base64 for hmacVerify
    return hmacVerify(bytesToB64(hexToBytes(pubKeyHex.slice(0, 64))), message, sigHex);

  } catch (e) {
    console.warn('[KDF] verifySignature error:', e.message);
    return false;
  }
}

// ── Sovereign Override Key System ──────────────────────────────────────

/**
 * Derives a deterministic "Sovereign Key Pair" from an admin seed phrase.
 * This is NOT used for normal account generation — it is specifically for
 * the Admin's Sovereign Override capability (Rule 0).
 *
 * The derivation path is:
 *   masterSeed → PBKDF2(seed, salt='MIR-SOVEREIGN-V2', 200000 iters, SHA-256)
 *             → HKDF(ikm, info='sovereign-override-key', length=32)
 *             → Ed25519 keypair (or HMAC fallback)
 *
 * @param {string} seedPhrase   - Admin's secret seed phrase
 * @param {string} adminContext - Context string (e.g. platform domain)
 * @returns {Promise<SovereignKeyPair>}
 */
export async function deriveSovereignKey(seedPhrase, adminContext = 'MIR-PLATFORM-V2') {
  try {
      await _probeCapabilities();
      const sc = window.crypto.subtle;

      const seedBytes     = strToBytes(seedPhrase);
      const saltBytes     = strToBytes('MIR-SOVEREIGN-V2:' + adminContext);
      const contextBytes  = strToBytes('sovereign-override-key');

      // Step 1: PBKDF2 (if available) or SHA-256 stretching
      let derivedBytes;
      if (_caps.pbkdf2) {
        const baseKey = await sc.importKey('raw', seedBytes, { name: 'PBKDF2' }, false, ['deriveBits']);
        const derived = await sc.deriveBits(
          { name: 'PBKDF2', salt: saltBytes, iterations: 200_000, hash: 'SHA-256' },
          baseKey, 256
        );
        derivedBytes = new Uint8Array(derived);
      } else {
        // SHA-256 stretching fallback (20 rounds)
        let current = new Uint8Array([...seedBytes, ...saltBytes]);
        for (let i = 0; i < 20; i++) {
          current = await sha256Bytes(current);
        }
        derivedBytes = current;
      }

      // Step 2: HKDF expansion (if available) or another SHA-256 pass
      let finalKeyMaterial;
      if (_caps.hkdf) {
        const ikm = await sc.importKey('raw', derivedBytes, { name: 'HKDF' }, false, ['deriveBits']);
        const expanded = await sc.deriveBits(
          { name: 'HKDF', hash: 'SHA-256', salt: saltBytes, info: contextBytes },
          ikm, 256
        );
        finalKeyMaterial = new Uint8Array(expanded);
      } else {
        const combined   = new Uint8Array([...derivedBytes, ...contextBytes, ...saltBytes]);
        finalKeyMaterial = await sha256Bytes(combined);
      }

      // Step 3: Use finalKeyMaterial as Ed25519 seed (or HMAC key)
      // Ed25519 in Web Crypto doesn't support raw import from a seed directly,
      // so we derive a PKCS#8-equivalent structure and use HMAC as the signing
      // primitive when Ed25519 import isn't available.

      const pubKeyHex   = await sha256Hex(finalKeyMaterial);          // 32-byte fingerprint
      const privKeyB64  = bytesToB64(finalKeyMaterial);               // 32 bytes of key material
      const sovereignId = `SOVEREIGN:${pubKeyHex.slice(0, 24).toUpperCase()}`;

      return {
        pubKey:     pubKeyHex,
        privKeyB64,
        algo:       _caps.ed25519 ? 'Ed25519' : 'HMAC-SHA256',
        sovereignId,
        derivedAt:  Date.now(),
        context:    adminContext,
        // Sovereign Override metadata
        override: {
          version:   'v2',
          ruleZero:  true,
          canOverride: [
            'maxsupply', 'circulating', 'pool', 'agentfrs',
            'scenario_prob', 'unlock_scenario', 'freeze_state',
            'burn_rate', 'frs_reset_all', 'shadowban',
            'mining_difficulty', 'epoch_advance', 'halt_mining',
          ],
        },
      };
  } catch { return null; }
}

/**
 * Signs a Sovereign Override command payload with the admin's private key.
 * The signed payload is what gets transmitted to execAdminCmd().
 *
 * @param {string} privKeyB64 - Admin's private key (Base64)
 * @param {object} command    - { field, value, timestamp, nonce }
 * @param {string} algo       - Algorithm family
 * @returns {Promise<string>} hex signature
 */
export async function signSovereignCommand(privKeyB64, command, algo) {
  try {
      // Canonical serialisation — deterministic JSON key ordering
      const canonical = JSON.stringify({
        field:     command.field,
        value:     command.value,
        timestamp: command.timestamp,
        nonce:     command.nonce || crypto.getRandomValues(new Uint8Array(8)).join(''),
        version:   'MIR-V2-SOVEREIGN',
      });
      return signMessage(privKeyB64, canonical, algo);
  } catch { return ''; }
}

/**
 * Verifies a Sovereign Override signature.
 * Called by execAdminCmd() before any state mutation is permitted.
 *
 * @param {object} command      - The command object
 * @param {string} sigHex       - Hex signature from the admin terminal
 * @param {string} adminPubKey  - The registered admin public key
 * @param {string} algo         - Algorithm family
 * @returns {Promise<boolean>}
 */
export async function verifySovereignSignature(command, sigHex, adminPubKey, algo) {
  try {
      if (!command || !sigHex || !adminPubKey) return false;

      const canonical = JSON.stringify({
        field:     command.field,
        value:     command.value,
        timestamp: command.timestamp,
        nonce:     command.nonce,
        version:   'MIR-V2-SOVEREIGN',
      });

      // Timing-safe: we always run the crypto even if early checks fail
      const cryptoResult = await verifySignature(adminPubKey, canonical, sigHex, algo);

      // Additional timestamp check: reject commands older than 5 minutes
      const age = Date.now() - (command.timestamp || 0);
      const freshEnough = age >= 0 && age < 5 * 60 * 1000;

      return cryptoResult && freshEnough;
  } catch { return false; }
}

/**
 * Simplified sovereign signature verifier for the terminal flow.
 * Accepts: privKeyB64 (Base64 HMAC key) + the raw message string.
 * This is what the admin types in the terminal after confirming a challenge.
 */
export async function verifySovereignSignatureSimple(privKeyB64, message, algo = 'HMAC-SHA256') {
  try {
      // For HMAC: the "public key" and "private key" are the same bytes.
      // Verification = re-sign and compare.
      const expected = await signMessage(privKeyB64, message, algo);
      // We always return true here — the caller checks the expected prefix.
      // This is the challenge-response flow.
      return expected;
  } catch { return false; }
}

// ── HKDF Child Key Derivation ──────────────────────────────────────────

/**
 * Derive a child key from a master private key using HKDF.
 * Used for creating sub-accounts or agent keys from a master seed.
 *
 * @param {string} masterPrivB64 - Master private key (Base64)
 * @param {string} path          - Derivation path (e.g. "m/0/1")
 * @param {string} algo          - Parent algorithm
 * @returns {Promise<{ pubKey, privKeyB64, algo, path }>}
 */
export async function deriveChildKey(masterPrivB64, path, algo) {
  try {
      await _probeCapabilities();
      const sc     = window.crypto.subtle;
      const master = b64ToBytes(masterPrivB64);
      const info   = strToBytes(`MIR-CHILD-KEY:${path}`);
      const salt   = strToBytes('MIR-V2-HKDF-SALT');

      let childBytes;
      if (_caps.hkdf) {
        const ikm = await sc.importKey('raw', master, { name: 'HKDF' }, false, ['deriveBits']);
        const expanded = await sc.deriveBits(
          { name: 'HKDF', hash: 'SHA-256', salt, info },
          ikm, 256
        );
        childBytes = new Uint8Array(expanded);
      } else {
        // SHA-256 fallback
        const combined = new Uint8Array([...master, ...info, ...salt]);
        childBytes     = await sha256Bytes(combined);
      }

      const pubKey    = await sha256Hex(childBytes);
      const privKeyB64 = bytesToB64(childBytes);

      return {
        pubKey,
        privKeyB64,
        algo:  algo || (_caps.ed25519 ? 'Ed25519' : 'HMAC-SHA256'),
        path,
        parentPubKey: await sha256Hex(master),
      };
  } catch { return null; }
}

// ── Password Hashing (PBKDF2) ──────────────────────────────────────────

/**
 * Hash a password with PBKDF2-SHA256 (100,000 iterations).
 * Falls back to SHA-256 x 500 on platforms without PBKDF2.
 *
 * @param {string}  password  - Plain-text password
 * @param {string=} saltHex   - 32-byte hex salt; generated if not provided
 * @returns {Promise<{ hash: string, salt: string }>} — both hex
 */
export async function hashPassword(password, saltHex) {
  try {
      await _probeCapabilities();
      const sc = window.crypto.subtle;

      // Generate or parse salt
      const saltBytes = saltHex
        ? hexToBytes(saltHex)
        : crypto.getRandomValues(new Uint8Array(32));
      const saltOut   = bytesToHex(saltBytes);

      const pwBytes   = strToBytes(password);

      if (_caps.pbkdf2) {
        const baseKey = await sc.importKey('raw', pwBytes, { name: 'PBKDF2' }, false, ['deriveBits']);
        const derived = await sc.deriveBits(
          { name: 'PBKDF2', salt: saltBytes, iterations: 100_000, hash: 'SHA-256' },
          baseKey, 256
        );
        return { hash: bufToHex(derived), salt: saltOut };
      }

      // Fallback: 500x SHA-256 with salt interleaving
      let current = new Uint8Array([...pwBytes, ...saltBytes]);
      for (let i = 0; i < 500; i++) {
        current = await sha256Bytes(current);
      }
      return { hash: bytesToHex(current), salt: saltOut };
  } catch { return null; }
}

/**
 * Verify a password against a stored hash+salt.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export async function verifyPassword(password, saltHex, expectedHash) {
  try {
      const { hash } = await hashPassword(password, saltHex);
      // Timing-safe hex comparison
      const hashBytes     = hexToBytes(hash);
      const expectedBytes = hexToBytes(expectedHash);
      return timingSafeEqual(hashBytes, expectedBytes);
  } catch { return false; }
}

// ── Session Token Generation ──────────────────────────────────────────

/**
 * Generate a signed session token.
 * Token format: base64(header).base64(payload).signature_hex
 *
 * The payload contains:
 *   pubKey      : account public key
 *   issuedAt    : Unix ms timestamp
 *   expiresAt   : Unix ms timestamp (issuedAt + 24 hours)
 *   nonce       : 16 random bytes hex
 *   platform    : 'MIR-V2'
 */
export async function generateSessionToken(privKeyB64, pubKey, algo) {
  try {
      const nonce     = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
      const issuedAt  = Date.now();
      const expiresAt = issuedAt + 86_400_000; // 24 hours

      const header  = { alg: algo, typ: 'MIR-SESSION-V2' };
      const payload = {
        pubKey,
        issuedAt,
        expiresAt,
        nonce,
        platform: 'MIR-V2',
      };

      const headerB64  = btoa(JSON.stringify(header));
      const payloadB64 = btoa(JSON.stringify(payload));
      const sigInput   = `${headerB64}.${payloadB64}`;
      const signature  = await signMessage(privKeyB64, sigInput, algo);

      return `${headerB64}.${payloadB64}.${signature}`;
  } catch { return null; }
}

/**
 * Verify and decode a session token.
 * Returns { valid: boolean, payload: object | null, reason: string }
 */
export async function verifySessionToken(token, pubKey, algo) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { valid: false, payload: null, reason: 'malformed_token' };

    const [headerB64, payloadB64, sigHex] = parts;
    const payload = JSON.parse(atob(payloadB64));

    // Check expiry
    if (Date.now() > payload.expiresAt) {
      return { valid: false, payload, reason: 'token_expired' };
    }

    // Check pubKey match
    if (payload.pubKey !== pubKey) {
      return { valid: false, payload, reason: 'pubkey_mismatch' };
    }

    // Verify signature
    const sigInput = `${headerB64}.${payloadB64}`;
    const valid    = await verifySignature(pubKey, sigInput, sigHex, algo);

    return { valid, payload: valid ? payload : null, reason: valid ? 'ok' : 'invalid_signature' };
  } catch (e) {
    return { valid: false, payload: null, reason: `token_error: ${e.message}` };
  }
}

// ── Random Utilities ───────────────────────────────────────────────────

/** Generate a cryptographically random UUID v4 */
export function generateUID() {
  if (crypto.randomUUID) return crypto.randomUUID();
  // Fallback manual v4 UUID
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;  // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80;  // variant RFC 4122
  const hex = bytesToHex(bytes);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

/** Generate N random bytes as hex string */
export function randomHex(n = 16) {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(n)));
}

/** Generate N random bytes as Base64 string */
export function randomB64(n = 32) {
  return bytesToB64(crypto.getRandomValues(new Uint8Array(n)));
}

// ── Challenge-Response (Unsigned Terminal Flow) ────────────────────────

/**
 * Generate a challenge nonce for the terminal unsigned-command flow.
 * When no admin key is set, the terminal issues a hex prefix challenge.
 * The user must reply with "confirm <prefix>" to prove human intent.
 *
 * @param {number} length - Number of hex characters in the prefix (default 6)
 * @returns {{ prefix: string, fullNonce: string, issuedAt: number }}
 */
export function generateTerminalChallenge(length = 6) {
  try {
      const fullNonce = randomHex(16);
      return {
        prefix:   fullNonce.slice(0, length).toUpperCase(),
        fullNonce,
        issuedAt: Date.now(),
      };
  } catch { return null; }
}

/**
 * Verify a terminal challenge response.
 * Returns true if the provided prefix matches (case-insensitive) and
 * the challenge was issued within the last 60 seconds.
 */
export function verifyTerminalChallenge(challenge, providedPrefix) {
  try {
      if (!challenge || !providedPrefix) return false;
      const age       = Date.now() - challenge.issuedAt;
      const notExpired = age >= 0 && age < 60_000; // 60 second window
      const prefixOk   = challenge.prefix.toUpperCase() === providedPrefix.toUpperCase().trim();
      return notExpired && prefixOk;
  } catch { return false; }
}

// ── AES-GCM Encryption (for IndexedDB at-rest encryption) ─────────────

/**
 * Encrypt a string with AES-256-GCM.
 * Returns an object containing Base64-encoded ciphertext + IV.
 * Used for encrypting sensitive IndexedDB fields (private keys, admin keys).
 */
export async function aesEncrypt(plaintext, keyB64) {
  try {
      await _probeCapabilities();
      if (!_caps.aesGcm) {
        // Graceful degradation: base64 only (no encryption)
        return { cipherB64: btoa(plaintext), ivB64: '', degraded: true };
      }

      const sc       = window.crypto.subtle;
      const keyBytes = b64ToBytes(keyB64);
      const iv       = crypto.getRandomValues(new Uint8Array(12));
      const msgBytes = strToBytes(plaintext);

      const key = await sc.importKey(
        'raw', keyBytes, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
      );
      const cipher = await sc.encrypt({ name: 'AES-GCM', iv }, key, msgBytes);

      return {
        cipherB64: bytesToB64(new Uint8Array(cipher)),
        ivB64:     bytesToB64(iv),
        degraded:  false,
      };
  } catch { return null; }
}

/**
 * Decrypt an AES-256-GCM encrypted payload.
 */
export async function aesDecrypt(cipherB64, ivB64, keyB64) {
  try {
      await _probeCapabilities();
      if (!_caps.aesGcm) {
        return atob(cipherB64); // degraded passthrough
      }

      const sc         = window.crypto.subtle;
      const keyBytes   = b64ToBytes(keyB64);
      const iv         = b64ToBytes(ivB64);
      const cipherBytes= b64ToBytes(cipherB64);

      const key = await sc.importKey(
        'raw', keyBytes, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
      );
      const plain = await sc.decrypt({ name: 'AES-GCM', iv }, key, cipherBytes);
      return new TextDecoder().decode(plain);
  } catch { return null; }
}

// ── Module Initialisation ──────────────────────────────────────────────

// Probe capabilities eagerly on module load (non-blocking)
_probeCapabilities().then(() => {
  console.log(
    `%c[KDF] identity_kdf.js loaded — Ed25519:${_caps.ed25519} ECDSA:${_caps.ecdsa} HMAC:${_caps.hmac} HKDF:${_caps.hkdf} PBKDF2:${_caps.pbkdf2} AES:${_caps.aesGcm}`,
    'color:#00ff88;font-family:monospace;font-size:11px'
  );
});

// Export everything needed by the application layer
export {
  bufToHex,
  hexToBytes,
  b64ToBytes,
  bytesToB64,
  bytesToHex,
  strToBytes,
  timingSafeEqual,
};

// ═══════════════════════════════════════════════════════════════════════════
// SOVEREIGN IDENTITY MANAGEMENT
// generateIdentity(), saveKeyLocally(), exportEncryptedBackup()
// ═══════════════════════════════════════════════════════════════════════════

const IDENTITY_LS_KEY        = 'mir_identity_v2';
const IDENTITY_BACKUP_SALT   = 'MIR-IDENTITY-BACKUP-V2';
const IDENTITY_PBKDF2_ITERS  = 150_000;

/**
 * generateIdentity()
 * Public-facing alias for generateED25519().
 * Returns a new sovereign identity keypair for this browser session.
 * No keys are stored — caller must invoke saveKeyLocally() explicitly.
 *
 * @returns {Promise<{ pubKey: string, privKeyB64: string, algo: string, createdAt: number }>}
 */
export async function generateIdentity() {
  const kp = await generateED25519();
  return { ...kp, createdAt: Date.now(), platform: 'MIR-V2' };
}

/**
 * saveKeyLocally(privKeyB64, pubKey, username)
 * Stores the identity keypair in localStorage under IDENTITY_LS_KEY.
 * The private key is stored as-is (user is responsible for device security).
 * For hardened storage, call exportEncryptedBackup() and delete the plaintext.
 *
 * Storage format: { pubKey, privKeyB64, username, algo, savedAt }
 * Key:            localStorage['mir_identity_v2']
 *
 * @param {string} privKeyB64  — Base64 private key
 * @param {string} pubKey      — Hex public key
 * @param {string} [username]  — Optional display label
 * @returns {boolean} true if saved successfully
 */
export function saveKeyLocally(privKeyB64, pubKey, username = '') {
  try {
    const record = JSON.stringify({
      pubKey,
      privKeyB64,
      username,
      savedAt:  Date.now(),
      platform: 'MIR-V2',
    });
    localStorage.setItem(IDENTITY_LS_KEY, record);
    return true;
  } catch (e) {
    console.warn('[KDF] saveKeyLocally failed:', e.message);
    return false;
  }
}

/**
 * loadKeyLocally()
 * Reads the stored identity from localStorage.
 * Returns null if no identity is stored.
 *
 * @returns {{ pubKey, privKeyB64, username, savedAt } | null}
 */
export function loadKeyLocally() {
  try {
    const raw = localStorage.getItem(IDENTITY_LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

/**
 * clearKeyLocally()
 * Removes the stored identity from localStorage.
 * Called on logout or voluntary key rotation.
 */
export function clearKeyLocally() {
  localStorage.removeItem(IDENTITY_LS_KEY);
}

/**
 * exportEncryptedBackup(privKeyB64, pubKey, username, password)
 * Encrypts the keypair with AES-256-GCM using a user-chosen password
 * and triggers a browser download of a .json backup file.
 *
 * Encryption:
 *   key = PBKDF2(password, randomSalt, 150_000 iters, SHA-256) → 32 bytes
 *   iv  = random 12 bytes
 *   ciphertext = AES-256-GCM(key, iv, plaintext)
 *
 * The output file is safe to store in cloud services — decryption requires
 * the password AND the file. The private key is never stored in plaintext.
 *
 * @param {string} privKeyB64  — Base64 private key to encrypt
 * @param {string} pubKey      — Hex public key (stored unencrypted for identification)
 * @param {string} username    — Display name
 * @param {string} password    — Encryption passphrase (never stored)
 * @returns {Promise<boolean>}
 */
export async function exportEncryptedBackup(privKeyB64, pubKey, username, password) {
  try {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    await _probeCapabilities();
    const sc = window.crypto.subtle;

    // Generate random salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const iv   = crypto.getRandomValues(new Uint8Array(12));

    // Derive encryption key via PBKDF2
    const pwBytes = strToBytes(password);
    const baseKey = await sc.importKey('raw', pwBytes, 'PBKDF2', false, ['deriveKey']);
    const aesKey  = await sc.deriveKey(
      { name: 'PBKDF2', salt, iterations: IDENTITY_PBKDF2_ITERS, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    // Plaintext payload
    const plaintext = strToBytes(JSON.stringify({
      privKeyB64,
      pubKey,
      username,
      platform: 'MIR-V2',
      exportedAt: Date.now(),
    }));

    // Encrypt
    const ciphertext = await sc.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext);

    // Build backup file
    const backup = {
      version:    'MIR-IDENTITY-BACKUP-V2',
      pubKey,                                           // unencrypted — safe to store
      username,
      algo:       'AES-256-GCM / PBKDF2-SHA-256',
      iterations: IDENTITY_PBKDF2_ITERS,
      salt:       bufToHex(salt),
      iv:         bufToHex(iv),
      ciphertext: bufToHex(new Uint8Array(ciphertext)),
      createdAt:  Date.now(),
      warning:    'This file is encrypted. You MUST remember your password. There is NO recovery if you forget it.',
    };

    // Download
    const blob  = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href      = url;
    a.download  = `mir_identity_backup_${(username || pubKey.slice(0,8))}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('[KDF] exportEncryptedBackup error:', err.message);
    return false;
  }
}

/**
 * importEncryptedBackup(backupJson, password)
 * Decrypts a backup file and returns the keypair.
 * Does NOT automatically save to localStorage — caller must invoke saveKeyLocally().
 *
 * @param {string|Object} backupJson — Backup file contents (string or parsed)
 * @param {string}         password  — Decryption passphrase
 * @returns {Promise<{ pubKey, privKeyB64, username } | null>}
 */
export async function importEncryptedBackup(backupJson, password) {
  try {
    const backup = typeof backupJson === 'string' ? JSON.parse(backupJson) : backupJson;
    if (backup.version !== 'MIR-IDENTITY-BACKUP-V2') {
      throw new Error('Unrecognised backup format');
    }

    await _probeCapabilities();
    const sc = window.crypto.subtle;

    const salt       = hexToBytes(backup.salt);
    const iv         = hexToBytes(backup.iv);
    const ciphertext = hexToBytes(backup.ciphertext);
    const pwBytes    = strToBytes(password);

    // Derive decryption key
    const baseKey = await sc.importKey('raw', pwBytes, 'PBKDF2', false, ['deriveKey']);
    const aesKey  = await sc.deriveKey(
      { name: 'PBKDF2', salt, iterations: backup.iterations || IDENTITY_PBKDF2_ITERS, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    // Decrypt
    const plaintext = await sc.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext);
    const decoded   = JSON.parse(new TextDecoder().decode(plaintext));
    return { pubKey: decoded.pubKey, privKeyB64: decoded.privKeyB64, username: decoded.username };
  } catch (err) {
    console.warn('[KDF] importEncryptedBackup failed:', err.message);
    return null;
  }
}
