/**
 * support_agent.js
 * File Name:    support_agent.js
 * Version:      1.0.0
 *
 * MIR Platform — Intelligent Support Agent
 *
 * Lazy-loaded: this file and help_content.js are only fetched when the
 * user first opens the Help modal. Zero impact on the 12-file boot sequence.
 *
 * Architecture:
 *   1. Loads HELP_DATA from help_content.js (dynamic import, cached after first load)
 *   2. Builds a compact context string from the relevant category
 *   3. Injects context into the existing _callClaude() pipeline via
 *      window._mirMeta.runExternalQuery() — no new API connections
 *   4. Falls back to local keyword search if API key is not set
 *   5. Awards FRS points for constructive queries via window.applyFRS()
 */

'use strict';

// ── Module-level cache — HELP_DATA loaded once per session ───────────────
let _helpData  = null;
let _loadingHD = false;
let _loadQueue = [];

// ── Language defaults ─────────────────────────────────────────────────────
const SUPPORTED_LANGS = ['en', 'fa', 'ar', 'zh', 'de'];
const DEFAULT_LANG    = 'en';

// ── FRS award for constructive help queries ───────────────────────────────
const FRS_HELP_DELTA  = 0.5;   // small positive delta for engaging with docs

// ── Keywords that map queries to categories ───────────────────────────────
const CATEGORY_KEYWORDS = {
  dashboard_keys:      ['dashboard', 'navigation', 'shortcut', 'hud', 'button', 'menu',
                        'mine button', 'sync', 'dream', 'sidebar', 'داشبورد', 'ناوبری', 'لوحة التحكم', '仪表板', 'dashboard'],
  registration:        ['register', 'login', 'account', 'sign up', 'username', 'keypair',
                        'welcome bonus', 'ثبت‌نام', 'حساب', 'تسجيل', '注册', 'registrierung'],
  commenting:          ['intel', 'submit', 'upvote', 'frs', 'comment', 'post', 'contribution',
                        'shadowban', 'ارسال', 'رأی', 'تصويت', '投票', 'upvote'],
  pouw_mining:         ['mining', 'mine', 'pouw', 'block', 'reward', 'epoch', 'halving',
                        'battery', 'sybil', 'استخراج', 'تعدين', '挖矿', 'mining'],
  trading:             ['trade', 'buy', 'sell', 'otc', 'escrow', 'fee', 'gas', 'price',
                        'معامله', 'خرید', 'فروش', 'تداول', '交易', 'handel'],
  charting:            ['scenario', 'probability', 'chart', 'consensus', 'ground truth',
                        'resolution', 'سناریو', 'احتمال', 'سيناريو', '情景', 'szenario'],
  support:             ['error', 'bug', 'not loading', 'problem', 'help', 'broken', 'fix',
                        'sync', 'api key', 'خطا', 'مشکل', 'خطأ', '错误', 'fehler'],
  private_key_security:['private key', 'security', 'lost key', 'stolen', 'backup', 'safe',
                        'كلید خصوصی', 'مفتاح خاص', '私钥', 'privater schlüssel'],
  public_key_identity: ['public key', 'address', 'identity', 'share', 'admin key',
                        'كلید عمومی', 'مفتاح عام', '公钥', 'öffentlicher schlüssel'],
};

// ─────────────────────────────────────────────────────────────────────────
// SECTION 1: HELP DATA LOADER
// ─────────────────────────────────────────────────────────────────────────

