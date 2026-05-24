/**
 * gpu_matrix.js
 * File Name:    gpu_matrix.js
 * Version:      1.0.0
 *
 * MIR Platform — WebGPU Matrix Acceleration Layer
 *
 * Purpose:
 *   Accelerates the 6D semantic weight matrix operations in ai_evolution.js
 *   by offloading tensor computations to the GPU via WebGPU.
 *
 * Operations accelerated:
 *   1. tuneSemanticWeights()  — EMA weight update across all 4 agent matrices
 *   2. computeWeightedProb()  — Bayesian weighted probability aggregation
 *   3. batchAffinityUpdate()  — 4×4 agent affinity matrix update
 *   4. batchScenarioScore()   — Scenario probability recomputation (N×6 matrix)
 *
 * Memory model:
 *   - Input/output via GPUBuffer with COPY_SRC | COPY_DST | STORAGE flags
 *   - Zero-copy staging via getMappedRange() — no JS array round-trip
 *   - All pipelines are compiled once at init and reused
 *   - Main thread never blocks — all GPU work returns a Promise
 *
 * Fallback:
 *   If WebGPU is unavailable (iOS < 17, Firefox < 120, older Chrome),
 *   every function falls back transparently to the CPU implementation
 *   already in ai_evolution.js. The caller never needs to know.
 *
 * Mobile battery policy:
 *   GPU pipelines are suspended on visibilitychange:hidden and
 *   resumed on visibilitychange:visible to protect mobile battery.
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
const GPU_DIMS           = 6;     // 6D semantic weight vector
const GPU_AGENTS         = 4;     // resident, macro, cyber, geo
const GPU_MAX_SCENARIOS  = 256;   // batch size for scenario scoring
const GPU_WORKGROUP_SIZE = 64;    // threads per workgroup (tuned for mobile)
const GPU_FLOAT_BYTES    = 4;     // Float32

// ═══════════════════════════════════════════════════════════════════════════
// MODULE STATE
// ═══════════════════════════════════════════════════════════════════════════
let _device          = null;  // GPUDevice
let _adapter         = null;  // GPUAdapter
let _available       = false; // WebGPU supported and initialized
let _suspended       = false; // true when page is hidden
let _initPromise     = null;  // singleton init guard

// Pre-compiled pipeline cache
const _pipelines = {
  emaWeightUpdate:   null,
  weightedProb:      null,
  affinityUpdate:    null,
  scenarioBatch:     null,
};

// Persistent GPU buffers (reused across calls to avoid re-allocation)
const _buffers = {
  weights:     null,   // Float32[AGENTS × DIMS]
  signal:      null,   // Float32[DIMS]
  output:      null,   // Float32[AGENTS × DIMS]
  probs:       null,   // Float32[MAX_SCENARIOS]
  affinity:    null,   // Float32[AGENTS × AGENTS]
  params:      null,   // Float32[4]  — lr, clampLo, clampHi, padding
  staging:     null,   // read-back staging buffer
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: INITIALISATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * gpuInit()
 * Requests a WebGPU adapter and device, compiles all shader pipelines,
 * and allocates persistent GPU buffers.
 * Safe to call multiple times — returns cached result after first call.
 */
export async function gpuInit() {
  if (_initPromise) return _initPromise;
  _initPromise = _doInit();
  return _initPromise;
}

