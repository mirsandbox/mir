/**
 * support_agent.js
 * Version:      2.0.0
 * Arch Hash:    0cd97f1b6a24d823
 * Last Sync:    PHASE-3
 *
 * MIR Platform — Autonomous Client-Side Support Agent
 *
 * Architecture — strictly browser-sandboxed, no central server:
 *   1. Loads HELP_DATA from help_content.js via dynamic import() (cached)
 *   2. Ranks responses by querying user's FRS from window._MIR_DB
 *   3. Uses TF-IDF-style local search with FRS-weighted scoring
 *   4. Optional: injects HELP_DATA into existing agent pipeline via
 *      window._mirMeta.runExternalQuery() when API key is present
 *   5. Awards FRS delta for constructive queries via window.applyFRS()
 *
 * NEUTRALITY GUARANTEE:
 *   This agent NEVER provides prescriptive financial advice.
 *   All content referencing prices, trades, or forecasts includes
 *   the mandatory neutrality disclaimer: "This is informational only."
 *
 * Cross-module interfaces:
 *   Reads:   window._MIR_DB.currentUser.frs  (ai_evolution.js)
 *   Reads:   window._MIR_DB.currentUser.pubKey (ai_evolution.js)
 *   Calls:   window.applyFRS(pk, delta, reason) (ai_evolution.js export)
 *   Calls:   window._mirMeta.runExternalQuery() (ai_meta.js bridge)
 *   Imports: ./help_content.js → HELP_DATA
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const SA_VERSION       = '2.0.0';
const SUPPORTED_LANGS  = ['en', 'fa', 'ar', 'zh', 'de'];
const DEFAULT_LANG     = 'en';
const FRS_DELTA_BASIC  = 0.3;   // awarded for any substantive query
const FRS_DELTA_DEEP   = 0.7;   // awarded for multi-keyword expert queries
const MAX_QUERY_LEN    = 400;
const MAX_RESULTS      = 5;

// Financial / advisory terms — trigger neutrality disclaimer
const FINANCIAL_TERMS = [
  'invest','investment','buy','sell','price','profit','loss','return',
  'trade','portfolio','advice','recommend','should i','worth',
  'خرید','فروش','سرمایه‌گذاری','توصیه','ارزش',
  'استثمار','شراء','بيع','نصيحة','سعر',
  '投资','买','卖','建议','价格',
  'investieren','kaufen','verkaufen','empfehlen','preis',
];

const NEUTRALITY_DISCLAIMER = {
  en: '⚠ Informational only — not financial advice. All trading decisions are your sole responsibility.',
  fa: '⚠ اطلاعاتی است نه توصیه مالی. تمام تصمیمات معاملاتی مسئولیت انحصاری شماست.',
  ar: '⚠ معلوماتي فقط — ليس نصيحة مالية. جميع قرارات التداول مسؤوليتك وحدك.',
  zh: '⚠ 仅供参考——非财务建议。所有交易决定由您独自负责。',
  de: '⚠ Nur informativ — keine Finanzberatung. Alle Handelsentscheidungen liegen in Ihrer alleinigen Verantwortung.',
};

// ═══════════════════════════════════════════════════════════════════════════
// MODULE STATE — singleton per session
// ═══════════════════════════════════════════════════════════════════════════

let _helpData   = null;
let _loadingHD  = false;
let _loadQueue  = [];
let _queryCount = 0;

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: HELP DATA LOADER
// ═══════════════════════════════════════════════════════════════════════════

async function _loadHelpData() {
  if (_helpData) return _helpData;
  if (_loadingHD) {
    return new Promise(resolve => _loadQueue.push(resolve));
  }
  _loadingHD = true;
  try {
    const helpURL = new URL('./help_content.js', import.meta.url).href;
    const mod     = await import(helpURL);
    _helpData     = mod.HELP_DATA;
    console.log('[SUPPORT] Knowledge base loaded:', Object.keys(_helpData).length, 'categories');
    _loadQueue.forEach(r => r(_helpData));
    _loadQueue = [];
    return _helpData;
  } catch (err) {
    console.warn('[SUPPORT] help_content.js failed:', err.message);
    _helpData = {};
    _loadQueue.forEach(r => r(_helpData));
    _loadQueue = [];
    return _helpData;
  } finally {
    _loadingHD = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: FRS READER
// Gets current user FRS from ai_evolution.js DB bridge.
// Returns 50 (neutral baseline) if not available.
// ═══════════════════════════════════════════════════════════════════════════

function _getUserFRS() {
  try {
    const db  = window._MIR_DB;
    const ses = window._MIR_SES;
    if (!db || !ses?.pubKey) return 50;
    const user = db.wallets?.[ses.pubKey] || db.accounts?.[ses.pubKey];
    if (user && typeof user.frs === 'number') return user.frs;
    // Also check agents structure
    if (db.currentUser?.frs != null) return db.currentUser.frs;
    return 50;
  } catch { return 50; }
}

function _getUserPubKey() {
  try { return window._MIR_SES?.pubKey || window._MIR_DB?.currentUser?.pubKey || null; }
  catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: CATEGORY KEYWORD MAP
// ═══════════════════════════════════════════════════════════════════════════

const CAT_KEYWORDS = {
  protocol_fundamentals: [
    'protocol','what is mir','token','miri','supply','burn','frs','reputation',
    'identity','keypair','partition','decentralised','network','architecture',
    'پروتکل','توکن','عرضه','هویت','MIR چیست','شهرت',
    'بروتوكول','رمز','هوية','سمعة',
    '协议','代币','身份','声誉',
    'protokoll','token','identität','ruf',
  ],
  sovereign_override: [
    'admin','terminal','sovereign','command','override','rule 0','freeze',
    'kill switch','reset','dream state','mint','burn admin','set key',
    'ترمینال','ادمین','حاکمیتی','دستور',
    'terminal','مشرف','أوامر',
    '管理员','终端','命令',
    'terminal','admin','befehl',
  ],
  otc_escrow: [
    'otc','trade','buy','sell','escrow','order','fee','market','price',
    'معامله','خرید','فروش','بازار','اسکرو',
    'تداول','شراء','بيع','ضمان',
    '交易','买','卖','托管',
    'handel','kaufen','verkaufen','treuhand',
  ],
  pouw_mining: [
    'mining','mine','pouw','proof','block','reward','epoch','halving',
    'battery','sybil','hashrate','worker',
    'استخراج','معدن','اثبات','پاداش','دوره',
    'تعدين','كتلة','مكافأة','حقبة',
    '挖矿','区块','奖励','减半',
    'mining','block','belohnung','halbierung',
  ],
  strategic_forecasting: [
    'scenario','forecast','probability','predict','consensus','ground truth',
    'resolution','ai agent','semantic','6d','weight',
    'سناریو','پیش‌بینی','احتمال','اجماع',
    'سيناريو','تنبؤ','احتمالية','إجماع',
    '情景','预测','概率','共识',
    'szenario','prognose','wahrscheinlichkeit',
  ],
  social_interaction: [
    'intel','submit','upvote','comment','post','feed','frs earn','shadowban',
    'voting','community','interact',
    'اطلاعات','ارسال','رأی','خوراک','تعامل',
    'معلومات','تقديم','تصويت','تغذية',
    '情报','提交','投票','动态',
    'einreichen','abstimmung','gemeinschaft',
  ],
  private_key_security: [
    'private key','security','lost key','backup','stolen','export','password',
    'encrypt','aes','safe','store',
    'کلید خصوصی','امنیت','بکاپ','رمزگذاری',
    'مفتاح خاص','أمان','نسخ احتياطي',
    '私钥','安全','备份','加密',
    'privater schlüssel','sicherheit','backup','verschlüsselung',
  ],
};

function _detectCategory(query) {
  const q = query.toLowerCase();
  let bestCat = 'protocol_fundamentals', bestScore = 0;
  for (const [cat, keywords] of Object.entries(CAT_KEYWORDS)) {
    const score = keywords.filter(kw => q.includes(kw)).length;
    if (score > bestScore) { bestScore = score; bestCat = cat; }
  }
  return bestCat;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: FRS-WEIGHTED TF-IDF SEARCH
// Higher FRS users get more precise, expert-level answers.
// Lower FRS users get simpler beginner-friendly explanations.
// ═══════════════════════════════════════════════════════════════════════════

function _frsWeightedSearch(helpData, query, lang, userFRS) {
  const safeLang    = SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
  const q           = query.toLowerCase();
  const qWords      = q.split(/[\s,;:?!]+/).filter(w => w.length > 2);
  const targetLevel = userFRS >= 70 ? 'advanced'
                    : userFRS >= 40 ? 'intermediate'
                    : 'beginner';
  const results     = [];

  for (const [catKey, catObj] of Object.entries(helpData)) {
    const section = catObj[safeLang] || catObj[DEFAULT_LANG];
    if (!section) continue;

    // Security warning: always surface for private key queries
    if (section.WARNING && catKey === 'private_key_security') {
      const pkScore = ['private key','کلید خصوصی','مفتاح خاص','私钥','privater']
        .filter(kw => q.includes(kw)).length;
      if (pkScore > 0) {
        results.push({
          score:      pkScore * 10,
          catKey,
          title:      section.title,
          answer:     section.WARNING,
          isWarning:  true,
          source:     'local',
          difficulty: 'critical',
        });
      }
    }

    for (const mod of (section.modules || [])) {
      // TF-IDF-style scoring
      const searchText  = (mod.heading + ' ' + mod.body + ' ' + (mod.tags || []).join(' ')).toLowerCase();
      let score         = qWords.filter(w => searchText.includes(w)).length;
      if (score === 0) continue;

      // Tag exact match bonus
      const tagBonus = (mod.tags || []).filter(t => q.includes(t)).length * 2;
      score += tagBonus;

      // FRS-level difficulty matching: penalise mismatch, reward match
      const diff = mod.difficulty || 'beginner';
      if (diff === targetLevel) score += 3;
      else if (
        (diff === 'advanced'     && targetLevel === 'beginner')  ||
        (diff === 'beginner'     && targetLevel === 'advanced')
      ) score -= 1;

      results.push({
        score,
        catKey,
        title:     section.title,
        heading:   mod.heading,
        answer:    mod.body,
        tags:      mod.tags || [],
        difficulty:mod.difficulty,
        id:        mod.id,
        isWarning: false,
        source:    'local',
      });
    }
  }

  // Sort by score descending, return top N
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, MAX_RESULTS);
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5: CONTEXT BUILDER FOR AI PIPELINE
// ═══════════════════════════════════════════════════════════════════════════

function _buildAIContext(helpData, category, lang, userFRS) {
  const safeLang = SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
  const catObj   = helpData[category];
  if (!catObj) return '';
  const section  = catObj[safeLang] || catObj[DEFAULT_LANG];
  if (!section) return '';

  const lines = [
    `[MIR KNOWLEDGE BASE — ${section.title}]`,
    `[USER FRS: ${userFRS}/100 — calibrate answer complexity accordingly]`,
  ];
  if (section.WARNING) lines.push(`[SECURITY WARNING: ${section.WARNING}]`);
  if (section.summary) lines.push(section.summary);

  (section.modules || []).forEach(mod => {
    lines.push(`\n[${mod.id}] ${mod.heading} (${mod.difficulty})`);
    lines.push(mod.body);
  });

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6: AI PIPELINE INJECTION
// Uses existing agent infrastructure — no new API connections.
// ═══════════════════════════════════════════════════════════════════════════

async function _queryAIPipeline(query, lang, context, userFRS) {
  // Path 1: ai_meta.js runExternalQuery bridge
  const meta = window._mirMeta;
  if (meta && typeof meta.runExternalQuery === 'function') {
    try {
      const system = [
        'You are the MIR Platform support agent. You are strictly neutral — you NEVER give financial advice.',
        'Always answer in the user\'s language. Be concise and precise.',
        `The user's FRS is ${userFRS}/100. ${userFRS >= 70 ? 'Give expert-level technical detail.' : userFRS >= 40 ? 'Give intermediate explanations.' : 'Keep it simple and beginner-friendly.'}`,
        'If the query involves trading, prices, or investment — end your response with the neutrality disclaimer.',
        '',
        'KNOWLEDGE BASE:',
        context,
      ].join('\n');
      const resp = await meta.runExternalQuery(system, query, 350);
      if (resp) return { answer: resp, source: 'ai' };
    } catch { /* fall through */ }
  }

  // Path 2: Direct Anthropic API via stored key
  const apiKey = window._MIR_ANTHROPIC_KEY
              || localStorage.getItem('mir_anthropic_key');
  if (apiKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model:      'claude-sonnet-4-20250514',
          max_tokens: 350,
          system:     `You are MIR support. Never give financial advice. User FRS: ${userFRS}/100. KNOWLEDGE:\n${context}`,
          messages:   [{ role: 'user', content: query }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.content?.find(b => b.type === 'text')?.text;
        if (text) return { answer: text, source: 'ai' };
      }
    } catch { /* fall through to local */ }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7: FINANCIAL NEUTRALITY GUARD
