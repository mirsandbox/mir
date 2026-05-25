# MIR Platform v2.0

Sovereign AI Intelligence Platform — Geopolitical & Macroeconomic Forecasting

## File Tree

```
mir/
├── index.html            # Entry point · Ghost-Render boot · Semantic Renderer
├── identity_kdf.js       # ED25519 keys · PBKDF2/HKDF · sovereign signatures
├── ai_evolution.js       # AI agent swarm · 6D weights · DB orchestrator
├── ai_meta.js            # CSP-safe Blob Workers · Dream State · model validation
├── mesh_network.js       # WebRTC P2P · 3-tier signaling · PoUW mining · Sybil guard
├── mesh_crdt.js          # LWW/G-Counter/PN-Counter/OR-Set/Vector Clock/MV-Register
├── resilience.js         # Circuit breaker · backoff · offline queue · traffic shaping
├── gpu_matrix.js         # WebGPU pipeline · WGSL shaders · Float32 matrix ops
├── wasm_crypto.js        # WASM+SubtleCrypto · ED25519 · PBKDF2 · AES-GCM
├── data_synthesis.js     # GPU orchestration · local+peer signal merger · write-back
├── build_protect.js      # Build-time IP protection (Node.js · not loaded by browser)
└── wasm_crypto.wasm      # Compiled WASM binary (deploy alongside wasm_crypto.js)
```

## Module Load Order

```
index.html (Ghost-Render IDB read)
  └── resilience.js       (circuit breaker, offline queue, traffic shaping)
  └── ai_evolution.js     (orchestrator — loads remaining modules internally)
        ├── wasm_crypto.js      (WASM+SubtleCrypto acceleration)
        ├── gpu_matrix.js       (WebGPU pipeline)
        ├── data_synthesis.js   (numeric orchestration bridge)
        ├── mesh_network.js     (P2P + PoUW mining)
        ├── mesh_crdt.js        (CRDT consistency + Phoenix Spore)
        └── ai_meta.js          (Blob Worker sandbox + Dream State)
```

## Deploy to GitHub Pages

```bash
# 1. Build (optional IP protection)
node build_protect.js --input ./ --output ./dist --level standard

# 2. Push
git add .
git commit -m "MIR Platform v2.0"
git push origin main
# GitHub Pages serves index.html — all imports are relative (./)
```

## Admin Terminal Commands

```
apikey <key>          Set Anthropic API key
setwebhook twitter <url>
override <field> <val>
freeze / unfreeze
mint <user> <amount>
burn <user> <amount>
dream                 Engage Dream State
status                System status report
githubconfig <owner> <repo> <path> <token>
githubsync            Push DB snapshot to GitHub
reset CONFIRM         Emergency wipe
```