async function _doInit() {
  // Feature detection — respects window._ENV set by index.html
  const envAllowsGPU = window._ENV === undefined || window._ENV.webGPU !== false;
  if (!navigator.gpu || !envAllowsGPU) {
    console.log('[GPU] WebGPU not available / disabled by environment — CPU fallback active');
    _available = false;
    return false;
  }

  try {
    _adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'low-power',   // battery-safe on mobile
    });
    if (!_adapter) throw new Error('No GPU adapter found');

    _device = await _adapter.requestDevice({
      requiredLimits: {
        maxBufferSize:                  _adapter.limits.maxBufferSize,
        maxComputeWorkgroupStorageSize: _adapter.limits.maxComputeWorkgroupStorageSize,
      },
    });

    _device.lost.then(info => {
      console.warn('[GPU] Device lost:', info.message);
      _available = false;
      _device    = null;
      _initPromise = null;   // allow re-init on next call
    });

    // Compile pipelines
    _pipelines.emaWeightUpdate = await _compilePipeline(_SHADER_EMA_WEIGHT_UPDATE, 'ema_weight_update');
    _pipelines.weightedProb    = await _compilePipeline(_SHADER_WEIGHTED_PROB,     'weighted_prob');
    _pipelines.affinityUpdate  = await _compilePipeline(_SHADER_AFFINITY_UPDATE,   'affinity_update');
    _pipelines.scenarioBatch   = await _compilePipeline(_SHADER_SCENARIO_BATCH,    'scenario_batch');

    // Allocate persistent buffers
    _allocateBuffers();

    // Battery: suspend on hide
    document.addEventListener('visibilitychange', () => {
      _suspended = document.visibilityState === 'hidden';
    });

    _available = true;
    console.log(`[GPU] WebGPU ready — adapter: ${_adapter.info?.description || 'unknown'}`);
    return true;

  } catch (err) {
    console.warn('[GPU] Init failed:', err.message, '— CPU fallback active');
    _available = false;
    return false;
  }
}