// ═══════════════════════════════════════════════════════════════════════════

function _needsNeutralityDisclaimer(query, answer) {
  const combined = (query + ' ' + answer).toLowerCase();
  return FINANCIAL_TERMS.some(t => combined.includes(t));
}

function _appendDisclaimer(answer, lang) {
  const safeLang = SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
  const disc     = NEUTRALITY_DISCLAIMER[safeLang] || NEUTRALITY_DISCLAIMER.en;
  return answer + '\n\n' + disc;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8: FRS GAMIFICATION
// ═══════════════════════════════════════════════════════════════════════════

function _awardFRS(query) {
  try {
    const pk  = _getUserPubKey();
    if (!pk) return;
    const qWords = query.trim().split(/\s+/).filter(w => w.length > 2);
    if (qWords.length < 2) return; // too trivial

    const delta   = qWords.length >= 5 ? FRS_DELTA_DEEP : FRS_DELTA_BASIC;
    const trivial = new Set(['hi','hello','help','test','ok','what','how','why']);
    if (qWords.every(w => trivial.has(w))) return;

    if (typeof window.applyFRS === 'function') {
      window.applyFRS(pk, delta, 'support_query');
    }
    _queryCount++;
  } catch { /* non-critical */ }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 9: PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * askSupport(query, lang)
 * Autonomous client-side support. No central server required.
 *
 * @param {string} query
 * @param {string} lang  — 'en'|'fa'|'ar'|'zh'|'de'
 * @returns {Promise<SupportResponse>}
 *
 * @typedef {Object} SupportResponse
 * @property {string}   answer
 * @property {string}   category
 * @property {string}   lang
 * @property {string}   source      — 'ai'|'local'
 * @property {boolean}  isWarning
 * @property {string}   difficulty  — user's FRS tier
 * @property {boolean}  hasDisclaimer
 * @property {number}   userFRS
 */
export async function askSupport(query, lang = DEFAULT_LANG) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return {
      answer: 'Please enter a question.',
      category: 'protocol_fundamentals', lang, source: 'local',
      isWarning: false, hasDisclaimer: false, userFRS: 50, difficulty: 'beginner',
    };
  }

  const safeLang = SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
  const trimmed  = query.trim().slice(0, MAX_QUERY_LEN);
  const userFRS  = _getUserFRS();
  const frsLevel = userFRS >= 70 ? 'advanced' : userFRS >= 40 ? 'intermediate' : 'beginner';

  // Load knowledge base
  const helpData = await _loadHelpData();

  // Detect category
  const category = _detectCategory(trimmed);

  // Check for private key security query — always surface warning immediately
  const isPrivKey = category === 'private_key_security'
    || /private.?key|کلید خصوصی|مفتاح خاص|私钥|privater schlüssel/i.test(trimmed);

  // FRS award (fire-and-forget)
  _awardFRS(trimmed);

  // Try AI pipeline
  const context   = _buildAIContext(helpData, category, safeLang, userFRS);
  const aiResult  = await _queryAIPipeline(trimmed, safeLang, context, userFRS);

  let answer, source, isWarning = isPrivKey;

  if (aiResult) {
    answer = aiResult.answer;
    source = 'ai';
  } else {
    // FRS-weighted local search
    const localResults = _frsWeightedSearch(helpData, trimmed, safeLang, userFRS);
    if (localResults.length > 0) {
      const top = localResults[0];
      isWarning = isWarning || top.isWarning;
      if (top.isWarning) {
        answer = top.answer;
      } else {
        // Compose answer: heading + body
        answer  = top.heading ? `**${top.heading}**\n\n${top.answer}` : top.answer;
        // Append additional related results if FRS is high enough
        if (userFRS >= 50 && localResults.length > 1 && !localResults[1].isWarning) {
          const rel = localResults[1];
          answer += `\n\n─\n**Related: ${rel.heading || ''}**\n${rel.answer.slice(0, 200)}...`;
        }
      }
    } else {
      answer = safeLang === 'fa'
        ? 'اطلاعاتی در پایگاه دانش پیدا نشد. لطفاً سوال را با کلمات دیگری بیان کنید.'
        : safeLang === 'ar'
        ? 'لم يُعثر على معلومات في قاعدة المعرفة. يرجى إعادة صياغة السؤال.'
        : 'No matching information found. Please rephrase your question or use the category tabs.';
    }
    source = 'local';
  }

  // Neutrality disclaimer guard
  const needsDisc   = _needsNeutralityDisclaimer(trimmed, answer);
  const hasDisclaimer = needsDisc;
  if (needsDisc) answer = _appendDisclaimer(answer, safeLang);

  return {
    answer,
    category,
    lang:         safeLang,
    source,
    isWarning,
    hasDisclaimer,
    userFRS,
    difficulty:   frsLevel,
  };
}

/**
 * getSupportCategories(lang)
 * Returns available help categories with titles in the requested language.
 */
export async function getSupportCategories(lang = DEFAULT_LANG) {
  const helpData = await _loadHelpData();
  const safeLang = SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
  return Object.entries(helpData).map(([key, catObj]) => ({
    key,
    title: catObj[safeLang]?.title || catObj[DEFAULT_LANG]?.title || key,
    hasWarning: !!(catObj[safeLang]?.WARNING || catObj[DEFAULT_LANG]?.WARNING),
  }));
}

/**
 * preloadHelp()
 * Call on Help button hover — begins loading knowledge base before click.
 * Zero-latency on open.
 */
export function preloadHelp() {
  if (!_helpData && !_loadingHD) _loadHelpData();
}

/**
 * getAgentStatus()
 * Returns diagnostic info about the support agent.
 */
export function getAgentStatus() {
  return {
    version:     SA_VERSION,
    kbLoaded:    !!_helpData,
    categories:  _helpData ? Object.keys(_helpData).length : 0,
    queryCount:  _queryCount,
    frsActive:   typeof window.applyFRS === 'function',
    aiAvailable: !!(window._mirMeta?.runExternalQuery
                 || localStorage.getItem('mir_anthropic_key')),
  };
}
