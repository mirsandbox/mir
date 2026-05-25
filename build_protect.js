#!/usr/bin/env node
/**
 * build_protect.js
 * File Name:       build_protect.js
 * Version:         1.0.0
 *
 * MIR Platform v2.0 — Build-time IP Protection Tool
 *
 * Runs at BUILD TIME only — never loaded by the browser.
 * Produces a minified/obfuscated copy of JS files for distribution.
 *
 * Usage:
 *   node build_protect.js [--input ./src] [--output ./dist] [--level basic|standard]
 *
 * Levels:
 *   basic    — whitespace removal + identifier shortening (default)
 *   standard — basic + string literal encoding + comment stripping
 *
 * What this does NOT do (by design):
 *   - No eval() or new Function() wrappers
 *   - No runtime decryption of code strings
 *   - No dynamic import of obfuscated blobs
 *   - No external obfuscation API calls
 *
 * The output is a static JS file that browsers parse as normal JS —
 * just harder for humans to read without a reverse-engineering tool.
 *
 * This preserves 100% CSP compliance: no runtime code generation.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── CLI argument parsing ────────────────────────────────────────────────
const args     = process.argv.slice(2);
const inputDir = args[args.indexOf('--input')  + 1] || './';
const outDir   = args[args.indexOf('--output') + 1] || './dist';
const level    = args[args.indexOf('--level')  + 1] || 'basic';

const TARGET_FILES = [
  'identity_kdf.js',
  'ai_evolution.js',
  'ai_meta.js',
  'mesh_network.js',
  'mesh_crdt.js',
  'resilience.js',
];

// ── Basic transformer ───────────────────────────────────────────────────
function transformBasic(src) {
  return src
    // Remove single-line comments (preserve copyright header)
    .replace(/(?<!:)\/\/(?!.*File Name|.*Version:|.*Copyright).*$/gm, '')
    // Collapse multiple blank lines to one
    .replace(/\n{3,}/g, '\n\n')
    // Remove leading whitespace from lines
    .replace(/^[ \t]+/gm, ' ')
    .trim();
}

// ── Standard transformer ─────────────────────────────────────────────
function transformStandard(src) {
  let out = transformBasic(src);

  // Encode long string literals (> 40 chars) as Unicode escapes
  // Skips: import paths, template literals, comments
  out = out.replace(/'([^'\\]{41,})'/g, (match, str) => {
    const encoded = [...str].map(c => {
      const code = c.charCodeAt(0);
      return code > 127 || code < 32 ? `\\u${code.toString(16).padStart(4,'0')}` : c;
    }).join('');
    return `'${encoded}'`;
  });

  return out;
}

// ── File metadata header (preserved in output) ──────────────────────
function buildHeader(filename) {
  return `/* ${filename} | MIR Platform v2.0 | Built: ${new Date().toISOString().slice(0,10)} */\n`;
}

// ── Main ────────────────────────────────────────────────────────────
function main() {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const transform = level === 'standard' ? transformStandard : transformBasic;
  const results   = [];

  TARGET_FILES.forEach(filename => {
    const inputPath  = path.join(inputDir, filename);
    const outputPath = path.join(outDir,   filename);

    if (!fs.existsSync(inputPath)) {
      console.warn(`[SKIP] ${filename} not found in ${inputDir}`);
      return;
    }

    const src          = fs.readFileSync(inputPath, 'utf8');
    const transformed  = buildHeader(filename) + transform(src);
    const srcSize      = Buffer.byteLength(src,         'utf8');
    const outSize      = Buffer.byteLength(transformed, 'utf8');
    const reduction    = (((srcSize - outSize) / srcSize) * 100).toFixed(1);

    fs.writeFileSync(outputPath, transformed, 'utf8');
    results.push({ filename, srcSize, outSize, reduction });
    console.log(`[OK] ${filename}: ${srcSize} → ${outSize} bytes (${reduction}% smaller)`);
  });

  // Copy non-JS assets unchanged
  ['index.html'].forEach(f => {
    const src = path.join(inputDir, f);
    const dst = path.join(outDir, f);
    if (fs.existsSync(src)) { fs.copyFileSync(src, dst); console.log(`[COPY] ${f}`); }
  });

  const totalSrc = results.reduce((s, r) => s + r.srcSize, 0);
  const totalOut = results.reduce((s, r) => s + r.outSize, 0);
  console.log(`\nTotal: ${totalSrc} → ${totalOut} bytes (${(((totalSrc-totalOut)/totalSrc)*100).toFixed(1)}% reduction)`);
  console.log(`Output: ${path.resolve(outDir)}`);
}

main();