function _allocateBuffers() {
  const d = _device;

  const mk = (size, usage) => d.createBuffer({ size, usage, mappedAtCreation: false });

  const STORAGE_COPY = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC;
  const STAGING_READ = GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST;

  _buffers.weights  = mk(GPU_AGENTS * GPU_DIMS * GPU_FLOAT_BYTES,    STORAGE_COPY);
  _buffers.signal   = mk(GPU_DIMS   * GPU_FLOAT_BYTES,               STORAGE_COPY);
  _buffers.output   = mk(GPU_AGENTS * GPU_DIMS * GPU_FLOAT_BYTES,    STORAGE_COPY);
  _buffers.probs    = mk(GPU_MAX_SCENARIOS * GPU_FLOAT_BYTES,        STORAGE_COPY);
  _buffers.affinity = mk(GPU_AGENTS * GPU_AGENTS * GPU_FLOAT_BYTES,  STORAGE_COPY);
  _buffers.params   = mk(4 * GPU_FLOAT_BYTES,                        STORAGE_COPY);
  _buffers.staging  = mk(GPU_AGENTS * GPU_DIMS * GPU_FLOAT_BYTES,    STAGING_READ);
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: SHADER PROGRAMS (WGSL)
// All shaders are static string literals — no dynamic code generation.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * EMA Weight Update Shader
 * Applies the exponential moving average update to all agent weight vectors
 * in a single GPU dispatch.
 *
 * w_new[i] = clamp(w[i] + lr * (signal[i] - w[i]), clampLo, clampHi)
 *
 * Layout:
 *   @group(0) @binding(0)  weights  Float32[AGENTS * DIMS]  — input/output
 *   @group(0) @binding(1)  signal   Float32[DIMS]           — target signal
 *   @group(0) @binding(2)  params   Float32[4]              — lr, lo, hi, pad
 *   @group(0) @binding(3)  output   Float32[AGENTS * DIMS]  — result
 */
const _SHADER_EMA_WEIGHT_UPDATE = /* wgsl */`
struct Params { lr: f32, clamp_lo: f32, clamp_hi: f32, pad: f32 }

@group(0) @binding(0) var<storage, read>       weights : array<f32>;
@group(0) @binding(1) var<storage, read>       signal  : array<f32>;
@group(0) @binding(2) var<storage, read>       params  : Params;
@group(0) @binding(3) var<storage, read_write> output  : array<f32>;

@compute @workgroup_size(${GPU_WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;                         // flat index into AGENTS * DIMS
  let total = ${GPU_AGENTS}u * ${GPU_DIMS}u;
  if (idx >= total) { return; }

  let dim_idx = idx % ${GPU_DIMS}u;
  let w       = weights[idx];
  let s       = signal[dim_idx];
  let updated = w + params.lr * (s - w);
  output[idx] = clamp(updated, params.clamp_lo, params.clamp_hi);
}
`;

/**
 * Weighted Probability Shader
 * Computes Bayesian FRS-weighted consensus probability across N scenarios.
 *
 * For each scenario s:
 *   score[s] = Σ_agent (frs_weight[agent] × agent_top3avg × prob[s][agent])
 *              / Σ_agent (frs_weight[agent] × agent_top3avg)
 *
 * Input layout  (probs buffer): Float32[N_SCENARIOS × AGENTS] row-major
 * Output layout (output buffer): Float32[N_SCENARIOS]
 */
const _SHADER_WEIGHTED_PROB = /* wgsl */`
@group(0) @binding(0) var<storage, read>       probs   : array<f32>;
@group(0) @binding(1) var<storage, read>       weights : array<f32>;  // agent FRS weights [AGENTS]
@group(0) @binding(2) var<storage, read_write> output  : array<f32>;  // [N_SCENARIOS]
@group(0) @binding(3) var<storage, read>       params  : array<f32>;  // [0] = n_scenarios

@compute @workgroup_size(${GPU_WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let s = gid.x;
  let n = u32(params[0]);
  if (s >= n) { return; }

  var weighted_sum : f32 = 0.0;
  var total_weight : f32 = 0.0;

  for (var a = 0u; a < ${GPU_AGENTS}u; a++) {
    let w    = weights[a];
    let prob = probs[s * ${GPU_AGENTS}u + a];
    weighted_sum += w * prob;
    total_weight += w;
  }

  output[s] = select(50.0, weighted_sum / total_weight, total_weight > 0.0);
}
`;

/**
 * Affinity Update Shader
 * Applies an EMA smoothing pass to the full AGENTS×AGENTS affinity matrix.
 *
 * aff_new[i][j] = alpha * target[i][j] + (1 - alpha) * aff[i][j]
 * Clamped to [10, 95].
 */
const _SHADER_AFFINITY_UPDATE = /* wgsl */`
@group(0) @binding(0) var<storage, read>       current : array<f32>;  // [AGENTS*AGENTS]
@group(0) @binding(1) var<storage, read>       target  : array<f32>;  // [AGENTS*AGENTS]
@group(0) @binding(2) var<storage, read_write> output  : array<f32>;  // [AGENTS*AGENTS]
@group(0) @binding(3) var<storage, read>       params  : array<f32>;  // [0]=alpha

@compute @workgroup_size(${GPU_WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx   = gid.x;
  let total = ${GPU_AGENTS}u * ${GPU_AGENTS}u;
  if (idx >= total) { return; }

  let a     = params[0];
  let c     = current[idx];
  let t     = target[idx];
  output[idx] = clamp(a * t + (1.0 - a) * c, 10.0, 95.0);
}
`;

/**
 * Scenario Batch Scoring Shader
 * Scores N scenarios using pre-computed agent weight sums.
 * Applies Hacker News-style time decay on top of weighted probability.
 *
 * final_score[s] = weighted_prob[s] / pow(age_hours[s] + 2, gravity)
 */
const _SHADER_SCENARIO_BATCH = /* wgsl */`
@group(0) @binding(0) var<storage, read>       probs    : array<f32>;  // weighted prob [N]
@group(0) @binding(1) var<storage, read>       ages     : array<f32>;  // age in hours [N]
@group(0) @binding(2) var<storage, read_write> scores   : array<f32>;  // output [N]
@group(0) @binding(3) var<storage, read>       params   : array<f32>;  // [0]=n [1]=gravity

@compute @workgroup_size(${GPU_WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let s = gid.x;
  let n = u32(params[0]);
  if (s >= n) { return; }

  let gravity  = params[1];
  let prob     = probs[s];
  let age      = ages[s];
  scores[s]    = prob / pow(age + 2.0, gravity);
}
`;

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: PIPELINE COMPILATION HELPER
// ═══════════════════════════════════════════════════════════════════════════

async function _compilePipeline(shaderSrc, label) {
  const module = _device.createShaderModule({ label, code: shaderSrc });

  // Async compilation with error reporting
  if (module.getCompilationInfo) {
    const info = await module.getCompilationInfo();
    const errors = info.messages.filter(m => m.type === 'error');
    if (errors.length > 0) {
      throw new Error(`Shader "${label}" compile error: ${errors[0].message}`);
    }
  }

  return _device.createComputePipeline({
    label,
    layout: 'auto',
    compute: { module, entryPoint: 'main' },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: BUFFER WRITE / READ HELPERS (zero-copy via getMappedRange)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * _writeBuffer()
 * Writes a Float32Array to a GPUBuffer using writeBuffer (no staging needed
 * for write path — only reads need a staging buffer).
 */
function _writeBuffer(gpuBuffer, float32Array) {
  _device.queue.writeBuffer(gpuBuffer, 0, float32Array.buffer, 0, float32Array.byteLength);
}

/**
 * _readBuffer()
 * Reads back a GPUBuffer to a Float32Array.
 * Uses a pre-allocated staging buffer to avoid per-call allocation.
 * Returns a COPY of the data (staging buffer is released back).
 */
async function _readBuffer(gpuBuffer, byteLength) {
  // Ensure staging buffer is large enough
  if (_buffers.staging.size < byteLength) {
    _buffers.staging.destroy();
    _buffers.staging = _device.createBuffer({
      size:  byteLength,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
  }

  const encoder = _device.createCommandEncoder();
  encoder.copyBufferToBuffer(gpuBuffer, 0, _buffers.staging, 0, byteLength);
  _device.queue.submit([encoder.finish()]);

  await _buffers.staging.mapAsync(GPUMapMode.READ, 0, byteLength);
  const mapped = _buffers.staging.getMappedRange(0, byteLength);
  const result = new Float32Array(mapped).slice(); // copy out before unmap
  _buffers.staging.unmap();
  return result;
}

/**
 * _dispatch()
 * Submits a single compute pass.
 * bindGroup entries must match the shader's @binding order exactly.
 */
function _dispatch(pipeline, bindGroupEntries, workgroupCount) {
  const bindGroup = _device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: bindGroupEntries.map((resource, binding) => ({ binding, resource: { buffer: resource } })),
  });

  const encoder = _device.createCommandEncoder();
  const pass    = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(workgroupCount / GPU_WORKGROUP_SIZE));
  pass.end();
  _device.queue.submit([encoder.finish()]);
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5: PUBLIC API — GPU-ACCELERATED MATRIX OPERATIONS
// Each function checks _available and falls back to CPU if GPU is not ready.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * gpuTuneSemanticWeights()
 * GPU version of tuneSemanticWeights() in ai_evolution.js.
 * Updates ALL 4 agent weight vectors simultaneously in a single GPU dispatch.
 *
 * @param {number[][]} agentWeights  — array of 4 arrays, each length 6
 * @param {number[]}   signal6D      — target 6D signal vector
 * @param {number}     lr            — learning rate (default 0.08)
 * @returns {Promise<number[][]>}    — updated weight arrays [4][6]
 */
export async function gpuTuneSemanticWeights(agentWeights, signal6D, lr = 0.08) {
  if (!_available || _suspended) {
    // CPU fallback
    return agentWeights.map(w =>
      w.map((v, i) => Math.max(0.05, Math.min(0.95, v + lr * (signal6D[i] - v))))
    );
  }

  const flatWeights = new Float32Array(GPU_AGENTS * GPU_DIMS);
  agentWeights.forEach((w, a) => w.forEach((v, d) => { flatWeights[a * GPU_DIMS + d] = v; }));
  const sig    = new Float32Array(signal6D);
  const params = new Float32Array([lr, 0.05, 0.95, 0.0]);

  _writeBuffer(_buffers.weights, flatWeights);
  _writeBuffer(_buffers.signal,  sig);
  _writeBuffer(_buffers.params,  params);

  _dispatch(_pipelines.emaWeightUpdate,
    [_buffers.weights, _buffers.signal, _buffers.params, _buffers.output],
    GPU_AGENTS * GPU_DIMS);

  const result = await _readBuffer(_buffers.output, GPU_AGENTS * GPU_DIMS * GPU_FLOAT_BYTES);

  // Reshape flat result back to [4][6]
  return Array.from({ length: GPU_AGENTS }, (_, a) =>
    Array.from({ length: GPU_DIMS }, (_, d) => result[a * GPU_DIMS + d])
  );
}

/**
 * gpuComputeWeightedProbs()
 * GPU version of computeWeightedProb() — scores ALL scenarios in one dispatch.
 *
 * @param {number[][]} scenarioAgentProbs — [N_scenarios][N_agents] probability matrix
 * @param {number[]}   agentFRSWeights    — [N_agents] FRS-derived weights
 * @returns {Promise<number[]>}           — [N_scenarios] weighted probabilities
 */
export async function gpuComputeWeightedProbs(scenarioAgentProbs, agentFRSWeights) {
  const n = scenarioAgentProbs.length;
  if (!_available || _suspended || n === 0) {
    // CPU fallback
    return scenarioAgentProbs.map(row => {
      const totalW = agentFRSWeights.reduce((s, w) => s + w, 0);
      return totalW > 0
        ? row.reduce((s, p, i) => s + agentFRSWeights[i] * p, 0) / totalW
        : 50;
    });
  }

  const flatProbs = new Float32Array(n * GPU_AGENTS);
  scenarioAgentProbs.forEach((row, s) => row.forEach((p, a) => { flatProbs[s * GPU_AGENTS + a] = p; }));
  const frsWeights = new Float32Array(agentFRSWeights);
  const params     = new Float32Array([n, 0, 0, 0]);

  // Use output buffer sized for n scenarios
  const outBuf = _device.createBuffer({
    size:  n * GPU_FLOAT_BYTES,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  const probBuf = _device.createBuffer({
    size:  flatProbs.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: false,
  });
  const wBuf = _device.createBuffer({
    size:  frsWeights.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: false,
  });
  const pBuf = _device.createBuffer({
    size:  params.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: false,
  });

  _device.queue.writeBuffer(probBuf, 0, flatProbs);
  _device.queue.writeBuffer(wBuf,    0, frsWeights);
  _device.queue.writeBuffer(pBuf,    0, params);

  _dispatch(_pipelines.weightedProb, [probBuf, wBuf, outBuf, pBuf], n);

  const stagingBuf = _device.createBuffer({
    size:  n * GPU_FLOAT_BYTES,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });
  const enc = _device.createCommandEncoder();
  enc.copyBufferToBuffer(outBuf, 0, stagingBuf, 0, n * GPU_FLOAT_BYTES);
  _device.queue.submit([enc.finish()]);

  await stagingBuf.mapAsync(GPUMapMode.READ);
  const result = new Float32Array(stagingBuf.getMappedRange()).slice();
  stagingBuf.unmap();

  // Cleanup transient buffers
  [outBuf, probBuf, wBuf, pBuf, stagingBuf].forEach(b => b.destroy());

  return Array.from(result).map(v => Math.round(Math.max(1, Math.min(99, v))));
}

/**
 * gpuUpdateAffinityMatrix()
 * GPU version of updateAffinity() — updates the full 4×4 affinity matrix
 * in a single dispatch using EMA smoothing.
 *
 * @param {number[][]} currentMatrix — [4][4] current affinity scores
 * @param {number[][]} targetMatrix  — [4][4] target affinity scores
 * @param {number}     alpha         — EMA smoothing factor (default 0.12)
 * @returns {Promise<number[][]>}    — updated [4][4] affinity matrix
 */
export async function gpuUpdateAffinityMatrix(currentMatrix, targetMatrix, alpha = 0.12) {
  if (!_available || _suspended) {
    // CPU fallback
    return currentMatrix.map((row, i) =>
      row.map((v, j) => {
        const updated = alpha * targetMatrix[i][j] + (1 - alpha) * v;
        return Math.max(10, Math.min(95, updated));
      })
    );
  }

  const n = GPU_AGENTS * GPU_AGENTS;
  const flatCurrent = new Float32Array(n);
  const flatTarget  = new Float32Array(n);
  currentMatrix.forEach((row, i) => row.forEach((v, j) => { flatCurrent[i * GPU_AGENTS + j] = v; }));
  targetMatrix .forEach((row, i) => row.forEach((v, j) => { flatTarget [i * GPU_AGENTS + j] = v; }));
  const params  = new Float32Array([alpha, 0, 0, 0]);
  const flatOut = new Float32Array(n);

  _writeBuffer(_buffers.affinity, flatCurrent);
  _writeBuffer(_buffers.output,   flatTarget);
  _writeBuffer(_buffers.params,   params);

  _dispatch(_pipelines.affinityUpdate,
    [_buffers.affinity, _buffers.output, _buffers.weights, _buffers.params],
    n);

  const result = await _readBuffer(_buffers.weights, n * GPU_FLOAT_BYTES);

  return Array.from({ length: GPU_AGENTS }, (_, i) =>
    Array.from({ length: GPU_AGENTS }, (_, j) => result[i * GPU_AGENTS + j])
  );
}

/**
 * gpuBatchScenarioScore()
 * Scores N scenarios with time-decay in one GPU pass.
 * Returns ranked indices (highest score first).
 *
 * @param {number[]} weightedProbs  — [N] pre-computed weighted probabilities
 * @param {number[]} ageHours       — [N] scenario age in hours
 * @param {number}   gravity        — HN gravity factor (default 1.8)
 * @returns {Promise<{index:number, score:number}[]>} — sorted descending
 */
export async function gpuBatchScenarioScore(weightedProbs, ageHours, gravity = 1.8) {
  const n = weightedProbs.length;
  if (!_available || _suspended || n === 0) {
    return weightedProbs
      .map((p, i) => ({ index: i, score: p / Math.pow(ageHours[i] + 2, gravity) }))
      .sort((a, b) => b.score - a.score);
  }

  const probArr  = new Float32Array(weightedProbs);
  const ageArr   = new Float32Array(ageHours);
  const paramsArr= new Float32Array([n, gravity, 0, 0]);

  const probBuf = _device.createBuffer({ size: probArr.byteLength,  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  const ageBuf  = _device.createBuffer({ size: ageArr.byteLength,   usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  const outBuf  = _device.createBuffer({ size: n * GPU_FLOAT_BYTES, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
  const pBuf    = _device.createBuffer({ size: paramsArr.byteLength,usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });

  _device.queue.writeBuffer(probBuf, 0, probArr);
  _device.queue.writeBuffer(ageBuf,  0, ageArr);
  _device.queue.writeBuffer(pBuf,    0, paramsArr);

  _dispatch(_pipelines.scenarioBatch, [probBuf, ageBuf, outBuf, pBuf], n);

  const stageBuf = _device.createBuffer({
    size:  n * GPU_FLOAT_BYTES,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });
  const enc2 = _device.createCommandEncoder();
  enc2.copyBufferToBuffer(outBuf, 0, stageBuf, 0, n * GPU_FLOAT_BYTES);
  _device.queue.submit([enc2.finish()]);
  await stageBuf.mapAsync(GPUMapMode.READ);
  const scores = new Float32Array(stageBuf.getMappedRange()).slice();
  stageBuf.unmap();

  [probBuf, ageBuf, outBuf, pBuf, stageBuf].forEach(b => b.destroy());

  return Array.from(scores, (score, index) => ({ index, score }))
    .sort((a, b) => b.score - a.score);
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6: STATUS & CLEANUP
// ═══════════════════════════════════════════════════════════════════════════

export function gpuIsAvailable()  { return _available; }
export function gpuIsSuspended()  { return _suspended; }

export function gpuGetInfo() {
  if (!_adapter) return { available: false };
  return {
    available:   _available,
    suspended:   _suspended,
    description: _adapter.info?.description || 'unknown',
    vendor:      _adapter.info?.vendor      || 'unknown',
    backend:     _adapter.info?.backend     || 'unknown',
    pipelines:   Object.entries(_pipelines).filter(([,v])=>v).map(([k])=>k),
    buffers:     Object.entries(_buffers).filter(([,v])=>v).map(([k])=>k),
  };
}

export function gpuDestroy() {
  Object.values(_buffers).forEach(b => { try { b?.destroy(); } catch {} });
  _device?.destroy();
  _device = null; _adapter = null; _available = false; _initPromise = null;
  console.log('[GPU] Resources released');
}