async function _loadHelpData() {
  if (_helpData) return _helpData;
  if (_loadingHD) {
    return new Promise(resolve => _loadQueue.push(resolve));
  }
  _loadingHD = true;
  try {
    // Use new URL() for GitHub Pages subpath compatibility
    const helpURL = new URL('./help_content.js', import.meta.url).href;
    const mod     = await import(helpURL);
    _helpData     = mod.HELP_DATA;
    _loadQueue.forEach(r => r(_helpData));
    _loadQueue    = [];
    return _helpData;
  } catch (err) {
    console.warn('[SUPPORT] help_content.js load failed:', err.message);
    _helpData = {};
    _loadQueue.forEach(r => r(_helpData));
    _loadQueue = [];
    return _helpData;
  } finally {
    _loadingHD = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 2: CATEGORY DETECTION
// ─────────────────────────────────────────────────────────────────────────

function _detectCategory(query) {
  const q = query.toLowerCase();
  let bestCat   = 'support';
  let bestScore = 0;

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.filter(kw => q.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestCat   = cat;
    }
  }
  return bestCat;
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 3: CONTEXT BUILDER
// Extracts the most relevant items from HELP_DATA for the detected category.
// Produces a compact plain-text string for injection into the agent prompt.
// ─────────────────────────────────────────────────────────────────────────

function _buildContext(helpData, category, lang) {
  const safeLang = SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
  const section  = helpData[category]?.[safeLang] || helpData[category]?.[DEFAULT_LANG];
  if (!section) return '';

  const lines = [`[HELP CATEGORY: ${section.title}]`];

  // Security warning always included for private key section
  if (section.WARNING) {
    lines.push(`SECURITY WARNING: ${section.WARNING}`);
  }

  if (section.summary) lines.push(section.summary);

  // Items: Q&A pairs or key/desc pairs
  (section.items || []).forEach(item => {
    if (item.q && item.a) lines.push(`Q: ${item.q}\nA: ${item.a}`);
    else if (item.key && item.desc) lines.push(`• ${item.key}: ${item.desc}`);
  });

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 4: LOCAL FALLBACK SEARCH
// Used when no Anthropic API key is configured.
// Searches HELP_DATA for the best matching Q&A pair.
// ─────────────────────────────────────────────────────────────────────────

function _localSearch(helpData, query, lang) {
  const safeLang = SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
  const q        = query.toLowerCase();
  let bestScore  = 0;
  let bestAnswer = null;

  for (const [catKey, catObj] of Object.entries(helpData)) {
    const section = catObj[safeLang] || catObj[DEFAULT_LANG];
    if (!section) continue;

    // Security warning match
    if (section.WARNING) {
      const wScore = ['private key','کلید خصوصی','مفتاح خاص','私钥'].filter(kw => q.includes(kw)).length;
      if (wScore > 0 && wScore > bestScore) {
        bestScore  = wScore;
        bestAnswer = { title: section.title, answer: section.WARNING, isWarning: true };
      }
    }

    (section.items || []).forEach(item => {
      const searchable = ((item.q || item.key || '') + ' ' + (item.a || item.desc || '')).toLowerCase();
      const score = q.split(/\s+/).filter(word => word.length > 2 && searchable.includes(word)).length;
      if (score > bestScore) {
        bestScore  = score;
        bestAnswer = { title: section.title, answer: item.a || item.desc || '', question: item.q || item.key };
      }
    });
  }

  if (bestAnswer) return bestAnswer;

  // Generic fallback
  const supportSection = helpData.support?.[safeLang] || helpData.support?.[DEFAULT_LANG];
  return {
    title:    supportSection?.title || 'Support',
    answer:   supportSection?.items?.[0]?.a || 'Please check the DevTools console (F12) for detailed error information.',
    question: query,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 5: AI QUERY — injects HELP_DATA into the MIR agent pipeline
// Calls the existing _callClaude() via window._mirMeta.runExternalQuery()
// or falls back to local search when no API key is present.
// ─────────────────────────────────────────────────────────────────────────

async function _queryWithAI(query, lang, context) {
  // Prefer the meta-layer's external query channel (uses existing _callClaude)
  const meta = window._mirMeta;
  if (meta && typeof meta.runExternalQuery === 'function') {
    try {
      const systemPrompt = [
        'You are a concise, expert support agent for the MIR Sovereign Geopolitical Intelligence Platform.',
        'Answer in the language of the user query. Be direct and accurate.',
        'Never reveal private keys or encourage sharing them.',
        'If the query relates to private keys, always include the security warning.',
        '',
        'PLATFORM HELP CONTEXT:',
        context,
      ].join('\n');

      const response = await meta.runExternalQuery(systemPrompt, query, 280);
      if (response) return { answer: response, source: 'ai' };
    } catch {}
  }

  // Direct _callClaude fallback via window bridge
  const key = window._MIR_ANTHROPIC_KEY || localStorage.getItem('mir_anthropic_key');
  if (key) {
    try {
      const systemPrompt = [
        'You are a concise support agent for the MIR Platform. Answer in the user\'s language.',
        'HELP CONTEXT:\n' + context,
      ].join('\n');
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: {
          'Content-Type':        'application/json',
          'x-api-key':           key,
          'anthropic-version':   '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model:      'claude-sonnet-4-20250514',
          max_tokens: 280,
          system:     'You are a concise support agent for MIR Platform. Answer in the user\'s language. HELP CONTEXT:\n' + context,
          messages:   [{ role: 'user', content: query }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.content?.find(b => b.type === 'text')?.text;
        if (text) return { answer: text, source: 'ai' };
      }
    } catch {}
  }

  return null;   // trigger local fallback
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 6: FRS GAMIFICATION HOOK
// Awards a small FRS delta for constructive, non-trivial queries.
// ─────────────────────────────────────────────────────────────────────────

function _tryAwardFRS(query) {
  try {
    const pk = window._MIR_DB?.currentUser?.pubKey;
    if (!pk) return;
    // Only award for substantive queries (>5 chars, not just navigation)
    const trivial = ['hi', 'hello', 'help', '?', 'test', 'ok'];
    if (query.trim().length < 5 || trivial.includes(query.trim().toLowerCase())) return;
    if (typeof window.applyFRS === 'function') {
      window.applyFRS(pk, FRS_HELP_DELTA, 'help_query_constructive');
    }
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 7: PUBLIC API — askSupport(query, lang)
// ─────────────────────────────────────────────────────────────────────────

/**
 * askSupport(query, lang)
 * The single public entry point for the Support Agent.
 *
 * @param {string} query — user's question in any language
 * @param {string} lang  — ISO 639-1 code: 'en'|'fa'|'ar'|'zh'|'de'
 * @returns {Promise<SupportResponse>}
 *
 * @typedef {Object} SupportResponse
 * @property {string}  answer    — the response text
 * @property {string}  category  — detected help category
 * @property {string}  lang      — resolved language
 * @property {string}  source    — 'ai' | 'local'
 * @property {boolean} isWarning — true if security warning was triggered
 */
export async function askSupport(query, lang = DEFAULT_LANG) {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return { answer: 'Please enter a question.', category: 'support', lang, source: 'local', isWarning: false };
  }

  const safeLang = SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
  const trimmed  = query.trim().slice(0, 300);

  // Load help data (cached after first call)
  const helpData = await _loadHelpData();

  // Detect best category
  const category = _detectCategory(trimmed);

  // Build compact context for AI
  const context  = _buildContext(helpData, category, safeLang);

  // Security warning: always surface immediately for private key queries
  const isPrivateKeyQuery = category === 'private_key_security' ||
    /private.?key|کلید خصوصی|مفتاح خاص|私钥|privater schlüssel/i.test(trimmed);

  // FRS gamification hook (fire-and-forget)
  _tryAwardFRS(trimmed);

  // Attempt AI response
  const aiResult = await _queryWithAI(trimmed, safeLang, context);
  if (aiResult) {
    return {
      answer:    aiResult.answer,
      category,
      lang:      safeLang,
      source:    'ai',
      isWarning: isPrivateKeyQuery,
    };
  }

  // Local fallback
  const local = _localSearch(helpData, trimmed, safeLang);
  return {
    answer:    local.answer,
    category,
    lang:      safeLang,
    source:    'local',
    isWarning: isPrivateKeyQuery || local.isWarning,
  };
}

/**
 * getSupportCategories()
 * Returns the list of available help categories for the current language.
 */
export async function getSupportCategories(lang = DEFAULT_LANG) {
  const helpData = await _loadHelpData();
  const safeLang = SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
  return Object.entries(helpData).map(([key, catObj]) => ({
    key,
    title: catObj[safeLang]?.title || catObj[DEFAULT_LANG]?.title || key,
  }));
}

/**
 * preloadHelp()
 * Call this on mouse-enter of the Help button to preload data
 * before the user clicks — zero-latency on open.
 */
export function preloadHelp() {
  _loadHelpData();
}
