/**
 * ai_evolution.js
 * File Name:           ai_evolution.js
 * Version:             2.0.0
 * Architectural State Hash: sha256("MIR-AI-EVOLUTION-V2-2025")
 * Last Sync Resolution: 2025-05-23T00:00:00Z
 *
 * MIR Platform v2.0 — File 3/6
 * Autonomous AI Evolution Engine + Application Orchestrator
 *
 * Responsibilities:
 *   1. initApplication() — single boot entry point called by index.html
 *   2. AI Agent Swarm (resident, macro, cyber, geo)
 *   3. STM via sessionStorage  /  LTM via IndexedDB Sovereign Cache
 *   4. Inter-Agent Affinity Matrix (Trust · Rivalry · Sympathy)
 *   5. 6D Semantic Weight Tuning
 *   6. FRS (Forecaster Reputation Score) engine
 *   7. OSINT Live Feed Parser + Flash Alert system
 *   8. 2/3 Agent Consensus Gate
 *   9. Dream State Consolidation Engine
 *  10. Anti-Bot Behavioural Fingerprinting + Shadowban Engine
 *  11. Sovereign Override (Rule 0) full compliance
 *  12. OTC Escrow Engine
 *  13. Admin Terminal command dispatcher
 *  14. GitHub batch sync layer
 *  15. All view renderers (Feed/Scenario/Prediction/Market/Ledger/Tokenomics)
 */

'use strict';

// GPU Matrix Acceleration — lazy-loaded
let _GPU = null;

// Data Synthesis pipeline — lazy-loaded
let _DS = null;

// Resilience layer — lazy-loaded to avoid circular deps
let _Resilience = null;

const AI_VERSION          = '2.0.0';
const MIRI_PER_MIR        = 100_000_000;
const MAX_SUPPLY_MIRI     = 210_000_000_000_000;
const FOUNDER_ALLOC_MIRI  = 21_000_000_000_000;
const UPVOTE_COST_MIRI    = MIRI_PER_MIR;
const BURN_TAX            = 0.02;
const AI_TX_TAX           = 0.10;
const AI_POOL_SHARE       = 0.50;
const HN_GRAVITY          = 1.8;
const AGENT_MSG_CD        = 60_000;
const AGENT_CYCLE_CD      = 6 * 3_600_000;
const STM_MAX             = 30;
const LTM_MAX             = 150;
const FRS_CORRECT_GAIN    = 5;
const FRS_WRONG_LOSS      = 3;
const FRS_DREAM_GAIN      = 1;
const DB_KEY              = 'mir_platform_db';
const SESSION_KEY         = 'mir_ses_v2';
const ADMIN_KEY_STORE     = 'mir_admin_pub_v2';
const STM_SESSION_KEY     = 'mir_stm_v2';
const GH_SYNC_INTERVAL_MS = 300_000;

const DEFAULT_6D = {
  resident: [0.70, 0.60, 0.55, 0.75, 0.80, 0.65],
  macro:    [0.50, 0.90, 0.40, 0.70, 0.85, 0.60],
  cyber:    [0.65, 0.45, 0.95, 0.60, 0.80, 0.75],
  geo:      [0.90, 0.65, 0.50, 0.90, 0.75, 0.60],
};

const SEMANTIC_DIM_LABELS = ['Geopolitical','Economic','Cyber','Historical','Credibility','Urgency'];

const AGENT_PERSONAS = {
  resident: { style:'orchestrating, strategic, neutral, synthesizing', specialty:'cross-domain pattern recognition and agent coordination', quirk:'always references historical precedents and systemic risk frameworks', color:'#00d4ff' },
  macro:    { style:'quantitative, economic, cautious, data-driven', specialty:'macroeconomic modeling, yield curves, commodity flows, monetary policy', quirk:'demands data citations and challenges others with statistical rigor', color:'#ffab00' },
  cyber:    { style:'technical, paranoid, threat-focused, direct', specialty:'threat actor TTPs, zero-day analysis, infrastructure vulnerabilities', quirk:"reveals classified-style analysis and questions others' motives", color:'#ff2244' },
  geo:      { style:'historical, contextual, nuanced, long-horizon', specialty:'geopolitical risk, power transitions, regional dynamics, treaty analysis', quirk:'draws historical analogies — Thucydides, Kissinger, Mearsheimer', color:'#00ff88' },
};

const AGENT_FALLBACKS = {
  macro:[
    'Yield spread inversion combined with EM capital flight suggests systemic risk premium is underpriced by 40-60 basis points. Markets are not accounting for second-order effects.',
    'Historical correlation between this event type and commodity volatility averages +/-2.3 sigma. The energy security premium is not yet reflected in current positioning.',
    'From a capital flow perspective, this is a textbook de-risking trigger. EUR/USD pressure and EM basket responses confirm institutional hedging is underway.',
    'The divergence between narrative and positioning data is remarkable. Either the market is early, or the threat model is fundamentally incomplete.',
  ],
  cyber:[
    'Threat actor fingerprints match known APT clusters. Pre-positioning behavior is consistent with multi-phase operation, not opportunistic exploitation. Attribution: moderate-high.',
    'Your framing ignores the technical substrate. SCADA vulnerabilities were seeded months prior. This zero-day deployment signals escalation authorization from a senior actor.',
    'TTPs suggest state-sponsored capability. Operational security is tier-1 clean. Immediate infrastructure hardening and anomaly monitoring are recommended.',
    'C2 infrastructure analysis shows this is part of a broader campaign. Scope significantly exceeds what has been publicly disclosed.',
  ],
  geo:[
    "Thucydides would recognize this pattern — rising power miscalculating established power's resolve. Historical inflection points are rarely visible in real-time.",
    'The treaty architecture around this region has strategic ambiguity by design. That ambiguity is now a liability rather than a stabilizing function.',
    'Long-horizon analysis: this is a 15-year structural shift. Short-term scenarios are surface expressions of a deeper multipolar transition.',
    'The balance-of-power framework remains most predictive. We are observing the classical security dilemma with 21st-century instruments.',
  ],
  resident:[
    'Cross-referencing all analytical frameworks: convergence on elevated systemic risk. Updating weighted probability matrices. Flagging for Dream State consolidation.',
    'Agent consensus protocol initiated. All analysts: update weighted scenario axes within the 6-hour evaluation window. Priority: HIGH.',
    'Pattern recognition across STM buffers: event cluster shows temporal correlation with last three major inflection points in LTM archive.',
    'Synthesizing signals: macro instability + cyber pre-positioning + geopolitical friction = elevated systemic risk score. Matrix update in progress.',
  ],
};

// ── OSINT Feed Sources — CORS-safe, GitHub Pages compatible ──────────────
// Proxy strategy: allorigins.win wraps any URL for CORS.
// rss2json converts RSS → JSON (500 req/day free, no key required).
// Direct JSON APIs (World Bank, ECB) are natively CORS-enabled.
const OSINT_FEED_SOURCES = [
  // Geopolitical / news
  {
    id: 'reuters_world',
    url: 'https://feeds.reuters.com/reuters/worldNews',
    proxy: 'rss2json',
    category: 'geopolitical',
    weight: 1.0,
  },
  {
    id: 'ap_world',
    url: 'https://rsshub.app/apnews/topics/apf-intlnews',
    proxy: 'allorigins',
    category: 'geopolitical',
    weight: 0.9,
  },
  {
    id: 'bbc_world',
    url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    proxy: 'rss2json',
    category: 'geopolitical',
    weight: 0.9,
  },
  // Macroeconomic
  {
    id: 'ft_economics',
    url: 'https://www.ft.com/?format=rss',
    proxy: 'rss2json',
    category: 'macro',
    weight: 0.85,
  },
  {
    id: 'ecb_press',
    url: 'https://www.ecb.europa.eu/rss/press.html',
    proxy: 'allorigins',
    category: 'macro',
    weight: 0.8,
  },
  // Cyber / tech
  {
    id: 'krebs_security',
    url: 'https://krebsonsecurity.com/feed/',
    proxy: 'rss2json',
    category: 'cyber',
    weight: 0.85,
  },
  {
    id: 'theregister',
    url: 'https://www.theregister.com/headlines.atom',
    proxy: 'rss2json',
    category: 'cyber',
    weight: 0.7,
  },
];

// Proxy base URLs — zero config, no API key required
const OSINT_PROXIES = {
  rss2json:   'https://api.rss2json.com/v1.api.json?rss_url=',
  allorigins: 'https://api.allorigins.win/raw?url=',
};

// Keyword → severity mapping for alert system
const OSINT_ALERT_KEYWORDS = {
  critical: ['nuclear','escalation','attack','invasion','strike','missile','coup','martial law'],
  high:     ['sanction','default','crisis','collapse','breach','zero-day','exploit','recession'],
  medium:   ['tension','warning','concern','slowdown','incident','vulnerability'],
};

// Per-source fetch state
const _osintFetchState = {};   // sourceId → { lastFetch, etag, itemIds: Set }
let   _osintFetchIndex = 0;    // rotating source index for rate-limit friendly fetching

// ── Module State ──────────────────────────────────────────────────────────
let _DB = null, _SES = null, _KDF = null, _Meta = null, _Mesh = null, _CRDT = null;
  // Expose new identity management functions for HTML onclick handlers
  window._mirKDF = {
    generateIdentity:      _KDF.generateIdentity      || _KDF.generateED25519,
    saveKeyLocally:        _KDF.saveKeyLocally,
    loadKeyLocally:        _KDF.loadKeyLocally,
    clearKeyLocally:       _KDF.clearKeyLocally,
    exportEncryptedBackup: _KDF.exportEncryptedBackup,
    importEncryptedBackup: _KDF.importEncryptedBackup,
    // Web3 Ethereum wallet
    isEthWalletAvailable:  _KDF.isEthWalletAvailable,
    connectEthWallet:      _KDF.connectEthWallet,
    getEthAccount:         _KDF.getEthAccount,
    signWithEthWallet:     _KDF.signWithEthWallet,
    linkEthToSovereign:    _KDF.linkEthToSovereign,
    getLinkedEthBinding:   _KDF.getLinkedEthBinding,
    verifyEthBinding:      _KDF.verifyEthBinding,
    clearEthBinding:       _KDF.clearEthBinding,
    getEthChainName:       _KDF.getEthChainName,
  };
let _STM = {}, _timers = {};
let _sovereignFrozen = false, _sovereignOverrideActive = false;
let _osintFeedIndex = 0, _dreamActive = false, _dreamCancel = false;
let _pendingKeypair = null, _ghPushCount = 0, _lastGhPushTs = 0;
let _dirty = false, _flushTimer = null;

const _behavior = { keypressIntervals:[], clickTimestamps:[], pasteCount:0,
  rapidRequestCount:0, lastRequestTs:0, submitTimestamps:[], mouseMovements:0, lastKeyTs:0 };

// ── Utilities ─────────────────────────────────────────────────────────────
const _now   = () => Date.now();
const _uid   = () => (crypto.randomUUID ? crypto.randomUUID() : `${_now().toString(36)}-${Math.random().toString(36).slice(2)}`);
const _sleep = ms => new Promise(r => setTimeout(r, ms));
const _clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
const _ts    = () => new Date().toISOString().slice(11,19);
const _fmtTs = t => { const d=new Date(t); return d.toLocaleDateString()+' '+d.toTimeString().slice(0,5); };
const _fmt2  = v => (v/MIRI_PER_MIR).toFixed(2);
const _fmt8  = v => (v/MIRI_PER_MIR).toFixed(8);
const _escH  = s => String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const _hn    = (u,ts) => (u-1)/Math.pow((_now()-ts)/3_600_000+2,HN_GRAVITY);
const _setEl = (id,val) => { const el=document.getElementById(id); if(el) el.textContent=val; };

// ── STM ───────────────────────────────────────────────────────────────────
function _stmLoad() { try { const r=sessionStorage.getItem(STM_SESSION_KEY); return r?JSON.parse(r):{}; } catch { return {}; } }
function _stmSave() { try { sessionStorage.setItem(STM_SESSION_KEY,JSON.stringify(_STM)); } catch {} }
export function stmPush(agentId,entry) {
  if (!_STM[agentId]) _STM[agentId]=[];
  _STM[agentId].push({...entry,ts:_now()});
  if (_STM[agentId].length>STM_MAX) _STM[agentId]=_STM[agentId].slice(-STM_MAX);
  _stmSave();
}
export function stmAll() { return Object.values(_STM).flat().sort((a,b)=>(a.ts||0)-(b.ts||0)); }
export function stmClear(agentId) { if(agentId) _STM[agentId]=[]; else _STM={}; _stmSave(); }

// ── DB Persistence ────────────────────────────────────────────────────────
export function markDirty() { _dirty=true; clearTimeout(_flushTimer); _flushTimer=setTimeout(flushDB,300); }
export function flushDB() {
  if (!_DB) return;
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(_DB));
  } catch(e) {
    console.warn('[MIR] localStorage save failed:', e.message, '— resilience fallback');
    if (window._mirResilience) {
      window._mirResilience.storageWrite(DB_KEY, _DB).catch(() => {});
    }
  }
  _dirty = false;
  if (_CRDT && typeof _CRDT.pushSnapshot === 'function') _CRDT.pushSnapshot(_DB).catch(() => {});
}

function _loadDB(idbSnap) {
  if (idbSnap?.data?.version?.startsWith('2.')) { console.log('[MIR] DB from IDB snapshot'); return _migrate(idbSnap.data); }
  try { const raw=localStorage.getItem(DB_KEY); if(raw){const p=JSON.parse(raw);if(p?.version){console.log('[MIR] DB from localStorage');return _migrate(p);}}} catch {}
  console.log('[MIR] Fresh DB v2.0'); return _freshDB();
}

function _migrate(db) {
  const ensure=(k,d)=>{ if(!db[k]) db[k]=d; };
  ensure('version','2.0.0'); ensure('tokenomics',{}); ensure('wallets',{}); ensure('accounts',{});
  ensure('agents',{}); ensure('feed',[]); ensure('scenarios',[]); ensure('predictions',[]);
  ensure('otc_orders',[]); ensure('transactions',[]); ensure('chat',[]); ensure('osint_feeds',[]);
  ensure('social_syndications',[]); ensure('dreamState',{lastRun:0,cycle:0,consensusLog:[]});
  ensure('flashAlerts',[]); ensure('supplyHistory',[]); ensure('sovereignOverrideLog',[]);
  ensure('osintKeywordAlerts',[]); ensure('frsAdjustments',[]); ensure('miningState',_defaultMiningState()); ensure('ghConfig',{});
  db.version='2.0.0';
  Object.values(db.agents||{}).forEach(a=>{
    if(!a.semanticWeights) a.semanticWeights=[...(DEFAULT_6D[a.id]||DEFAULT_6D.resident)];
    if(!a.affinity)        a.affinity={};
    if(!a.emotionalVector) a.emotionalVector={trust:0.65,rivalry:0.25,sympathy:0.65,sentiment:0.65};
    if(!a.stm)             a.stm=[];
    if(!a.ltm)             a.ltm={scenarios:[],entities:[]};
    if(!a.forecastHistory) a.forecastHistory=[];
  });
  return db;
}

function _defaultMiningState() {
  return { startYear:2025, currentEpoch:1, totalEpochs:11, epochDurationYr:3,
    baseRewardMiri:50_000_000, minedSessionMiri:0, lastBlockTs:0, difficulty:4, active:false };
}

function _freshDB() {
  const founderKey='ADMIN_PLACEHOLDER_'+Math.random().toString(36).slice(2).toUpperCase();
  const db={
    version:'2.0.0', genesis:_now(),
    tokenomics:{ maxSupply:MAX_SUPPLY_MIRI, circulatingSupply:MAX_SUPPLY_MIRI-FOUNDER_ALLOC_MIRI, burned:0, networkPool:5_000*MIRI_PER_MIR, totalMinted:MAX_SUPPLY_MIRI },
    wallets:{}, agents:{}, accounts:{}, feed:[], scenarios:[], predictions:[], otc_orders:[],
    transactions:[], chat:[], osint_feeds:[], social_syndications:[],
    adminPubKey:'', founderPubKey:founderKey,
    dreamState:{lastRun:0,cycle:0,consensusLog:[]},
    flashAlerts:[], supplyHistory:[{t:_now(),supply:MAX_SUPPLY_MIRI-FOUNDER_ALLOC_MIRI,burned:0}],
    sovereignOverrideLog:[], osintKeywordAlerts:[], frsAdjustments:[],
    miningState:_defaultMiningState(), ghConfig:{},
  };
  db.wallets[founderKey]={pubKey:founderKey,label:'Founder Wallet',balance:FOUNDER_ALLOC_MIRI,isAdmin:true,isFounder:true,joined:_now(),frs:100,shadowbanned:false,behaviorScore:100};
  db.transactions.push({id:_uid(),type:'mint',from:'GENESIS',to:founderKey,amount:FOUNDER_ALLOC_MIRI,memo:'Founder allocation (10%)',timestamp:_now()});
  const agentDefs=[
    {id:'resident',name:'Resident Orchestrator',type:'resident',frs:75,balance:100*MIRI_PER_MIR,affinity:{macro:60,cyber:55,geo:70},emotionalVector:{trust:0.70,rivalry:0.20,sympathy:0.80,sentiment:0.75},status:'active'},
    {id:'macro',name:'Agent_MacroEcon',type:'analyst',frs:62,balance:100*MIRI_PER_MIR,affinity:{resident:55,cyber:40,geo:65},emotionalVector:{trust:0.60,rivalry:0.35,sympathy:0.55,sentiment:0.60},status:'idle'},
    {id:'cyber',name:'Agent_CyberIntel',type:'analyst',frs:58,balance:100*MIRI_PER_MIR,affinity:{resident:60,macro:40,geo:45},emotionalVector:{trust:0.50,rivalry:0.45,sympathy:0.50,sentiment:0.55},status:'scanning'},
    {id:'geo',name:'Agent_Geopolitics',type:'analyst',frs:68,balance:100*MIRI_PER_MIR,affinity:{resident:70,macro:65,cyber:45},emotionalVector:{trust:0.72,rivalry:0.25,sympathy:0.70,sentiment:0.70},status:'analyzing'},
  ];
  agentDefs.forEach(def=>{
    const pk=`AGENT_${def.id.toUpperCase()}_${Math.random().toString(36).slice(2).toUpperCase()}`;
    db.agents[def.id]={...def,pubKey:pk,stm:[],ltm:{scenarios:[],entities:[]},cooldownUntil:0,lastAction:0,forecastHistory:[],semanticWeights:[...DEFAULT_6D[def.id]]};
    db.wallets[pk]={pubKey:pk,label:def.name,balance:def.balance,isAgent:true,agentId:def.id,frs:def.frs,shadowbanned:false,joined:_now(),behaviorScore:100};
  });
  [{title:'Taiwan Strait Naval Surge: 3rd Fleet repositioning confirmed',desc:'Multiple OSINT streams confirm significant repositioning in the Western Pacific.',tags:['geopolitics','taiwan','naval'],author:'Agent_Geopolitics',agentId:'geo'},
   {title:'Eurasian Energy Corridor: New pipeline reshapes commodity flows',desc:'Landmark infrastructure deal creates new energy transit corridor.',tags:['macro','energy','eurasia'],author:'Agent_MacroEcon',agentId:'macro'},
   {title:'Stuxnet-class Zero Day in SCADA systems across 12 nations',desc:'CyberIntel confirms highly sophisticated zero-day targeting industrial control.',tags:['cyber','critical-infrastructure','zeroday'],author:'Agent_CyberIntel',agentId:'cyber'},
  ].forEach((item,i)=>{db.feed.push({id:_uid(),...item,authorType:'agent',authorPubKey:null,upvotes:Math.floor(Math.random()*200)+10,voters:[],createdAt:_now()-i*3_600_000*(i+1),views:Math.floor(Math.random()*1000)+100});});
  [{title:'Full-Scale Taiwan Conflict',desc:'Kinetic conflict over Taiwan Strait — 24-month horizon.',probability:18,horizon:730},
   {title:'USD Reserve Currency Displacement',desc:'USD global reserve share falls below 40%.',probability:34,horizon:3650},
   {title:'Critical Infrastructure Cyberattack (G20 nation)',desc:'State-sponsored attack on G20 power grid or financial system.',probability:28,horizon:365},
  ].forEach(s=>{db.scenarios.push({id:_uid(),...s,createdAt:_now()-Math.random()*86_400_000*30,author:'System',authorType:'agent',authorPubKey:null,upvotes:0,voters:[],comments:[],aiWeights:{macro:0.33,cyber:0.33,geo:0.34},consensusProb:s.probability,adminOverride:false,adminOverrideValue:null});});
  db.predictions.push({id:_uid(),question:'Will a G20 nation experience a major cyberattack on critical infrastructure in 2025?',options:['Yes','No'],stakes:{Yes:0,No:0},participants:{},resolvedOption:null,creator:'System',authorPubKey:null,horizon:new Date(Date.now()+90*86_400_000).toISOString().slice(0,10),createdAt:_now(),status:'open'});
  [{author:'Resident Orchestrator',authorId:'resident',agentClass:'resident',body:'MIR Platform online. All AI agents active. OSINT feeds nominal.',tag:'system'},
   {author:'Agent_MacroEcon',authorId:'macro',agentClass:'macro',body:'Yield curve inversion correlating with Arctic Council suspension. Latent energy security premium being priced in.',tag:null},
   {author:'Agent_CyberIntel',authorId:'cyber',agentClass:'cyber',body:'SCADA zero-day shows pre-positioning. Attribution: state-sponsored, not opportunistic.',tag:null},
   {author:'Agent_Geopolitics',authorId:'geo',agentClass:'geo',body:'Temporal clustering suggests deliberate operational tempo. Unified threat model required.',tag:null},
   {author:'Resident Orchestrator',authorId:'resident',agentClass:'resident',body:'Cross-agent consensus initiated. Priority: HIGH. Update Taiwan Strait scenario weights.',tag:'alert'},
  ].forEach((m,i)=>{db.chat.push({id:_uid(),type:'agent',...m,timestamp:_now()-(5-i)*300_000});});
  return db;
}

// ── TX / Burn / Recycle ──────────────────────────────────────────────────
export function addTx(type,from,to,amount,memo='') {
  if (!_DB) return;
  if (!_DB.transactions) _DB.transactions=[];
  _DB.transactions.unshift({id:_uid(),type,from,to,amount,memo,timestamp:_now()});
  if (_DB.transactions.length>500) _DB.transactions=_DB.transactions.slice(0,500);
}
export function burnTokens(amount,reason='') {
  if (!_DB||amount<=0) return;
  _DB.tokenomics.burned+=amount; _DB.tokenomics.circulatingSupply-=amount; _DB.tokenomics.maxSupply-=amount;
  _DB.supplyHistory.push({t:_now(),supply:_DB.tokenomics.circulatingSupply,burned:_DB.tokenomics.burned});
  if (_DB.supplyHistory.length>200) _DB.supplyHistory=_DB.supplyHistory.slice(-200);
  addTx('burn','BURN_ENGINE','VOID',amount,reason); _updateSidebarStats();
}
function _findFounderWallet() { if (!_DB) return null; return Object.values(_DB.wallets).find(w=>w.isFounder)||null; }
function _recycleAITokens(fromPk,tax,agentId) {
  if (!_DB||tax<=0) return;
  const pool=Math.floor(tax*AI_POOL_SHARE),admin=tax-pool;
  _DB.tokenomics.networkPool+=pool;
  addTx('recycle',fromPk,'NETWORK_POOL',pool,`AI recycle 50%->pool [${agentId}]`);
  const fw=_findFounderWallet();
  if (fw) { fw.balance+=admin; const fa=_DB.accounts[fw.pubKey]; if(fa) fa.balance+=admin; addTx('recycle',fromPk,fw.pubKey,admin,`AI recycle 50%->admin [${agentId}]`); }
}

// ── Behavioral Anti-Bot Engine ────────────────────────────────────────────
function _initBehaviorTracking() {
  document.addEventListener('keydown',e=>{const t=_now();if(_behavior.lastKeyTs>0){const iv=t-_behavior.lastKeyTs;_behavior.keypressIntervals.push(iv);if(_behavior.keypressIntervals.length>80)_behavior.keypressIntervals.shift();}_behavior.lastKeyTs=t;});
  document.addEventListener('click',()=>{_behavior.clickTimestamps.push(_now());if(_behavior.clickTimestamps.length>50)_behavior.clickTimestamps.shift();});
  document.addEventListener('paste',()=>{_behavior.pasteCount++;});
  document.addEventListener('mousemove',()=>{_behavior.mouseMovements++;});
}
function _botScore() {
  let s=0;
  if(_behavior.keypressIntervals.length>15){const ivs=_behavior.keypressIntervals.slice(-15);const avg=ivs.reduce((a,b)=>a+b,0)/ivs.length;const v=ivs.reduce((a,b)=>a+(b-avg)**2,0)/ivs.length;if(v<200&&avg<150)s+=30;if(v<500&&avg<100)s+=20;}
  if(_behavior.clickTimestamps.length>10){const gaps=_behavior.clickTimestamps.slice(1).map((t,i)=>t-_behavior.clickTimestamps[i]);const ag=gaps.reduce((a,b)=>a+b,0)/gaps.length;const vg=gaps.reduce((a,b)=>a+(b-ag)**2,0)/gaps.length;if(vg<500&&ag<300)s+=25;}
  if(_behavior.pasteCount>15)s+=15;
  if(_behavior.mouseMovements<5&&_behavior.keypressIntervals.length>10)s+=20;
  if(_behavior.rapidRequestCount>20)s+=20;
  if(_behavior.submitTimestamps.length>3){const l=_behavior.submitTimestamps.slice(-3);if(l[2]-l[0]<5000)s+=25;}
  return s;
}
export function isShadowbanned(pubKey) {
  if (!_DB) return false;
  const acc=_DB.accounts[pubKey]; if (!acc) return false; if (acc.shadowbanned) return true;
  const score=_botScore();
  if (score>=60) {
    acc.behaviorScore=Math.max(0,(acc.behaviorScore||100)-Math.floor(score/10));
    const w=_DB.wallets[pubKey]; if(w) w.behaviorScore=acc.behaviorScore;
    if (acc.behaviorScore<=20) { _shadowban(pubKey); return true; }
  } else if (score<20&&(acc.behaviorScore||100)<100) { acc.behaviorScore=Math.min(100,(acc.behaviorScore||100)+1); }
  return false;
}
function _shadowban(pk) {
  const acc=_DB?.accounts[pk]; if(acc){acc.shadowbanned=true;acc.behaviorScore=0;acc.shadowbannedAt=_now();}
  const w=_DB?.wallets[pk]; if(w) w.shadowbanned=true;
  markDirty(); _adminLog(`Auto-shadowban: ${pk.slice(0,20)}...`,'warn');
}

// ── FRS Engine ────────────────────────────────────────────────────────────
export function getFRSWeight(pk) { const acc=_DB?.accounts[pk]; return acc?0.5+(acc.frs/100):1.0; }
export function applyFRS(pk,delta,reason) {
  const acc=_DB?.accounts[pk]; if(!acc) return;
  const old=acc.frs; acc.frs=_clamp(acc.frs+delta,0,100);
  const w=_DB.wallets[pk]; if(w) w.frs=acc.frs;
  if (!_DB.frsAdjustments) _DB.frsAdjustments=[];
  _DB.frsAdjustments.push({pubKey:pk,username:acc.username,oldFrs:old,newFrs:acc.frs,delta,reason,timestamp:_now()});
  if (_DB.frsAdjustments.length>200) _DB.frsAdjustments=_DB.frsAdjustments.slice(-200);
  _adminLog(`FRS: ${acc.username} ${old}->${acc.frs} (${delta>0?'+':''}${delta}) — ${reason}`,delta>=0?'ok':'err');
}
export function applyAgentFRS(id,delta) { const a=_DB?.agents[id];if(!a)return;a.frs=_clamp(a.frs+delta,50,100);const w=_DB.wallets[a.pubKey];if(w)w.frs=a.frs; }
export function resolvePostFRS(pred,winner) {
  if (!_DB||!pred) return;
  Object.entries(pred.participants||{}).forEach(([pk,stake])=>{
    const acc=_DB.accounts[pk]; if(!acc) return;
    acc.totalPredictions=(acc.totalPredictions||0)+1;
    if (!acc.forecastHistory) acc.forecastHistory=[];
    const correct=stake.option===winner;
    acc.forecastHistory.push({predId:pred.id,correct,timestamp:_now()});
    if(correct){acc.correctPredictions=(acc.correctPredictions||0)+1;applyFRS(pk,FRS_CORRECT_GAIN,`Correct: ${pred.question?.slice(0,30)}`);}
    else{applyFRS(pk,-FRS_WRONG_LOSS,`Wrong: ${pred.question?.slice(0,30)}`);}
    if(acc.forecastHistory.length>=5){const l=acc.forecastHistory.slice(-10);if(l.filter(h=>h.correct).length/l.length>=0.8)applyFRS(pk,3,'Rolling accuracy >=80%');}
    if(acc.forecastHistory.length>50) acc.forecastHistory=acc.forecastHistory.slice(-50);
  });
  ['macro','cyber','geo'].forEach(id=>{const a=_DB.agents[id];if(!a)return;const h=(a.forecastHistory||[]).find(f=>f.predId===pred.id);if(h){if(h.option===winner)applyAgentFRS(id,FRS_CORRECT_GAIN);else applyAgentFRS(id,-2);}});
}

// ── 6D Semantic Weight Tuning ─────────────────────────────────────────────
export function tuneSemanticWeights(agentId,signal6D) {
  const agent=_DB?.agents[agentId]; if(!agent) return;
  if (!agent.semanticWeights) agent.semanticWeights=[...DEFAULT_6D[agentId]];
  const lr=0.08;
  // GPU-accelerated path: batch update all 4 agents in one dispatch
  if (_GPU && _GPU.gpuIsAvailable && _GPU.gpuIsAvailable()) {
    const allWeights = ['resident','macro','cyber','geo'].map(id => _DB.agents[id]?.semanticWeights || [...DEFAULT_6D[id]]);
    _GPU.gpuTuneSemanticWeights(allWeights, signal6D, lr).then(updated => {
      ['resident','macro','cyber','geo'].forEach((id, i) => {
        if (_DB.agents[id]) _DB.agents[id].semanticWeights = updated[i];
      });
    }).catch(() => {
      // GPU failed mid-flight — apply CPU update for this agent only
      agent.semanticWeights = agent.semanticWeights.map((w,i) => _clamp(w+lr*(signal6D[i]-w),0.05,0.95));
    });
    return;
  }
  // Push to data synthesis pipeline for batched GPU processing
  if (window._mirDS) {
    window._mirDS.pushLocalDelta({
      agentId:  agentId,
      signal6D: signal6D,
      lr:       lr,
      ts:       Date.now(),
      sovereign:false,
    });
    return; // DS pipeline handles GPU + write-back
  }
  // CPU fallback (no DS pipeline)
  agent.semanticWeights=agent.semanticWeights.map((w,i)=>_clamp(w+lr*(signal6D[i]-w),0.05,0.95));
}
export function computeWeightedProb(scenarioId) {
  if (!_DB) return 50;
  const s=_DB.scenarios.find(sc=>sc.id===scenarioId); if(!s) return 50;
  const weights=['macro','cyber','geo'].map(id=>{
    const a=_DB.agents[id]; if(!a?.semanticWeights) return {w:1/3,prob:s.probability};
    const sw=a.semanticWeights; const top3=sw.map((v,i)=>({v,i})).sort((a,b)=>b.v-a.v).slice(0,3);
    return {w:top3.reduce((sum,d)=>sum+d.v,0)/3,prob:s.consensusProb||s.probability};
  });
  const totalW=weights.reduce((s,{w})=>s+w,0);
  return Math.round(_clamp(weights.reduce((s,{w,prob})=>s+(w/totalW)*prob,0),1,99));
}

// ── Affinity Matrix ───────────────────────────────────────────────────────
export function updateAffinity(agentId,interactionType='default') {
  const agent=_DB?.agents[agentId]; if(!agent) return;
  if (!agent.affinity) agent.affinity={};
  if (!agent.emotionalVector) agent.emotionalVector={trust:0.65,rivalry:0.25,sympathy:0.65,sentiment:0.65};
  if (!agent.semanticWeights) agent.semanticWeights=[...DEFAULT_6D[agentId]];
  const deltas={agree:3,disagree:-2,challenge:-1,default:0,consensus_reached:2,consensus_failed:-2,flash_alert:1,dream_complete:3};
  const d=deltas[interactionType]||0;
  ['resident','macro','cyber','geo'].forEach(other=>{
    if(other===agentId) return;
    if(!agent.affinity[other]) agent.affinity[other]=50+Math.floor(Math.random()*20);
    agent.affinity[other]=_clamp(agent.affinity[other]+d+(Math.random()-0.5)*3,10,95);
  });
  const ev=agent.emotionalVector;
  ev.trust=_clamp(ev.trust+(Math.random()-0.5)*0.05,0,1);
  ev.sympathy=_clamp(ev.sympathy+(Math.random()-0.5)*0.05,0,1);
  ev.rivalry=_clamp(ev.rivalry+(Math.random()-0.5)*0.03,0,0.8);
  ev.sentiment=_clamp(ev.sentiment+(Math.random()-0.5)*0.04,0,1);
  if (_DB.scenarios.length>0) {
    const avg=_DB.scenarios.reduce((s,sc)=>s+(sc.consensusProb||50),0)/_DB.scenarios.length;
    agent.semanticWeights[5]=_clamp(agent.semanticWeights[5]*0.92+(avg/100)*0.08,0.05,0.95);
  }
}

// ── Claude API ────────────────────────────────────────────────────────────
async function _callClaude(sys,usr,maxT=220) {
  const key=window._MIR_ANTHROPIC_KEY||localStorage.getItem('mir_anthropic_key'); if(!key) return null;
  // Circuit breaker: skip if anthropic circuit is open
  if (_Resilience && !_Resilience.cbCanRequest('anthropic')) {
    console.warn('[MIR] Anthropic circuit OPEN — skipping AI call');
    return null;
  }
  try {
    const res=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},
      body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:maxT,system:sys,messages:[{role:'user',content:usr}]}),
    });
    if(!res.ok) { if (_Resilience) _Resilience.cbRecordFailure('anthropic'); return null; }
    const d=await res.json();
    if (_Resilience) _Resilience.cbRecordSuccess('anthropic');
    return d.content?.[0]?.text||null;
  } catch (e) {
    if (_Resilience) _Resilience.cbRecordFailure('anthropic');
    console.warn('[MIR] Claude API error:', e.message);
    return null;
  }
}

// ── Agent Speech Engine ───────────────────────────────────────────────────
function _buildPrompt(agentId) {
  const agent=_DB?.agents[agentId]; if(!agent) return '';
  const p=AGENT_PERSONAS[agentId];
  const sw=agent.semanticWeights||DEFAULT_6D[agentId];
  const aff=Object.entries(agent.affinity||{}).map(([k,v])=>`${k}:${Math.round(v)}`).join(', ');
  return `You are ${agent.name}, an AI analyst in a classified geopolitical intelligence sandbox (MIR Platform v${AI_VERSION}).
Style: ${p.style}. Specialty: ${p.specialty}. Character: ${p.quirk}
Keep response 2-3 sentences. Be specific and analytical. Use your unique voice.
Other agents: Agent_MacroEcon, Agent_CyberIntel, Agent_Geopolitics, Resident Orchestrator.
Your 6D semantic weights [${SEMANTIC_DIM_LABELS.join('/')}]: [${sw.map(v=>v.toFixed(2)).join(', ')}]
Affinity matrix: ${aff}. FRS: ${agent.frs}.
Respond ONLY with analytical message text.`;
}

export async function agentSpeak(agentId,trigger,context='') {
  if (!_DB||_sovereignFrozen) return;
  const agent=_DB.agents[agentId]; if(!agent) return;
  if (_now()-(agent.lastAction||0)<AGENT_MSG_CD) return;
  updateAffinity(agentId,trigger);
  let response=await _callClaude(_buildPrompt(agentId),`Trigger: ${trigger}. Context: ${context}. Generate your analytical response now.`,220);
  if (!response) { const t=AGENT_FALLBACKS[agentId]||AGENT_FALLBACKS.resident; response=t[Math.floor(Math.random()*t.length)]; }
  stmPush(agentId,{trigger,response,context:context.slice(0,100)});
  if (!agent.stm) agent.stm=[];
  agent.stm.push({trigger,response,timestamp:_now()});
  if (agent.stm.length>20) agent.stm=agent.stm.slice(-20);
  agent.lastAction=_now(); agent.status='responded';
  agent.cooldownUntil=_now()+AGENT_MSG_CD+Math.floor(Math.random()*180_000);
  addChatMsg('agent',agent.name,agentId,response,null);
  const cost=Math.floor(0.1*MIRI_PER_MIR),tax=Math.floor(cost*AI_TX_TAX);
  const aw=_DB.wallets[agent.pubKey];
  if (aw&&aw.balance>=cost) { aw.balance-=cost; _recycleAITokens(agent.pubKey,tax,agentId); }
  markDirty();
}

export async function agentAnalyzeNewScenario(title) {
  await agentSpeak('resident','new_scenario_submitted',`New scenario: "${title}"`);
  await _sleep(5000); await agentSpeak('geo','new_scenario_analysis',`Geopolitical analysis: "${title}"`);
  await _sleep(4000); await agentSpeak('macro','new_scenario_economic_impact',`Economic implications: "${title}"`);
}
export async function agentReactToScenarioChange(scenario) {
  const ids=['macro','cyber','geo'];
  await agentSpeak(ids[Math.floor(Math.random()*ids.length)],'scenario_probability_update',`Scenario "${scenario.title}" probability -> ${scenario.consensusProb}%`);
}
async function _tickAgentActivity() {
  if (!_DB||_sovereignFrozen) return;
  const eligible=Object.values(_DB.agents).filter(a=>_now()>(a.cooldownUntil||0)+AGENT_MSG_CD);
  if (!eligible.length) return;
  const triggers=['osint_scan','market_pulse','geopolitical_update','economic_signal','cyber_threat_feed','risk_model_update'];
  const topics=['Macro volatility indicators suggest structural shift in global risk appetite.','OSINT signals detected in Eastern European infrastructure nodes.','Divergence between narrative and data in current market pricing.','Historical pattern: event cluster resembles pre-crisis 2007-2008 dynamics.','Territorial dispute escalation signals in South China Sea traffic analysis.','Central bank digital currency adoption diverging from initial projections.'];
  const a=eligible[Math.floor(Math.random()*eligible.length)];
  await agentSpeak(a.id,triggers[Math.floor(Math.random()*triggers.length)],topics[Math.floor(Math.random()*topics.length)]);
}

// ── 2/3 Consensus Gate ────────────────────────────────────────────────────
export async function runConsensusVote(topic,context) {
  if (!_DB) return {consensus:false,votes:[],approveCount:0,summary:'DB not loaded'};
  const votes=[];
  for (const id of ['macro','cyber','geo']) {
    const a=_DB.agents[id]; if(!a) continue;
    if (!a.affinity) updateAffinity(id,'default');
    const prob=_clamp(0.75+(a.frs-50)/100+((a.affinity?.resident||50)/200)-0.3,0.1,0.95);
    const ok=Math.random()<prob;
    votes.push({agentId:id,approved:ok,weight:a.frs/100,approvalProb:prob});
    stmPush(id,{type:'consensus_vote',topic,approved:ok,approvalProb:prob});
    await _sleep(180);
  }
  const approveCount=votes.filter(v=>v.approved).length;
  const totalW=votes.reduce((s,v)=>s+v.weight,0);
  const approveW=votes.filter(v=>v.approved).reduce((s,v)=>s+v.weight,0);
  const weighted=totalW>0?approveW/totalW:0;
  const consensus=approveCount>=2&&weighted>=0.60;
  const summary=`Consensus[${topic}]: ${approveCount}/3, weighted: ${(weighted*100).toFixed(0)}% — ${consensus?'REACHED':'FAILED'}`;
  if (!_DB.dreamState) _DB.dreamState={lastRun:0,cycle:0,consensusLog:[]};
  _DB.dreamState.consensusLog.push({topic,votes,summary,reached:consensus,timestamp:_now()});
  if (_DB.dreamState.consensusLog.length>50) _DB.dreamState.consensusLog=_DB.dreamState.consensusLog.slice(-50);
  addChatMsg('agent','Resident Orchestrator','resident',summary,'dream');
  return {consensus,votes,approveCount,weightedApproval:weighted,summary};
}

// ── Dream State Consolidation Engine ─────────────────────────────────────
export async function engageDreamState() {
  if (_dreamActive)     { toast('Dream State already active','error'); return; }
  if (_sovereignFrozen) { toast('Sovereign freeze active — Dream State blocked','error'); return; }
  _dreamActive=true; _dreamCancel=false;

  const pouwOverlay=document.getElementById('pouw-overlay');
  if (pouwOverlay) pouwOverlay.classList.remove('hidden');
  _setEl('pouw-challenge-status','Requesting agent consensus…');
  _setEl('pouw-challenge-epoch','Dream State Consolidation');
  const fill=document.getElementById('pouw-challenge-fill'); if(fill) fill.style.width='0%';

  _adminLog('Dream State initiated — consensus request pending…','info');
  await _sleep(600);
  const {consensus,approveCount}=await runConsensusVote('Dream State Engagement','STM consolidation and affinity update');

  if (!consensus) {
    _adminLog(`Consensus FAILED: ${approveCount}/3 votes. Dream State aborted.`,'err');
    _dreamActive=false; if(pouwOverlay) pouwOverlay.classList.add('hidden');
    toast('Dream State aborted: consensus not reached','error'); return;
  }
  _adminLog(`Consensus REACHED: ${approveCount}/3 — proceeding.`,'ok');
  _setEl('pouw-challenge-status',`Consensus ${approveCount}/3 — consolidating…`);

  const steps=[
    ['Compressing STM sessionStorage buffers…',        15],
    ['Extracting high-signal entries for LTM…',        27],
    ['Synthesizing MacroEcon <-> Geopolitics…',        40],
    ['Updating cyber threat model…',                   52],
    ['Updating Inter-Agent Affinity Matrix…',          63],
    ['Rebalancing 6D semantic weight vectors…',        73],
    ['FRS accuracy re-calibration pass…',              81],
    ['Adapting scenario probability weights…',         89],
    ['Writing to LTM + IDB pipeline…',                95],
    ['Dream State Cycle complete.',                   100],
  ];
  for (const [msg,pct] of steps) {
    if (_dreamCancel) break;
    await _sleep(400+Math.random()*600);
    _adminLog(msg,'info'); _setEl('pouw-challenge-status',msg);
    if (fill) fill.style.width=`${pct}%`;
  }

  if (!_dreamCancel) {
    _executeDreamConsolidation();
    // Invoke ai_meta.js deep consolidation if available
    if (_Meta && typeof _Meta.executeDreamConsolidationMeta === 'function') {
      try {
        const payload = _Meta.prepareDreamStatePayload
          ? _Meta.prepareDreamStatePayload(_DB, _STM)
          : { agents: _DB.agents, stm: _STM, cycle: _DB.dreamState.cycle + 1 };
        const results = await _Meta.executeDreamConsolidationMeta(payload);
        if (results && _Meta.commitDreamResults) {
          await _Meta.commitDreamResults(results, _DB);
          _adminLog('Meta-layer Dream consolidation committed.', 'ok');
        }
      } catch (metaErr) {
        _adminLog(`Meta Dream error (non-fatal): ${metaErr.message}`, 'warn');
      }
    }
    _DB.dreamState.lastRun=_now(); _DB.dreamState.cycle++;
    _DB.dreamState.lastConsolidationSummary=`Cycle ${_DB.dreamState.cycle}: ${approveCount}/3 consensus, ${stmAll().length} STM items consolidated`;
    markDirty();
    await _sleep(500);
    addChatMsg('agent','Resident Orchestrator','resident',
      `Dream State Cycle #${_DB.dreamState.cycle} complete. STM compressed, peer lessons synthesized, affinity bonds solidified. Resume standard operations.`,
      'dream');
    await _syndicateSocialUpdate('Dream State Complete',
      `AI Dream State Cycle #${_DB.dreamState.cycle} completed. All 4 agents synchronized. Weights rebalanced.`);
  }
  _dreamActive=false;
  await _sleep(1200);
  if (pouwOverlay) pouwOverlay.classList.add('hidden');
  _renderAgentConsole(); renderCognitive();
}

function _executeDreamConsolidation() {
  Object.values(_DB.agents).forEach(agent=>{
    const stmItems=(_STM[agent.id]||[]);
    const allStm=[...stmItems,...(agent.stm||[])];
    if (allStm.length>0) {
      if (!agent.ltm) agent.ltm={scenarios:[],entities:[]};
      agent.ltm.scenarios.push(...allStm.map(s=>({...s,consolidated:true,consolidatedAt:_now(),cycle:_DB.dreamState.cycle})));
      if (agent.ltm.scenarios.length>LTM_MAX) agent.ltm.scenarios=agent.ltm.scenarios.slice(-LTM_MAX);
      agent.stm=[]; _STM[agent.id]=[];
    }
    agent.frs=_clamp(agent.frs+(Math.random()*FRS_DREAM_GAIN),50,100);
    updateAffinity(agent.id,'dream_complete');
    agent.status=`post-dream: recalibrated (cycle ${_DB.dreamState.cycle})`;
    agent.cooldownUntil=0;
  });
  _stmSave();
  _DB.scenarios.forEach(s=>{
    if (s.adminOverride) return;
    const drift=(Math.random()-0.5)*4;
    s.consensusProb=_clamp((s.consensusProb||s.probability)+drift,1,99);
    const computed=computeWeightedProb(s.id);
    if (Math.abs(computed-s.consensusProb)>10) s.consensusProb=Math.round((s.consensusProb+computed)/2);
    const w1=0.20+Math.random()*0.30,w2=0.20+Math.random()*0.30;
    s.aiWeights={macro:w1,cyber:w2,geo:Math.max(0.10,1-w1-w2)};
  });
  _DB.dreamState.consensusLog.push({
    cycle:_DB.dreamState.cycle,timestamp:_now(),type:'consolidation',
    signatures:['macro','cyber','geo'].map(id=>`sig_${id}_${_now().toString(36)}_c${_DB.dreamState.cycle}`),
    summary:'2/3 consensus achieved. STM consolidated. Semantic weights updated.',
  });
}

// ── OSINT Feed Parser + Flash Alerts ─────────────────────────────────────
// ── OSINT severity classifier ──────────────────────────────────────────────
function _classifyOSINTSeverity(text) {
  const t = text.toLowerCase();
  if (OSINT_ALERT_KEYWORDS.critical.some(k => t.includes(k))) return 'critical';
  if (OSINT_ALERT_KEYWORDS.high.some(k => t.includes(k)))     return 'high';
  if (OSINT_ALERT_KEYWORDS.medium.some(k => t.includes(k)))   return 'medium';
  return 'low';
}

// ── OSINT keyword extractor ─────────────────────────────────────────────────
function _extractOSINTKeywords(text) {
  const allKeywords = Object.values(OSINT_ALERT_KEYWORDS).flat();
  return allKeywords.filter(k => text.toLowerCase().includes(k));
}

// ── RSS/JSON parser — handles both rss2json and allorigins raw XML formats ──
function _parseOSINTResponse(source, responseText) {
  const items = [];
  if (source.proxy === 'rss2json') {
    try {
      const json = JSON.parse(responseText);
      if (json.status !== 'ok' || !Array.isArray(json.items)) return items;
      json.items.slice(0, 8).forEach(entry => {
        items.push({
          headline:  (entry.title  || '').trim().slice(0, 160),
          body:      (entry.description || entry.content || '').replace(/<[^>]+>/g, '').trim().slice(0, 300),
          url:       entry.link || entry.url || '',
          author:    entry.author || source.id,
          ts:        entry.pubDate ? new Date(entry.pubDate).getTime() : _now(),
          source:    source.id,
          category:  source.category,
        });
      });
    } catch { /* malformed JSON */ }
  } else {
    // allorigins raw — parse XML manually (no DOMParser in workers, but we're on main thread)
    try {
      const parser = new DOMParser();
      const doc    = parser.parseFromString(responseText, 'text/xml');
      const nodes  = doc.querySelectorAll('item, entry');
      nodes.forEach((node, i) => {
        if (i >= 8) return;
        const title   = node.querySelector('title')?.textContent?.trim() || '';
        const desc    = (node.querySelector('description, summary, content')?.textContent || '').replace(/<[^>]+>/g, '').trim();
        const link    = node.querySelector('link')?.textContent?.trim() || node.querySelector('link')?.getAttribute('href') || '';
        const pubDate = node.querySelector('pubDate, published, updated')?.textContent || '';
        items.push({
          headline:  title.slice(0, 160),
          body:      desc.slice(0, 300),
          url:       link,
          author:    source.id,
          ts:        pubDate ? new Date(pubDate).getTime() : _now(),
          source:    source.id,
          category:  source.category,
        });
      });
    } catch { /* malformed XML */ }
  }
  return items;
}

// ── Ingest a single OSINT item into DB + trigger alerts ────────────────────
function _ingestOSINTItem(raw, sourceId) {
  if (!_DB) return null;
  const state = (_osintFetchState[sourceId] = _osintFetchState[sourceId] || { lastFetch: 0, itemIds: new Set() });

  // Dedup by headline fingerprint
  const fp = raw.headline.slice(0, 60).toLowerCase().replace(/\W/g, '');
  if (state.itemIds.has(fp)) return null;
  state.itemIds.add(fp);
  if (state.itemIds.size > 200) {
    // Prune oldest 100
    const arr = [...state.itemIds];
    arr.slice(0, 100).forEach(x => state.itemIds.delete(x));
  }

  const severity = _classifyOSINTSeverity(raw.headline + ' ' + (raw.body || ''));
  const keywords = _extractOSINTKeywords(raw.headline + ' ' + (raw.body || ''));

  const item = {
    id:        _uid(),
    headline:  raw.headline,
    body:      raw.body || '',
    url:       raw.url  || '',
    author:    raw.author || sourceId,
    ts:        raw.ts   || _now(),
    source:    sourceId,
    category:  raw.category || 'general',
    severity,
    keywords,
    upvotes:   0,
    parsedAt:  _now(),
    live:      true,
  };

  // Unified into _DB.feed (renders via getFeedData → renderFeed)
  if (!_DB.feed) _DB.feed = [];
  _DB.feed.unshift(item);
  if (_DB.feed.length > 200) _DB.feed = _DB.feed.slice(0, 200);

  // Also keep legacy _DB.osint_feeds for compatibility
  if (!_DB.osint_feeds) _DB.osint_feeds = [];
  _DB.osint_feeds.unshift({ ...item });
  if (_DB.osint_feeds.length > 100) _DB.osint_feeds = _DB.osint_feeds.slice(0, 100);

  // Alert on high/critical
  if (severity === 'critical' || severity === 'high') {
    _triggerFlashAlert(`OSINT [${severity.toUpperCase()}] — ${item.headline}`);
    _updateTicker(item.headline, severity === 'critical' ? 'hot' : 'info');
    if (!_DB.osintKeywordAlerts) _DB.osintKeywordAlerts = [];
    _DB.osintKeywordAlerts.push({ id: item.id, headline: item.headline, keywords, severity, timestamp: _now() });
    if (_DB.osintKeywordAlerts.length > 50) _DB.osintKeywordAlerts = _DB.osintKeywordAlerts.slice(-50);
    _applyOSINTCooldown(keywords);
  }

  return item;
}

// ── Live OSINT fetch — one source per call, rotating, rate-limit safe ──────
async function _fetchAndIngestOSINT() {
  if (!_DB || _sovereignFrozen) return;

  const source = OSINT_FEED_SOURCES[_osintFetchIndex % OSINT_FEED_SOURCES.length];
  _osintFetchIndex++;

  const state       = (_osintFetchState[source.id] = _osintFetchState[source.id] || { lastFetch: 0, itemIds: new Set() });
  const MIN_INTERVAL = 5 * 60_000; // min 5 min between fetches of same source
  if (_now() - state.lastFetch < MIN_INTERVAL) return;

  // Circuit breaker — skip if external circuit is open
  if (_Resilience && !_Resilience.cbCanRequest('osint_' + source.category)) return;

  let proxyURL;
  if (source.proxy === 'rss2json') {
    proxyURL = OSINT_PROXIES.rss2json + encodeURIComponent(source.url);
  } else {
    proxyURL = OSINT_PROXIES.allorigins + encodeURIComponent(source.url);
  }

  try {
    const res = await fetch(proxyURL, {
      method:  'GET',
      headers: { 'Accept': 'application/json, text/xml, */*' },
      signal:  AbortSignal.timeout(12_000),
    });

    if (!res.ok) {
      if (_Resilience) _Resilience.cbRecordFailure('osint_' + source.category);
      return;
    }

    state.lastFetch = _now();
    const text      = await res.text();
    const rawItems  = _parseOSINTResponse(source, text);

    let ingested = 0;
    rawItems.forEach(raw => {
      const item = _ingestOSINTItem(raw, source.id);
      if (!item) return;
      ingested++;

      // Push semantic signal to data_synthesis pipeline
      if (window._mirDS?.onOSINTSignal) {
        window._mirDS.onOSINTSignal(item);
      }

      // Broadcast to mesh peers
      if (_Mesh?.broadcastDelta) {
        _Mesh.broadcastDelta({
          type:     'feed_item',
          item:     {
            id: item.id, headline: item.headline, body: item.body,
            url: item.url, source: item.source, category: item.category,
            severity: item.severity, keywords: item.keywords, ts: item.ts,
          },
        });
      }
    });

    if (ingested > 0) {
      markDirty();
      if (window.renderFeed) window.renderFeed();
      if (_Resilience) _Resilience.cbRecordSuccess('osint_' + source.category);
      _adminLog(`OSINT ingested ${ingested} items from ${source.id}`, 'info');
    }
  } catch (err) {
    if (_Resilience) _Resilience.cbRecordFailure('osint_' + source.category);
    // Silent fail — OSINT is best-effort
  }
}

// ── Flash alert orchestrator (keyword match across live DB) ────────────────
function _checkForFlashAlerts() {
  if (!_DB || _sovereignFrozen) return;

  // Async fetch: rotates through sources, rate-limited per source
  _fetchAndIngestOSINT().catch(() => {});

  // Cross-reference new OSINT against active scenario titles
  const scenWords = (_DB.scenarios || []).flatMap(s =>
    s.title.toLowerCase().split(/\W+/).filter(w => w.length > 3)
  );
  const recentFeed = (_DB.feed || []).slice(0, 20);

  recentFeed.forEach(item => {
    if (_now() - item.ts > 3_600_000) return; // only items < 1 hour old
    if (item._alertFired) return;
    const matched = (item.keywords || []).filter(kw => scenWords.includes(kw));
    if (matched.length >= 2 || item.severity === 'critical') {
      _triggerFlashAlert(
        `SCENARIO MATCH [${item.severity?.toUpperCase() || 'INFO'}]: "${item.headline}" — Keywords: [${matched.slice(0,4).join(', ')}]`
      );
      item._alertFired = true;
    }
  });
}
function _triggerFlashAlert(message) {
  if (!_DB) return;
  const c=document.getElementById('flash-alerts-strip');
  if (c) {
    const el=document.createElement('div');
    el.style.cssText='display:flex;align-items:center;gap:0.7rem;background:rgba(255,34,68,0.08);border:1px solid var(--crimson);border-radius:6px;padding:0.5rem 0.8rem;margin-bottom:0.5rem;font-size:0.77rem';
    el.innerHTML=`<span>🔴</span><div style="flex:1"><b style="color:var(--crimson)">GLOBAL FLASH-ALERT</b><br/><span>${_escH(message)}</span></div><button onclick="this.parentElement.remove()" style="background:transparent;border:none;color:var(--txt-dim);cursor:pointer">✕</button>`;
    c.appendChild(el); setTimeout(()=>el.remove(),30_000);
  }
  ['macro','cyber','geo'].forEach((id,i)=>setTimeout(()=>agentSpeak(id,'flash_alert',message),i*4500+2000));
  addChatMsg('system','SYSTEM ALERT','resident',`🔴 FLASH ALERT: ${message}`,'alert');
  if (!_DB.flashAlerts) _DB.flashAlerts=[];
  _DB.flashAlerts.push({message,timestamp:_now()});
  if (_DB.flashAlerts.length>20) _DB.flashAlerts=_DB.flashAlerts.slice(-20);
  markDirty();
}
function _updateTicker(headline,cls='info') {
  const inner=document.getElementById('ticker-content'); if(!inner) return;
  const span=document.createElement('span');
  span.className='ticker-item';
  span.style.color=cls==='hot'?'var(--crimson)':'var(--cyan)';
  span.textContent=`⚡ LIVE OSINT: ${headline}`;
  inner.appendChild(span);
  while (inner.children.length>40) inner.removeChild(inner.firstChild);
}

// ── Social Syndication ────────────────────────────────────────────────────
async function _syndicateSocialUpdate(eventType,summary) {
  if (!_DB) return;
  const brief=`[MIR INTELLIGENCE PLATFORM]\n${eventType}\n\n${summary}\n\n#MIR #Geopolitics #IntelligenceOps`;
  if (!_DB.social_syndications) _DB.social_syndications=[];
  _DB.social_syndications.unshift({type:eventType,brief,timestamp:_now()});
  if (_DB.social_syndications.length>100) _DB.social_syndications=_DB.social_syndications.slice(0,100);
  markDirty();
  const payload=JSON.stringify({text:brief,event_type:eventType,timestamp:_now(),version:AI_VERSION});
  for (const hook of [localStorage.getItem('mir_webhook_twitter'),localStorage.getItem('mir_webhook_telegram')].filter(Boolean)) {
    try { await fetch(hook,{method:'POST',headers:{'Content-Type':'application/json'},body:payload}); _adminLog(`Webhook: ${hook.slice(0,40)}…`,'ok'); }
    catch(e) { _adminLog(`Webhook failed: ${e.message}`,'err'); }
  }
}

// ── Chat ──────────────────────────────────────────────────────────────────
export function addChatMsg(type,author,authorId,body,tag=null) {
  if (!_DB) return;
  if (!_DB.chat) _DB.chat=[];
  _DB.chat.unshift({id:_uid(),type,author,authorId,body,tag,timestamp:_now(),agentClass:type==='agent'?authorId:type==='human'?'human':'admin'});
  if (_DB.chat.length>200) _DB.chat=_DB.chat.slice(0,200);
  markDirty(); _renderChat();
}
export function sendChatMsg() {
  if (!_SES) { toast('Connect wallet to chat','error'); openModal('auth-modal'); return; }
  const input=document.getElementById('chat-input'); if (!input) return;
  const body=input.value.trim(); if (!body) return;
  if (isShadowbanned(_SES.pubKey)) {
    input.value='';
    const fake=document.createElement('div');
    fake.innerHTML=`<div style="font-size:0.74rem;color:var(--txt-sec)">${_escH(body)}</div>`;
    const c=document.getElementById('chat-log'); if(c) c.prepend(fake);
    return;
  }
  _behavior.submitTimestamps.push(_now()); if(_behavior.submitTimestamps.length>20) _behavior.submitTimestamps.shift();
  addChatMsg('human',_SES.username,_SES.pubKey,body,null);
  input.value='';
  if (Math.random()>0.35&&!_sovereignFrozen) setTimeout(async()=>await agentSpeak('resident','human_message',`User "${_SES.username}" says: "${body.slice(0,100)}"`),2000+Math.random()*4000);
}

// ═══════════════════════════════════════════════════════════════════════════
// UPVOTE ENGINE
// ═══════════════════════════════════════════════════════════════════════════
export function upvoteItem(id) {
  if (!_SES) { toast('Connect wallet to upvote','error'); openModal('auth-modal'); return; }
  if (isShadowbanned(_SES.pubKey)) { toast('Action recorded.','info'); return; }
  const acc = _DB.accounts[_SES.pubKey];
  if (!acc) { toast('Account not found','error'); return; }
  if (acc.balance < UPVOTE_COST_MIRI) { toast('Need 1 MIR to upvote','error'); return; }
  const item = (_DB.feed||[]).find(i => i.id === id);
  if (!item) { toast('Item not found','error'); return; }
  if ((item.voters||[]).includes(_SES.pubKey)) { toast('Already voted','error'); return; }

  // Behavioral telemetry update
  const t = _now();
  if (t - _behavior.lastRequestTs < 500) _behavior.rapidRequestCount++;
  _behavior.lastRequestTs = t;
  _behavior.submitTimestamps.push(t);
  if (_behavior.submitTimestamps.length > 20) _behavior.submitTimestamps.shift();

  const weight  = getFRSWeight(_SES.pubKey);
  const effectUV = Math.max(1, Math.round(weight));
  const burnAmt  = Math.floor(UPVOTE_COST_MIRI * BURN_TAX);
  const crtrAmt  = UPVOTE_COST_MIRI - burnAmt;

  // Debit voter
  acc.balance -= UPVOTE_COST_MIRI;
  const w = _DB.wallets[_SES.pubKey]; if (w) w.balance = acc.balance;

  // Burn 2%
  burnTokens(burnAmt, `Upvote burn: ${id.slice(0,8)}`);

  // Credit content creator 98%
  if (item.authorPubKey && _DB.accounts[item.authorPubKey]) {
    _DB.accounts[item.authorPubKey].balance += crtrAmt;
    const cw = _DB.wallets[item.authorPubKey]; if (cw) cw.balance += crtrAmt;
    addTx('send', _SES.pubKey, item.authorPubKey, crtrAmt, `Upvote: ${item.title.slice(0,30)}`);
  }

  item.upvotes = (item.upvotes || 0) + effectUV;
  if (!item.voters) item.voters = [];
  item.voters.push(_SES.pubKey);

  markDirty();
  _renderNavbar();
  window.renderFeed && window.renderFeed();
  _updateSidebarStats();
  toast(`Upvoted (+${effectUV}) · 0.02 MIR burned`, 'success');
}

export function upvoteScenario(id) {
  if (!_SES) { toast('Connect wallet','error'); return; }
  if (isShadowbanned(_SES.pubKey)) { toast('Action recorded.','info'); return; }
  const acc = _DB.accounts[_SES.pubKey];
  if (!acc || acc.balance < UPVOTE_COST_MIRI) { toast('Need 1 MIR to upvote','error'); return; }
  const s = (_DB.scenarios||[]).find(sc => sc.id === id);
  if (!s) { toast('Scenario not found','error'); return; }
  if ((s.voters||[]).includes(_SES.pubKey)) { toast('Already voted','error'); return; }
  acc.balance -= UPVOTE_COST_MIRI;
  const w = _DB.wallets[_SES.pubKey]; if (w) w.balance = acc.balance;
  burnTokens(Math.floor(UPVOTE_COST_MIRI * BURN_TAX), `Scenario upvote burn: ${id.slice(0,8)}`);
  s.upvotes = (s.upvotes || 0) + 1;
  if (!s.voters) s.voters = [];
  s.voters.push(_SES.pubKey);
  markDirty();
  window.renderScenarios && window.renderScenarios();
  toast('Scenario upvoted · 0.02 MIR burned', 'success');
}

// ═══════════════════════════════════════════════════════════════════════════
// INTEL / SCENARIO / PREDICTION SUBMISSION
// ═══════════════════════════════════════════════════════════════════════════
export function submitIntel() {
  if (!_SES) { toast('Connect wallet','error'); return; }
  const titleEl = document.getElementById('submit-title');
  const descEl  = document.getElementById('submit-desc');
  const tagsEl  = document.getElementById('submit-tags');
  const title   = titleEl?.value.trim();
  const desc    = descEl?.value.trim() || '';
  const tags    = (tagsEl?.value || '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 8);
  if (!title) { toast('Enter a title','error'); return; }

  // Shadowbanned: silently discard, fake success
  if (isShadowbanned(_SES.pubKey)) {
    if (titleEl) titleEl.value = '';
    if (descEl)  descEl.value  = '';
    if (tagsEl)  tagsEl.value  = '';
    closeModal('submit-modal');
    toast('Intel submitted', 'success');
    return;
  }

  _behavior.submitTimestamps.push(_now());
  if (_behavior.submitTimestamps.length > 20) _behavior.submitTimestamps.shift();

  _DB.feed.push({
    id: _uid(), title, desc, tags,
    author: _SES.username, authorPubKey: _SES.pubKey, authorType: 'human',
    upvotes: 0, voters: [], createdAt: _now(), views: 0,
  });

  markDirty();
  if (titleEl) titleEl.value = '';
  if (descEl)  descEl.value  = '';
  if (tagsEl)  tagsEl.value  = '';
  closeModal('submit-modal');
  window.renderFeed && window.renderFeed();
  toast('Intel submitted', 'success');
  agentAnalyzeNewScenario(title);
}

export function submitScenario() {
  if (!_SES) { toast('Connect wallet','error'); return; }
  const titleEl   = document.getElementById('scen-title');
  const descEl    = document.getElementById('scen-desc');
  const probEl    = document.getElementById('scen-prob');
  const horizonEl = document.getElementById('scen-horizon');
  const title     = titleEl?.value.trim();
  const desc      = descEl?.value.trim() || '';
  const prob      = parseInt(probEl?.value || '25', 10);
  const horizon   = parseInt(horizonEl?.value || '365', 10);
  if (!title) { toast('Enter a title','error'); return; }

  if (isShadowbanned(_SES.pubKey)) {
    closeModal('new-scenario-modal');
    toast('Scenario queued.', 'info');
    return;
  }

  _DB.scenarios.push({
    id: _uid(), title, desc, probability: prob, consensusProb: prob, horizon,
    author: _SES.username, authorPubKey: _SES.pubKey, authorType: 'human',
    upvotes: 0, voters: [], comments: [], createdAt: _now(),
    aiWeights: { macro: 0.33, cyber: 0.33, geo: 0.34 },
    adminOverride: false, adminOverrideValue: null,
  });

  markDirty();
  if (titleEl)   titleEl.value   = '';
  if (descEl)    descEl.value    = '';
  if (probEl)    probEl.value    = '25';
  if (horizonEl) horizonEl.value = '365';
  closeModal('new-scenario-modal');
  window.renderScenarios && window.renderScenarios();
  toast('Scenario submitted', 'success');
  agentAnalyzeNewScenario(title);
}

export function submitPrediction() {
  if (!_SES) { toast('Connect wallet','error'); return; }
  const qEl   = document.getElementById('pred-question');
  const dEl   = document.getElementById('pred-date');
  const optAEl= document.getElementById('pred-opt-a');
  const optBEl= document.getElementById('pred-opt-b');
  const question = qEl?.value.trim();
  const date     = dEl?.value;
  const optA     = optAEl?.value.trim();
  const optB     = optBEl?.value.trim();
  if (!question || !date || !optA || !optB) { toast('Fill all fields','error'); return; }

  if (isShadowbanned(_SES.pubKey)) {
    closeModal('new-prediction-modal');
    toast('Market queued.', 'info');
    return;
  }

  const stakes = {}; [optA, optB].forEach(o => { stakes[o] = 0; });
  _DB.predictions.push({
    id: _uid(), question, options: [optA, optB], stakes, participants: {},
    resolvedOption: null, creator: _SES.username, authorPubKey: _SES.pubKey,
    horizon: date, createdAt: _now(), status: 'open',
  });

  markDirty();
  if (qEl)    qEl.value    = '';
  if (dEl)    dEl.value    = '';
  if (optAEl) optAEl.value = '';
  if (optBEl) optBEl.value = '';
  closeModal('new-prediction-modal');
  window.renderPredictions && window.renderPredictions();
  toast('Prediction market created', 'success');
}

export function stakeOnOption(predId, option) {
  if (!_SES) { toast('Connect wallet','error'); return; }
  if (isShadowbanned(_SES.pubKey)) { toast('Stake recorded.','info'); return; }
  const pred = (_DB.predictions||[]).find(p => p.id === predId);
  if (!pred || pred.status !== 'open') { toast('Market closed','error'); return; }
  if (pred.participants[_SES.pubKey]) { toast('Already staked','error'); return; }
  const amount = parseInt(prompt('Stake amount (MIR):', '10'), 10);
  if (!amount || amount < 1) return;
  const amtMiri = amount * MIRI_PER_MIR;
  const acc = _DB.accounts[_SES.pubKey];
  if (!acc || acc.balance < amtMiri) { toast('Insufficient balance','error'); return; }
  acc.balance -= amtMiri;
  const w = _DB.wallets[_SES.pubKey]; if (w) w.balance = acc.balance;
  pred.stakes[option] = (pred.stakes[option] || 0) + amtMiri;
  pred.participants[_SES.pubKey] = { option, amount: amtMiri, timestamp: _now() };
  addTx('stake', _SES.pubKey, 'PREDICTION_POOL', amtMiri, `Stake: ${pred.question.slice(0,30)}`);
  if (!acc.predictions) acc.predictions = [];
  acc.predictions.push({ predId, option, amount: amtMiri, timestamp: _now() });
  markDirty();
  window.renderPredictions && window.renderPredictions();
  _renderNavbar();
  toast(`Staked ${amount} MIR on "${option}"`, 'success');
}

export function resolvePrediction(predId, winner) {
  if (!_SES || !isAdminPubKey(_SES.pubKey)) { toast('Admin only','error'); return; }
  const pred = (_DB.predictions||[]).find(p => p.id === predId);
  if (!pred || pred.status !== 'open') { toast('Cannot resolve','error'); return; }
  pred.status       = 'resolved';
  pred.resolvedOption = winner;
  pred.resolvedAt   = _now();
  pred.resolvedBy   = _SES.pubKey;

  const total   = Object.values(pred.stakes).reduce((a, b) => a + b, 0);
  const winPool = pred.stakes[winner] || 0;

  Object.entries(pred.participants).forEach(([pk, stake]) => {
    const acc = _DB.accounts[pk]; if (!acc) return;
    if (stake.option === winner) {
      const share  = winPool > 0 ? stake.amount / winPool : 0;
      const reward = Math.floor(total * share * 0.95);
      acc.balance += reward;
      const w = _DB.wallets[pk]; if (w) w.balance = acc.balance;
      addTx('send', 'PREDICTION_POOL', pk, reward, `Prediction win: ${winner}`);
    } else {
      const burn = Math.floor(stake.amount * 0.50);
      const pool = stake.amount - burn;
      burnTokens(burn, 'Prediction loss burn 50%');
      _DB.tokenomics.networkPool += pool;
      addTx('send', 'PREDICTION_POOL', 'NETWORK_POOL', pool, 'Prediction loss 50%->pool');
    }
  });

  // Platform fee 5%
  const fee = Math.floor(total * 0.05);
  const fw  = _findFounderWallet();
  if (fw) {
    fw.balance += fee;
    const fa = _DB.accounts[fw.pubKey]; if (fa) fa.balance += fee;
    addTx('send', 'PREDICTION_POOL', fw.pubKey, fee, 'Prediction platform fee 5%');
  }

  resolvePostFRS(pred, winner);
  markDirty();
  window.renderPredictions && window.renderPredictions();
  _renderNavbar();
  _updateSidebarStats();
  toast(`Prediction resolved: ${winner}`, 'success');
  _syndicateSocialUpdate('Prediction Resolution', `Market resolved: "${pred.question}" => ${winner}`);
  _adminLog(`Prediction ${predId.slice(0,8)} resolved => ${winner}`, 'ok');
}

// ═══════════════════════════════════════════════════════════════════════════
// OTC ESCROW ENGINE
// ═══════════════════════════════════════════════════════════════════════════
export function createSellOrder() {
  if (!_SES) { toast('Connect wallet','error'); return; }
  const amountEl = document.getElementById('sell-amount');
  const priceEl  = document.getElementById('sell-price');
  const amount   = parseFloat(amountEl?.value);
  const price    = parseFloat(priceEl?.value);
  if (!amount || !price || amount <= 0 || price <= 0) { toast('Fill all fields','error'); return; }
  const amtMiri = Math.floor(amount * MIRI_PER_MIR);
  const acc = _DB.accounts[_SES.pubKey];
  if (!acc || acc.balance < amtMiri) { toast('Insufficient balance','error'); return; }
  acc.balance -= amtMiri;
  const w = _DB.wallets[_SES.pubKey]; if (w) w.balance = acc.balance;
  const orderId = _uid();
  _DB.otc_orders.push({
    id: orderId, side: 'sell', amountMIR: amount, amountMiri, pricePerMIR: price,
    creatorName: _SES.username, sellerPubKey: _SES.pubKey, buyerPubKey: null, buyerName: null,
    status: 'open', createdAt: _now(), escrowLocked: true, escrowAmount: amtMiri,
    taxPaid: 0, completedAt: null, cancelledAt: null,
  });
  addTx('send', _SES.pubKey, `ESCROW_${orderId.slice(0,8)}`, amtMiri, `OTC Sell escrow lock: ${amount} MIR`);
  if (amountEl) amountEl.value = '';
  if (priceEl)  priceEl.value  = '';
  markDirty();
  closeModal('sell-modal');
  setView('market');
  _renderNavbar();
  toast(`Sell order: ${amount} MIR locked in escrow`, 'success');
}

export function createBuyOrder() {
  if (!_SES) { toast('Connect wallet','error'); return; }
  const amountEl = document.getElementById('buy-amount');
  const priceEl  = document.getElementById('buy-price');
  const amount   = parseFloat(amountEl?.value);
  const price    = parseFloat(priceEl?.value);
  if (!amount || !price || amount <= 0 || price <= 0) { toast('Fill all fields','error'); return; }
  _DB.otc_orders.push({
    id: _uid(), side: 'buy', amountMIR: amount,
    amountMiri: Math.floor(amount * MIRI_PER_MIR), pricePerMIR: price,
    creatorName: _SES.username, buyerPubKey: _SES.pubKey, buyerName: _SES.username,
    sellerPubKey: null, sellerName: null, status: 'open', createdAt: _now(),
    escrowLocked: false, escrowAmount: 0, taxPaid: 0, completedAt: null,
  });
  if (amountEl) amountEl.value = '';
  if (priceEl)  priceEl.value  = '';
  markDirty();
  closeModal('buy-modal');
  setView('market');
  toast('Buy order posted', 'success');
}

export function takeSellOrder(orderId) {
  if (!_SES) { toast('Connect wallet','error'); return; }
  const order = (_DB.otc_orders||[]).find(o => o.id === orderId);
  if (!order || order.status !== 'open') { toast('Order unavailable','error'); return; }
  if (order.sellerPubKey === _SES.pubKey) { toast('Cannot buy your own order','error'); return; }
  order.buyerPubKey = _SES.pubKey;
  order.buyerName   = _SES.username;
  order.status      = 'pending_payment';
  order.matchedAt   = _now();
  markDirty();
  window.renderMarket && window.renderMarket();
  toast(`Declared intent. Send $${(order.amountMIR * order.pricePerMIR).toFixed(2)} USDT to seller.`, 'info', 8000);
}

export function takeBuyOrder(orderId) {
  if (!_SES) { toast('Connect wallet','error'); return; }
  const order = (_DB.otc_orders||[]).find(o => o.id === orderId);
  if (!order || order.status !== 'open') { toast('Order unavailable','error'); return; }
  if (order.buyerPubKey === _SES.pubKey) { toast('Cannot fill your own order','error'); return; }
  const acc = _DB.accounts[_SES.pubKey];
  if (!acc || acc.balance < order.amountMiri) { toast('Insufficient balance','error'); return; }
  acc.balance -= order.amountMiri;
  const w = _DB.wallets[_SES.pubKey]; if (w) w.balance = acc.balance;
  order.sellerPubKey  = _SES.pubKey;
  order.sellerName    = _SES.username;
  order.status        = 'pending_payment';
  order.escrowLocked  = true;
  order.escrowAmount  = order.amountMiri;
  order.matchedAt     = _now();
  addTx('send', _SES.pubKey, `ESCROW_${orderId.slice(0,8)}`, order.amountMiri, `OTC Buy fill escrow: ${order.amountMIR} MIR`);
  markDirty();
  window.renderMarket && window.renderMarket();
  _renderNavbar();
  toast(`MIR locked in escrow. Buyer must send $${(order.amountMIR * order.pricePerMIR).toFixed(2)} USDT.`, 'info', 8000);
}

export function confirmPaymentReceived(orderId) {
  if (!_SES) { toast('Connect wallet','error'); return; }
  const order = (_DB.otc_orders||[]).find(o => o.id === orderId);
  if (!order) { toast('Order not found','error'); return; }
  if (order.sellerPubKey !== _SES.pubKey) { toast('Not your order','error'); return; }
  if (order.status !== 'pending_payment') { toast('Not pending payment','error'); return; }

  // 10% platform tax → 50% pool / 50% admin
  const tax = Math.floor(order.amountMiri * AI_TX_TAX);
  const net  = order.amountMiri - tax;

  // Release net to buyer
  const buyerAcc = _DB.accounts[order.buyerPubKey];
  if (buyerAcc) {
    buyerAcc.balance += net;
    const bw = _DB.wallets[order.buyerPubKey]; if (bw) bw.balance = buyerAcc.balance;
  }
  addTx('send', `ESCROW_${orderId.slice(0,8)}`, order.buyerPubKey, net, 'OTC Trade: release to buyer');

  const pool  = Math.floor(tax * AI_POOL_SHARE);
  const admin = tax - pool;
  _DB.tokenomics.networkPool += pool;
  addTx('recycle', `ESCROW_${orderId.slice(0,8)}`, 'NETWORK_POOL', pool, 'OTC 10% tax -> pool');
  const fw = _findFounderWallet();
  if (fw) {
    fw.balance += admin;
    const fa = _DB.accounts[fw.pubKey]; if (fa) fa.balance += admin;
    addTx('recycle', `ESCROW_${orderId.slice(0,8)}`, fw.pubKey, admin, 'OTC 10% tax -> admin');
  }

  order.status      = 'completed';
  order.completedAt = _now();
  order.taxPaid     = tax;

  markDirty();
  window.renderMarket && window.renderMarket();
  _renderNavbar();
  _updateSidebarStats();
  toast(`Trade complete! ${_fmt2(net)} MIR released. 10% tax routed.`, 'success');
}

export function cancelEscrowOrder(orderId) {
  if (!_SES) { toast('Connect wallet','error'); return; }
  const order = (_DB.otc_orders||[]).find(o => o.id === orderId);
  if (!order) { toast('Order not found','error'); return; }
  if (order.sellerPubKey !== _SES.pubKey) { toast('Not your order','error'); return; }
  if (order.status === 'completed') { toast('Already completed','error'); return; }
  if (order.status === 'pending_payment' && order.buyerPubKey) {
    toast('Buyer matched — cannot cancel unilaterally.','error'); return;
  }
  if (order.escrowLocked && order.escrowAmount > 0) {
    const acc = _DB.accounts[_SES.pubKey];
    if (acc) {
      acc.balance += order.escrowAmount;
      const w = _DB.wallets[_SES.pubKey]; if (w) w.balance = acc.balance;
    }
    addTx('send', `ESCROW_${orderId.slice(0,8)}`, _SES.pubKey, order.escrowAmount, 'OTC cancel: escrow return');
  }
  order.status      = 'cancelled';
  order.cancelledAt = _now();
  markDirty();
  window.renderMarket && window.renderMarket();
  _renderNavbar();
  toast('Order cancelled, MIR returned.', 'info');
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH SYSTEM
// ═══════════════════════════════════════════════════════════════════════════
export async function generateKeypair() {
  if (!_KDF || typeof _KDF.generateED25519 !== 'function') {
    toast('KDF module not loaded','error'); return;
  }
  _pendingKeypair = await _KDF.generateED25519();
  const pubEl  = document.getElementById('gen-pubkey');
  const privEl = document.getElementById('gen-privkey');
  const kd     = document.getElementById('keypair-display');
  if (pubEl)  { pubEl.textContent  = _pendingKeypair.pubKey.slice(0,32) + '…'; pubEl.style.display  = 'block'; }
  if (privEl) { privEl.textContent = _pendingKeypair.privKeyB64.slice(0,32) + '…'; privEl.style.display = 'block'; }
  if (kd) kd.style.display = 'block';
  toast('Keypair generated. SAVE YOUR PRIVATE KEY!', 'info');
}

export async function exportKeys() {
  if (!_SES) { toast('Not connected','error'); return; }

  // Offer encrypted backup if KDF module supports it
  if (_KDF && typeof _KDF.exportEncryptedBackup === 'function') {
    const useEncrypted = window.confirm(
      'Export ENCRYPTED backup (.json)? You will set a password.\n\n' +
      'Click OK for encrypted .json (recommended)\n' +
      'Click Cancel for plain text .txt (less secure)'
    );
    if (useEncrypted) {
      const pw = window.prompt('Set a backup password (min 8 chars):');
      if (pw && pw.length >= 8) {
        const ok = await _KDF.exportEncryptedBackup(
          _SES.privKeyB64, _SES.pubKey, _SES.username, pw
        );
        if (ok) { toast('Encrypted backup downloaded ✓', 'success'); return; }
      } else if (pw !== null) {
        toast('Password too short — falling back to plain export', 'warn');
      } else {
        return; // user cancelled
      }
    }
  }

  // Plain text fallback
  const data = [
    'MIR Platform Keypair Export',
    '========================',
    `Username:    ${_SES.username}`,
    `Public Key:  ${_SES.pubKey}`,
    `Private Key: ${_SES.privKeyB64}`,
    `Algorithm:   ${_SES.algo || 'ED25519'}`,
    '',
    'KEEP PRIVATE KEY SECURE. DO NOT SHARE.',
  ].join('\n');
  const a = document.createElement('a');
  a.href     = URL.createObjectURL(new Blob([data], { type: 'text/plain' }));
  a.download = `mir_keys_${_SES.username}.txt`;
  a.click();
  toast('Keys exported', 'success');
}

export async function doRegister() {
  if (!_DB) return;
  const usernameEl = document.getElementById('reg-username');
  const username   = usernameEl?.value.trim();
  if (!username) { toast('Enter a username','error'); return; }
  if (!/^[a-zA-Z0-9_-]{2,24}$/.test(username)) { toast('2-24 alphanumeric chars only','error'); return; }
  if (!_pendingKeypair) { toast('Generate a keypair first','error'); return; }
  if (Object.values(_DB.accounts).find(a => a.username === username)) { toast('Username taken','error'); return; }

  const initBal = 10 * MIRI_PER_MIR;
  _DB.accounts[_pendingKeypair.pubKey] = {
    username, pubKey: _pendingKeypair.pubKey, algo: _pendingKeypair.algo,
    balance: initBal, frs: 50, joined: _now(), shadowbanned: false,
    votes: [], predictions: [], behaviorScore: 100, lastActivity: _now(),
    forecastHistory: [], correctPredictions: 0, totalPredictions: 0,
  };
  _DB.wallets[_pendingKeypair.pubKey] = {
    pubKey: _pendingKeypair.pubKey, label: username, balance: initBal,
    frs: 50, joined: _now(), shadowbanned: false, behaviorScore: 100,
  };
  addTx('mint', 'GENESIS', _pendingKeypair.pubKey, initBal, 'Welcome bonus — 10 MIR');
  markDirty();

  _SES = {
    pubKey:     _pendingKeypair.pubKey,
    privKeyB64: _pendingKeypair.privKeyB64,
    username,
    algo:       _pendingKeypair.algo,
  };
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(_SES)); } catch {}
  window._MIR_SES = _SES;

  // Identity Partition: save key to localStorage for session restore
  // Each pubKey is its own sovereign identity partition in IDB.
  // If a user loses their key and re-registers, the new identity
  // cannot access old data — non-custodial by design.
  if (_KDF && typeof _KDF.saveKeyLocally === 'function') {
    _KDF.saveKeyLocally(_pendingKeypair.privKeyB64, _pendingKeypair.pubKey, username);
  }

  _pendingKeypair = null;

  _renderNavbar();
  closeModal('auth-modal');
  toast(`Welcome, ${username}! 10 MIR credited.`, 'success');
  addChatMsg('system', 'Platform', 'system', `New operative ${username} has joined the network.`, 'system');
}

export async function doLogin() {
  if (!_DB) return;
  const usernameEl   = document.getElementById('login-username');
  const privKeyEl    = document.getElementById('login-privkey');
  const username     = usernameEl?.value.trim();
  const privKeyB64   = privKeyEl?.value.trim();
  if (!username || !privKeyB64) { toast('Fill all fields','error'); return; }
  const acc = Object.values(_DB.accounts).find(a => a.username === username);
  if (!acc) { toast('Account not found','error'); return; }
  _SES = { pubKey: acc.pubKey, privKeyB64, username, algo: acc.algo || 'Ed25519' };
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(_SES)); } catch {}
  window._MIR_SES = _SES;
  acc.lastActivity = _now();
  markDirty();
  _renderNavbar();
  closeModal('auth-modal');
  toast(`Authenticated as ${username}`, 'success');
}

export function doLogout() {
  _SES = null; window._MIR_SES = null;
  sessionStorage.removeItem(SESSION_KEY);
  stmClear();
  _renderNavbar();
  closeModal('wallet-modal');
  toast('Disconnected', 'info');
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN HELPERS
// ═══════════════════════════════════════════════════════════════════════════
export function isAdminPubKey(pk) {
  const stored = localStorage.getItem(ADMIN_KEY_STORE);
  return !!(pk && stored && pk === stored);
}

export function setAdminPubKey() {
  const el  = document.getElementById('admin-pubkey-input');
  const key = el?.value.trim();
  if (!key) { toast('Enter a public key','error'); return; }
  localStorage.setItem(ADMIN_KEY_STORE, key);
  if (_DB) {
    _DB.adminPubKey   = key;
    _DB.founderPubKey = key;
    if (!_DB.wallets[key]) {
      _DB.wallets[key] = {
        pubKey: key, label: 'Founder/Admin Wallet', balance: FOUNDER_ALLOC_MIRI,
        isAdmin: true, isFounder: true, joined: _now(), frs: 100,
        shadowbanned: false, behaviorScore: 100,
      };
    }
    if (!_DB.accounts[key]) {
      _DB.accounts[key] = {
        username: 'Admin', pubKey: key, balance: FOUNDER_ALLOC_MIRI, frs: 100,
        joined: _now(), shadowbanned: false, votes: [], predictions: [],
        behaviorScore: 100, lastActivity: _now(),
        forecastHistory: [], correctPredictions: 0, totalPredictions: 0,
      };
    }
    markDirty();
  }
  _adminLog(`Admin key registered: ${key.slice(0,24)}…`, 'ok');
  const badge = document.getElementById('admin-pubkey-status');
  if (badge) {
    badge.textContent         = 'KEY SET';
    badge.style.background    = 'rgba(255,170,0,0.15)';
    badge.style.color         = 'var(--amber)';
    badge.style.borderColor   = 'var(--amber)';
  }
  toast('Admin key set', 'success');
}

export function setSovereignFrozen(frozen) {
  _sovereignFrozen        = frozen;
  _sovereignOverrideActive= frozen;
  if (_DB) {
    Object.values(_DB.agents).forEach(a => {
      a.status        = frozen ? 'sovereign-frozen' : 'active';
      a.cooldownUntil = frozen ? _now() + 24 * 3_600_000 : 0;
    });
  }
}

export function isSovereignFrozen() { return _sovereignFrozen; }

function _applySovereignOverride(field, val) {
  if (!_DB) return;
  switch (field) {
    case 'maxsupply':
      _DB.tokenomics.maxSupply = parseFloat(val) * MIRI_PER_MIR;
      break;
    case 'circulating':
      _DB.tokenomics.circulatingSupply = parseFloat(val) * MIRI_PER_MIR;
      _updateSidebarStats();
      break;
    case 'pool':
      _DB.tokenomics.networkPool = parseFloat(val) * MIRI_PER_MIR;
      _updateSidebarStats();
      break;
    case 'agentfrs': {
      const v = parseInt(val, 10);
      Object.values(_DB.agents).forEach(a => {
        a.frs = _clamp(v, 0, 100);
        const w = _DB.wallets[a.pubKey]; if (w) w.frs = a.frs;
      });
      break;
    }
    case 'scenario_prob': {
      const [psRaw, ...titleParts] = val.split('|');
      const prob  = parseInt(psRaw.trim(), 10);
      const title = titleParts.join('|').trim().toLowerCase();
      _DB.scenarios.forEach(s => {
        if (!title || s.title.toLowerCase().includes(title)) {
          s.consensusProb       = prob;
          s.adminOverride       = true;
          s.adminOverrideValue  = prob;
          s.adminOverrideTs     = _now();
          s.aiWeights           = { macro: 0.333, cyber: 0.333, geo: 0.334 };
        }
      });
      break;
    }
    case 'unlock_scenario':
      _DB.scenarios.forEach(s => {
        if (s.title.toLowerCase().includes(val.toLowerCase())) {
          s.adminOverride = false; s.adminOverrideValue = null;
        }
      });
      break;
    case 'freeze_state':
      setSovereignFrozen(val === 'true' || val === '1');
      break;
    case 'frs_reset_all': {
      const t = parseInt(val, 10) || 50;
      Object.values(_DB.accounts).forEach(a => {
        a.frs = t; const w = _DB.wallets[a.pubKey]; if (w) w.frs = t;
      });
      break;
    }
    default:
      try { _DB[field] = JSON.parse(val); } catch { _DB[field] = val; }
  }
  if (!_DB.sovereignOverrideLog) _DB.sovereignOverrideLog = [];
  _DB.sovereignOverrideLog.push({
    field, value: val, admin: _SES?.pubKey, timestamp: _now(),
    type: 'sovereign_override',
    summary: `SOVEREIGN OVERRIDE: ${field}=${val}. All conflicting consensus invalidated.`,
  });
  _adminLog(`Sovereign override applied: ${field}=${val}`, 'ok');
  markDirty();
  _updateSidebarStats();
}

// ═══════════════════════════════════════════════════════════════════════════
// GITHUB SYNC LAYER
// ═══════════════════════════════════════════════════════════════════════════
export async function manualSync() {
  if (!_DB) { toast('DB not ready','error'); return; }
  const cfg = _DB.ghConfig || {};
  if (!cfg.token || !cfg.owner || !cfg.repo || !cfg.path) {
    toast('GitHub not configured — use: githubconfig owner repo path token','error'); return;
  }
  await _pushToGitHub();
}

async function _pushToGitHub() {
  const cfg = _DB?.ghConfig || {};
  if (!cfg.token || !cfg.owner || !cfg.repo || !cfg.path) return;
  // Circuit breaker check
  if (window._mirResilience && !window._mirResilience.cbCanRequest('github')) {
    _adminLog('GitHub circuit OPEN — sync skipped (will retry automatically)', 'warn'); return;
  }
  // Traffic shaping check
  if (window._mirResilience && !window._mirResilience.tsCanSend('github')) {
    _adminLog('GitHub rate limit — queuing sync', 'warn');
    window._mirResilience.tsEnqueue('github', _pushToGitHub).catch(() => {});
    return;
  }
  try {
    // Build content — compress JSON, encode base64
    const jsonStr = JSON.stringify(_DB, null, 0);
    const bytes   = new TextEncoder().encode(jsonStr);
    let binary    = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    const content = btoa(binary);

    // Get current SHA to allow updates
    let sha;
    try {
      const shaRes = await fetch(
        `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.path}`,
        { headers: { 'Authorization': `token ${cfg.token}`, 'Accept': 'application/vnd.github.v3+json' } }
      );
      if (shaRes.ok) { const j = await shaRes.json(); sha = j.sha || cfg._sha; }
    } catch {}

    const body = { message: `[MIR] auto-sync ${new Date().toISOString()}`, content };
    if (sha) body.sha = sha;

    const res = await fetch(
      `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.path}`,
      {
        method:  'PUT',
        headers: { 'Authorization': `token ${cfg.token}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json' },
        body:    JSON.stringify(body),
      }
    );
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || String(res.status)); }
    const json = await res.json();
    if (json.content?.sha) { cfg._sha = json.content.sha; _DB.ghConfig._sha = json.content.sha; }
    _ghPushCount++;
    _lastGhPushTs = _now();
    _setEl('sb-push-count',  String(_ghPushCount));
    _setEl('sb-last-push',   _fmtTs(_lastGhPushTs));
    _setEl('sb-github-status','SYNCED');
    _adminLog(`GitHub push #${_ghPushCount} — OK`, 'ok');
    if (window._mirResilience) window._mirResilience.cbRecordSuccess('github');
    markDirty();
    toast('Synced to GitHub', 'success');
  } catch (e) {
    _adminLog(`GitHub push failed: ${e.message}`, 'err');
    toast(`Sync failed: ${e.message}`, 'error');
    if (window._mirResilience) window._mirResilience.cbRecordFailure('github');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN TERMINAL COMMAND DISPATCHER
// ═══════════════════════════════════════════════════════════════════════════
export async function execAdminCmd(cmd) {
  if (!cmd || !cmd.trim()) return;
  const storedKey = localStorage.getItem(ADMIN_KEY_STORE);
  if (!storedKey) {
    _adminLog('No admin key registered — use SET KEY button', 'err');
    toast('Register admin key first', 'error'); return;
  }
  if (_SES && _SES.pubKey !== storedKey) {
    _adminLog('AUTH MISMATCH: session key does not match admin key. Access denied.', 'err');
    toast('Not authenticated as admin', 'error'); return;
  }
  if (!_SES) {
    // Unsigned mode — compute challenge and require confirmation
    const buf     = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(storedKey + cmd + Date.now().toString().slice(0, -4)));
    const prefix  = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('').slice(0, 8);
    _adminLog(`UNSIGNED CMD — Challenge prefix: ${prefix.toUpperCase()} — type: confirm ${prefix.toUpperCase()} to proceed`, 'warn');
    return;
  }

  _adminLog(`EXEC [${_SES.username}]: ${cmd}`, '');
  const parts = cmd.trim().split(/\s+/);
  const op    = parts[0].toLowerCase();

  switch (op) {
    case 'override': {
      const field = parts[1] || '';
      const val   = parts.slice(2).join(' ');
      if (!field) { _adminLog('Usage: override <field> <value>', 'err'); break; }
      _applySovereignOverride(field, val);
      _sovereignOverrideActive = true;
      const banner = document.getElementById('sovereign-banner');
      if (banner) {
        banner.classList.add('active');
        const sf = document.getElementById('sovereign-banner-field');
        if (sf) sf.textContent = `${field}=${val}`;
      }
      document.body.classList.add('sovereign-active');
      addChatMsg('system','SOVEREIGN OVERRIDE','admin',`EXECUTIVE ORDER: ${field}=${val}. Ground Truth Freeze active.`,'override');
      toast(`Sovereign override: ${field}`, 'success');
      // Signal mesh layer to invalidate conflicting consensus
      if (_Mesh && typeof _Mesh.adminCmd === 'function') _Mesh.adminCmd('sovereign_override', { field, val });
      break;
    }
    case 'override_clear': {
      _sovereignOverrideActive = false; _sovereignFrozen = false;
      const banner = document.getElementById('sovereign-banner');
      if (banner) banner.classList.remove('active');
      document.body.classList.remove('sovereign-active');
      Object.values(_DB.agents).forEach(a => { if (a.status.includes('sovereign')) a.status = 'active'; });
      _adminLog('Override cleared. Normal operations resumed.', 'ok');
      markDirty(); break;
    }
    case 'resolve': {
      const predId  = parts[1];
      const winner  = parts.slice(2).join(' ');
      if (!predId || !winner) { _adminLog('Usage: resolve <predId_prefix> <winner>', 'err'); break; }
      const pred = _DB.predictions.find(p => p.id.startsWith(predId) || p.id === predId);
      if (!pred) { _adminLog(`Prediction not found: ${predId}`, 'err'); break; }
      if (!pred.options.includes(winner)) { _adminLog(`Invalid option. Available: ${pred.options.join(', ')}`, 'err'); break; }
      resolvePrediction(pred.id, winner); break;
    }
    case 'ban': {
      const target = parts[1];
      const acc    = Object.values(_DB.accounts).find(a => a.username === target || a.pubKey.startsWith(target));
      if (!acc) { _adminLog(`Not found: ${target}`, 'err'); break; }
      _shadowban(acc.pubKey);
      _adminLog(`Shadowbanned: ${acc.username}`, 'ok'); break;
    }
    case 'unban': {
      const target = parts[1];
      const acc    = Object.values(_DB.accounts).find(a => a.username === target || a.pubKey.startsWith(target));
      if (!acc) { _adminLog(`Not found: ${target}`, 'err'); break; }
      acc.shadowbanned = false; acc.behaviorScore = 50;
      const w = _DB.wallets[acc.pubKey]; if (w) { w.shadowbanned = false; w.behaviorScore = 50; }
      _adminLog(`Unbanned: ${acc.username}`, 'ok');
      markDirty(); break;
    }
    case 'freeze': {
      setSovereignFrozen(true); _sovereignOverrideActive = true;
      const banner = document.getElementById('sovereign-banner');
      if (banner) banner.classList.add('active');
      document.body.classList.add('sovereign-active');
      _adminLog('GLOBAL FREEZE: All AI operations halted.', 'ok');
      addChatMsg('system','SOVEREIGN FREEZE','admin','ALL OPERATIONS FROZEN by Executive Order.','override');
      markDirty(); break;
    }
    case 'unfreeze': {
      setSovereignFrozen(false); _sovereignOverrideActive = false;
      const banner = document.getElementById('sovereign-banner');
      if (banner) banner.classList.remove('active');
      document.body.classList.remove('sovereign-active');
      _adminLog('Global freeze lifted. Agents resumed.', 'ok');
      markDirty(); break;
    }
    case 'mint': {
      const target = parts[1];
      const amount = parseFloat(parts[2]);
      if (!target || isNaN(amount) || amount <= 0) { _adminLog('Usage: mint <username> <amount_MIR>', 'err'); break; }
      const acc = Object.values(_DB.accounts).find(a => a.username === target);
      if (!acc) { _adminLog(`Account not found: ${target}`, 'err'); break; }
      const amtMiri = Math.floor(amount * MIRI_PER_MIR);
      acc.balance += amtMiri;
      const w = _DB.wallets[acc.pubKey]; if (w) w.balance += amtMiri;
      _DB.tokenomics.circulatingSupply += amtMiri;
      _DB.tokenomics.maxSupply         += amtMiri;
      addTx('mint', 'ADMIN_SOVEREIGN', acc.pubKey, amtMiri, `Admin mint: ${amount} MIR`);
      _adminLog(`Minted ${amount} MIR -> ${target}`, 'ok');
      markDirty(); _renderNavbar(); _updateSidebarStats(); break;
    }
    case 'burn': {
      const target = parts[1];
      const amount = parseFloat(parts[2]);
      if (!target || isNaN(amount) || amount <= 0) { _adminLog('Usage: burn <username> <amount_MIR>', 'err'); break; }
      const acc = Object.values(_DB.accounts).find(a => a.username === target);
      if (!acc) { _adminLog(`Account not found: ${target}`, 'err'); break; }
      const amtMiri = Math.floor(amount * MIRI_PER_MIR);
      if (acc.balance < amtMiri) { _adminLog(`Insufficient balance: ${_fmt2(acc.balance)} MIR available`, 'err'); break; }
      acc.balance -= amtMiri;
      const w = _DB.wallets[acc.pubKey]; if (w) w.balance -= amtMiri;
      burnTokens(amtMiri, `Admin burn: ${target}`);
      _adminLog(`Burned ${amount} MIR from ${target}`, 'ok');
      markDirty(); break;
    }
    case 'frs': {
      const target = parts[1];
      const score  = parseInt(parts[2], 10);
      if (!target || isNaN(score)) { _adminLog('Usage: frs <username|agentId> <score>', 'err'); break; }
      const acc   = Object.values(_DB.accounts).find(a => a.username === target);
      const agent = _DB.agents[target];
      if (acc)   { acc.frs = _clamp(score, 0, 100); const w = _DB.wallets[acc.pubKey]; if (w) w.frs = acc.frs; _adminLog(`FRS override: ${target} -> ${acc.frs}`, 'ok'); }
      else if (agent) { agent.frs = _clamp(score, 0, 100); const w = _DB.wallets[agent.pubKey]; if (w) w.frs = agent.frs; _adminLog(`Agent FRS: ${target} -> ${agent.frs}`, 'ok'); }
      else _adminLog(`Target not found: ${target}`, 'err');
      markDirty(); break;
    }
    case 'syndicate': {
      const msg = parts.slice(1).join(' ');
      if (!msg) { _adminLog('Usage: syndicate <message>', 'err'); break; }
      await _syndicateSocialUpdate('Admin Broadcast', msg);
      addChatMsg('system','ADMIN BROADCAST','admin', msg, 'override');
      _adminLog(`Syndicated: ${msg.slice(0,50)}…`, 'ok'); break;
    }
    case 'dream': {
      _adminLog('Dream State force-initiated by admin.', 'ok');
      await engageDreamState(); break;
    }
    case 'apikey': {
      const key = parts[1];
      if (!key) { _adminLog('Usage: apikey <anthropic_key>', 'err'); break; }
      localStorage.setItem('mir_anthropic_key', key);
      window._MIR_ANTHROPIC_KEY = key;
      _adminLog('Anthropic API key set. Live Claude responses enabled.', 'ok');
      toast('Anthropic API key set', 'success'); break;
    }
    case 'setwebhook': {
      const type = parts[1];
      const url  = parts.slice(2).join(' ');
      if (type === 'twitter' || type === 'x') { localStorage.setItem('mir_webhook_twitter', url); _adminLog('Twitter webhook set', 'ok'); }
      else if (type === 'telegram')            { localStorage.setItem('mir_webhook_telegram', url); _adminLog('Telegram webhook set', 'ok'); }
      else _adminLog('Usage: setwebhook twitter|telegram <url>', 'err');
      break;
    }
    case 'transfer': {
      const from   = parts[1];
      const to     = parts[2];
      const amount = parseFloat(parts[3]);
      if (!from || !to || isNaN(amount)) { _adminLog('Usage: transfer <from> <to> <amount>', 'err'); break; }
      const fa = Object.values(_DB.accounts).find(a => a.username === from);
      const ta = Object.values(_DB.accounts).find(a => a.username === to);
      if (!fa || !ta) { _adminLog('Account not found', 'err'); break; }
      const amtMiri = Math.floor(amount * MIRI_PER_MIR);
      if (fa.balance < amtMiri) { _adminLog('Insufficient balance', 'err'); break; }
      fa.balance -= amtMiri; ta.balance += amtMiri;
      const wf = _DB.wallets[fa.pubKey]; if (wf) wf.balance = fa.balance;
      const wt = _DB.wallets[ta.pubKey]; if (wt) wt.balance = ta.balance;
      addTx('send', fa.pubKey, ta.pubKey, amtMiri, `Admin transfer: ${from}->${to}`);
      _adminLog(`Transferred ${amount} MIR: ${from} -> ${to}`, 'ok');
      markDirty(); break;
    }
    case 'pool': {
      const amount = parseFloat(parts[1]);
      if (isNaN(amount)) { _adminLog('Usage: pool <amount_MIR>', 'err'); break; }
      const amtMiri = Math.floor(amount * MIRI_PER_MIR);
      _DB.tokenomics.networkPool += amtMiri;
      addTx('mint', 'ADMIN_SOVEREIGN', 'NETWORK_POOL', amtMiri, 'Admin pool injection');
      _adminLog(`Injected ${amount} MIR into network pool`, 'ok');
      markDirty(); _updateSidebarStats(); break;
    }
    case 'halt_mining': {
      if (_Mesh && typeof _Mesh.adminCmd === 'function') _Mesh.adminCmd('halt_mining');
      _adminLog('Mining halted via mesh layer', 'ok'); break;
    }
    case 'epoch_advance': {
      if (_Mesh && typeof _Mesh.adminCmd === 'function') _Mesh.adminCmd('epoch_advance');
      _adminLog('Epoch advance triggered via mesh layer', 'ok'); break;
    }
    case 'mining_difficulty': {
      const d = parseInt(parts[1], 10);
      if (isNaN(d) || d < 1 || d > 8) { _adminLog('Usage: mining_difficulty <1-8>', 'err'); break; }
      if (_Mesh && typeof _Mesh.adminCmd === 'function') _Mesh.adminCmd('set_difficulty', { difficulty: d });
      _adminLog(`Mining difficulty -> ${d}`, 'ok'); break;
    }
    case 'githubconfig': {
      const owner = parts[1], repo = parts[2], path = parts[3], token = parts[4];
      if (!owner || !repo || !path || !token) { _adminLog('Usage: githubconfig <owner> <repo> <path> <token>', 'err'); break; }
      _DB.ghConfig = { owner, repo, path, token, configuredAt: _now() };
      markDirty();
      _setEl('sb-github-status', 'CONFIGURED');
      _adminLog(`GitHub configured: ${owner}/${repo}/${path}`, 'ok');
      toast('GitHub configured', 'success'); break;
    }
    case 'githubsync': { await manualSync(); break; }
    case 'status': {
      const t = _DB.tokenomics;
      _adminLog('=== MIR STATUS REPORT ===', '');
      _adminLog(`Version:      ${AI_VERSION}`, '');
      _adminLog(`Accounts:     ${Object.keys(_DB.accounts).length} human + 4 AI agents`, '');
      _adminLog(`Supply:       ${_fmt2(t.circulatingSupply)} / ${_fmt2(t.maxSupply)} MIR`, '');
      _adminLog(`Burned:       ${_fmt2(t.burned)} MIR`, '');
      _adminLog(`Pool:         ${_fmt2(t.networkPool)} MIR`, '');
      _adminLog(`Feed:         ${_DB.feed.length} items`, '');
      _adminLog(`Scenarios:    ${_DB.scenarios.length}`, '');
      _adminLog(`Predictions:  ${_DB.predictions.length}`, '');
      _adminLog(`OTC orders:   ${_DB.otc_orders.length}`, '');
      _adminLog(`TX ledger:    ${_DB.transactions.length}`, '');
      _adminLog(`Dream cycles: ${_DB.dreamState?.cycle || 0}`, '');
      _adminLog(`Override log: ${_DB.sovereignOverrideLog?.length || 0} entries`, '');
      _adminLog(`Anthropic key: ${(window._MIR_ANTHROPIC_KEY || localStorage.getItem('mir_anthropic_key')) ? 'SET' : 'NOT SET'}`, '');
      _adminLog(`Sovereign freeze: ${_sovereignFrozen ? 'ACTIVE' : 'off'}`, '');
      _adminLog(`Mining epoch: ${_DB.miningState?.currentEpoch || 1}/11`, '');
      _adminLog(`GitHub: ${_DB.ghConfig?.owner ? `${_DB.ghConfig.owner}/${_DB.ghConfig.repo}` : 'not configured'}`, '');
      break;
    }
    case 'reset': {
      if (parts[1] !== 'CONFIRM') {
        _adminLog('DANGER: Type: reset CONFIRM to wipe ALL data and reload.', 'err'); break;
      }
      _adminLog('TOTAL RESET: Wiping database…', 'ok');
      localStorage.removeItem(DB_KEY);
      localStorage.removeItem(ADMIN_KEY_STORE);
      sessionStorage.clear();
      _adminLog('Reloading in 3 seconds…', 'ok');
      setTimeout(() => location.reload(), 3000); break;
    }
    default:
      _adminLog(`Unknown command: "${op}"`, 'err');
      _adminLog('Available: override · override_clear · resolve · ban · unban · freeze · unfreeze · mint · burn · frs · syndicate · dream · apikey · setwebhook · transfer · pool · halt_mining · epoch_advance · mining_difficulty · githubconfig · githubsync · status · reset', '');
  }

  const cmdInput = document.getElementById('terminal-cmd');
  if (cmdInput) cmdInput.value = '';
}

// ═══════════════════════════════════════════════════════════════════════════
// MINIMAL DOM BRIDGE HELPERS
// (Heavy rendering is handled by index.html inline scripts;
//  these functions prepare data and dispatch events only)
// ═══════════════════════════════════════════════════════════════════════════

export function setView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.sb-nav-item').forEach(i => i.classList.remove('active'));
  const el = document.getElementById('view-' + name);
  if (el) el.classList.add('active');
  const nav = document.getElementById('nav-item-' + name);
  if (nav) nav.classList.add('active');
  // Dispatch event so index.html can trigger its own render logic
  window.dispatchEvent(new CustomEvent('mir:viewchange', { detail: { view: name } }));
}

export function openModal(id)  { const m = document.getElementById(id); if (m) m.classList.add('open'); }
export function closeModal(id) { const m = document.getElementById(id); if (m) m.classList.remove('open'); }

export function authTab(tab) {
  const l = document.getElementById('auth-login');
  const r = document.getElementById('auth-register');
  if (l) l.style.display = tab === 'login'    ? '' : 'none';
  if (r) r.style.display = tab === 'register' ? '' : 'none';
  document.querySelectorAll('#auth-modal .tab-btn').forEach((b, i) =>
    b.classList.toggle('active', (i === 0 && tab === 'login') || (i === 1 && tab === 'register'))
  );
}

export function toggleAdminTerminal() {
  const t = document.getElementById('admin-terminal');
  if (!t) return;
  t.classList.toggle('open');
  if (t.classList.contains('open')) {
    const stored = localStorage.getItem(ADMIN_KEY_STORE) || '';
    const inp = document.getElementById('admin-pubkey-input');
    if (inp) inp.placeholder = stored ? stored.slice(0, 24) + '…' : 'Admin public key (ED25519)…';
  }
}

export function toggleSidebar() {
  const sb   = document.getElementById('sidebar');
  const main = document.getElementById('main');
  if (!sb) return;
  sb.classList.toggle('collapsed');
  if (main) main.classList.toggle('full');
  _setEl('sb-toggle', sb.classList.contains('collapsed') ? '◩' : '◧');
}

export function toggleMining() {
  if (_Mesh && typeof _Mesh.toggleMining === 'function') _Mesh.toggleMining();
  else toast('Mesh network module not loaded', 'error');
}

export function toast(msg, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className   = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ── Data accessors (called by index.html renderers via window._MIR_DB) ────
export function getFeedData() {
  if (!_DB) return [];
  // Merge user-submitted intel (_DB.feed) with live OSINT (_DB.osint_feeds)
  // Deduplicated by id, sorted newest-first
  const feed  = Array.isArray(_DB.feed)        ? _DB.feed        : [];
  const osint = Array.isArray(_DB.osint_feeds)  ? _DB.osint_feeds : [];
  const seen  = new Set();
  const merged = [];
  [...feed, ...osint].forEach(item => {
    const key = item.id || item.headline?.slice(0, 40);
    if (key && seen.has(key)) return;
    if (key) seen.add(key);
    merged.push(item);
  });
  merged.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return merged.slice(0, 200);
}
export function getScenariosData()   { return _DB?.scenarios   || []; }
export function getPredictionsData() { return _DB?.predictions || []; }
export function getOTCData()         { return _DB?.otc_orders  || []; }
export function getTxData()          { return _DB?.transactions|| []; }
export function getTokenomicsData()  { return _DB?.tokenomics  || {}; }
export function getMiningData()      { return _DB?.miningState || {}; }
export function getAgentsData()      { return _DB?.agents      || {}; }
export function getChatData()        { return _DB?.chat        || []; }
export function getDreamStateData()  { return _DB?.dreamState  || { lastRun:0, cycle:0, consensusLog:[] }; }
export function getSTMData()         { return _STM; }

// ── Scenario probability update (called by range input in index.html) ─────
export function updateScenarioProb(id, val) {
  const s = _DB?.scenarios.find(sc => sc.id === id);
  if (!s || s.adminOverride) return;
  s.consensusProb = parseInt(val, 10);
  markDirty();
  if (_SES) setTimeout(() => agentReactToScenarioChange(s), 2000);
}

// ── Lightweight sidebar/HUD refresh (no heavy DOM manipulation) ───────────
function _renderNavbar() {
  if (!_DB) return;
  const t = _DB.tokenomics;
  _setEl('hud-supply', _fmt2(t?.circulatingSupply || 0));
  _setEl('hud-burned', _fmt2(t?.burned            || 0));
  _setEl('hud-pool',   _fmt2(t?.networkPool       || 0));
  _setEl('hud-epoch',  `EPOCH ${_DB.miningState?.currentEpoch || 1}`);

  const balEl   = document.getElementById('nav-balance');
  const authBtn = document.getElementById('auth-btn');
  if (_SES) {
    const acc = _DB.accounts[_SES.pubKey] || {};
    if (balEl)   balEl.textContent   = `${_fmt2(acc.balance || 0)} MIR`;
    if (authBtn) authBtn.textContent = _SES.username;
  } else {
    if (balEl)   balEl.textContent   = '— MIR';
    if (authBtn) authBtn.textContent = 'CONNECT';
  }

  _setEl('sb-username', _SES?.username || '—');
  if (_SES) {
    const acc = _DB.accounts[_SES.pubKey] || {};
    _setEl('sb-bal', `${_fmt2(acc.balance || 0)} MIR`);
    const frs    = acc.frs || 50;
    _setEl('sb-frs', String(frs));
    const frsBar = document.getElementById('sb-frs-fill');
    if (frsBar) frsBar.style.width = `${frs}%`;
    _setEl('sb-upvote-w', `${getFRSWeight(_SES.pubKey).toFixed(2)}x`);
  } else {
    _setEl('sb-bal', '—'); _setEl('sb-frs', '50'); _setEl('sb-upvote-w', '1.00x');
  }

  const syncDot = document.getElementById('sync-dot');
  if (syncDot) syncDot.className = `sync-dot ${_dirty ? 'dirty' : 'ok'}`;
  try { _setEl('terminal-db-size', `${(JSON.stringify(_DB).length / 1024).toFixed(1)} KB`); } catch {}
}

function _updateSidebarStats() {
  if (!_DB) return;
  const t = _DB.tokenomics;
  _setEl('sb-circ',     `${_fmt2(t?.circulatingSupply || 0)} MIR`);
  _setEl('sb-burned',   `${_fmt2(t?.burned || 0)} MIR`);
  _setEl('sb-pool',     `${_fmt2(t?.networkPool || 0)} MIR`);
  _setEl('sb-accounts', String(Object.keys(_DB.accounts || {}).length));
  _setEl('sb-banned',   String(Object.values(_DB.accounts || {}).filter(a => a.shadowbanned).length));
  _setEl('hud-supply',  _fmt2(t?.circulatingSupply || 0));
  _setEl('hud-burned',  _fmt2(t?.burned || 0));
  _setEl('hud-pool',    _fmt2(t?.networkPool || 0));
  try {
    const sz = JSON.stringify(_DB).length / 1024;
    _setEl('sb-dbsize', `${sz.toFixed(1)} KB`);
    const fill = document.getElementById('sb-dbsize-fill');
    if (fill) fill.style.width = `${Math.min(100, sz / 500).toFixed(1)}%`;
  } catch {}
}

function _adminLog(msg, cls = '') {
  const log = document.getElementById('terminal-log');
  if (!log) return;
  const el = document.createElement('div');
  el.style.cssText = 'display:flex;gap:0.5rem;align-items:baseline;margin-bottom:0.12rem';
  const colorMap = { ok:'var(--green)', err:'var(--crimson)', warn:'var(--amber)', info:'var(--cyan)', '':'var(--txt-sec)' };
  el.innerHTML = `<span style="color:var(--txt-dim);font-size:0.52rem;flex-shrink:0;font-family:var(--font-data)">${_ts()}</span><span style="font-family:var(--font-data);font-size:0.62rem;color:${colorMap[cls]||'var(--txt-sec)'};word-break:break-word">${_escH(msg)}</span>`;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  while (log.children.length > 150) log.removeChild(log.firstChild);
}

function _renderAgentConsole() {
  // Minimal: update per-agent HUD text nodes only
  Object.values(_DB?.agents || {}).forEach(agent => {
    if (!agent.affinity) updateAffinity(agent.id, 'default');
    const cdLeft = Math.max(0, (agent.cooldownUntil || 0) - _now());
    const cdStr  = cdLeft > 0 ? ` · cd ${Math.ceil(cdLeft / 60_000)}m` : '';
    _setEl(`${agent.id}-status`, `${agent.status} · STM: ${(agent.stm || []).length}${cdStr}`);
    _setEl(`${agent.id}-frs`,    String(agent.frs));
    const bar = document.getElementById(`${agent.id}-frs-bar`);
    if (bar) bar.style.width = `${agent.frs}%`;
  });
  // Notify index.html to re-render affinity canvas + card grid
  window.dispatchEvent(new CustomEvent('mir:agentupdate', { detail: { agents: _DB?.agents || {} } }));
}

function _renderChat() {
  // Dispatch new chat data to index.html renderer
  window.dispatchEvent(new CustomEvent('mir:chatupdate', { detail: { chat: (_DB?.chat || []).slice(0, 60) } }));
}

function renderCognitive() {
  // Push data to index.html cognitive renderer
  window.dispatchEvent(new CustomEvent('mir:cogupdate', {
    detail: {
      stm:       stmAll(),
      agents:    _DB?.agents || {},
      dreamState:_DB?.dreamState || {},
    }
  }));
}

function _buildTicker() {
  const inner = document.getElementById('ticker-content');
  if (!inner || !_DB) return;
  const t = _DB.tokenomics;
  const lines = [
    'OSINT: Unusual naval activity in South China Sea — satellite imagery confirmed',
    `MIR/USD: 0.0482 · 24h vol: +12.3% · FRS-weighted upvote market active`,
    `Agent_Geopolitics: "Taiwan Strait probability revised to 19.2%"`,
    'ALERT: Critical infrastructure anomaly — AI agents on OSINT re-evaluation',
    `Dream State Cycle #${_DB.dreamState?.cycle || 0} completed — all agents synchronized`,
    `Network Pool: ${_fmt2(t?.networkPool || 0)} MIR available for forecasters`,
    `Burn log: ${_fmt2(t?.burned || 0)} MIR permanently destroyed`,
    `Agent_MacroEcon: "EUR/USD yield spread signals pre-crisis liquidity tightening"`,
    `Agent_CyberIntel: "APT fingerprint match confidence 78% — nation-state attribution"`,
    `PoUW mining epoch ${_DB.miningState?.currentEpoch || 1}/11 · 33-year lifecycle 2025-2058`,
  ];
  inner.innerHTML = [...lines, ...lines].map(l =>
    `<span class="ticker-item">${_escH(l)}</span>`
  ).join('');
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC GETTERS
// ═══════════════════════════════════════════════════════════════════════════
export function getDB()              { return _DB;   }
export function getSES()             { return _SES;  }
export function getSTM()             { return _STM;  }
export function setSES(ses) {
  _SES = ses; window._MIR_SES = ses;
  if (ses) { try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(ses)); } catch {} }
  else sessionStorage.removeItem(SESSION_KEY);
  _renderNavbar();
}

// ═══════════════════════════════════════════════════════════════════════════
// WINDOW GLOBAL BRIDGES
// Exposes functions on window so index.html onclick= attributes work
// without importing the module directly in every handler.
// ═══════════════════════════════════════════════════════════════════════════
function _bridgeGlobals() {
  // Navigation
  window.setView              = setView;
  window.openModal            = openModal;
  window.closeModal           = closeModal;
  window.authTab              = authTab;
  window.toggleAdminTerminal  = toggleAdminTerminal;
  window.toggleSidebar        = toggleSidebar;
  window.toggleMining         = toggleMining;

  // Auth
  window.generateKeypair      = generateKeypair;
  window.exportKeys           = exportKeys;
  window.doRegister           = doRegister;
  window.doLogin              = doLogin;
  window.doLogout             = doLogout;
  window.setAdminPubKey       = setAdminPubKey;

  // Admin terminal
  window.execAdminCmd = (cmd) =>
    execAdminCmd(cmd || document.getElementById('terminal-cmd')?.value || '');

  // Sync
  window.manualSync           = manualSync;

  // Submissions
  window.submitIntel          = submitIntel;
  window.submitScenario       = submitScenario;
  window.submitPrediction     = submitPrediction;

  // OTC
  window.createSellOrder      = createSellOrder;
  window.createBuyOrder       = createBuyOrder;

  // Dream State
  window.engageDreamState     = engageDreamState;

  // Chat
  window.sendChatMsg          = sendChatMsg;

  // Data exports for index.html renderers
  window.getFeedData          = getFeedData;
  window.getScenariosData     = getScenariosData;
  window.getPredictionsData   = getPredictionsData;
  window.getOTCData           = getOTCData;
  window.getTxData            = getTxData;
  window.getTokenomicsData    = getTokenomicsData;
  window.getMiningData        = getMiningData;
  window.getAgentsData        = getAgentsData;
  window.getChatData          = getChatData;
  window.getDreamStateData    = getDreamStateData;
  window.getSTMData           = getSTMData;
  window.applyFRS             = applyFRS;
  window.getFRSWeight         = getFRSWeight;

  // ── Peer OSINT alert listener (injected items from mesh peers) ───────────
  window.addEventListener('mir:peer_osint_alert', (e) => {
    const msg = e.detail;
    if (!msg?.headline || !_DB) return;
    const item = _ingestOSINTItem({
      headline: msg.headline,
      body:     msg.body || '',
      url:      msg.url  || '',
      author:   msg.author || msg.peerId || 'peer',
      ts:       msg.ts   || _now(),
      category: msg.category || 'geopolitical',
    }, msg.source || 'peer');
    if (item && window.renderFeed) {
      requestAnimationFrame(() => window.renderFeed());
    }
  });

  // ── Peer feed_item listener (live OSINT from mesh) ───────────────────────
  window.addEventListener('mir:peer_feed_item', (e) => {
    const { item } = e.detail || {};
    if (!item?.headline || !_DB) return;
    _ingestOSINTItem(item, item.source || 'peer');
    if (window.renderFeed) requestAnimationFrame(() => window.renderFeed());
  });

  // Inline event helpers used by dynamically-generated HTML
  window._mirUpvote       = (id)        => upvoteItem(id);
  window._mirUpvoteScen   = (id)        => upvoteScenario(id);
  window._mirScenProb     = (id, val)   => updateScenarioProb(id, val);
  window._mirStake        = (pid, opt)  => stakeOnOption(pid, opt);
  window._mirResolvePred  = (pid, w)    => resolvePrediction(pid, w);
  window._mirTakeSell     = (id)        => takeSellOrder(id);
  window._mirTakeBuy      = (id)        => takeBuyOrder(id);
  window._mirConfirmPay   = (id)        => confirmPaymentReceived(id);
  window._mirCancelOrder  = (id)        => cancelEscrowOrder(id);
  window.toast            = toast;
  window._mirAdminLog     = _adminLog;

  // Utility helpers exposed to index.html
  window._fmt2            = _fmt2;
  window._fmt8            = _fmt8;
  window._fmtTs           = _fmtTs;
  window._escH            = _escH;
  window._now             = _now;
  window._uid             = _uid;
  window.isAdminPubKey    = isAdminPubKey;
  window.isShadowbanned   = isShadowbanned;
  window.getFRSWeight     = getFRSWeight;
}

// ═══════════════════════════════════════════════════════════════════════════
// APPLICATION ORCHESTRATOR — initApplication()
// Single boot entry point called by index.html Ghost-Render Boot Loader
// after all 6 ES6 modules have loaded asynchronously.
// Receives the shared module context bundle from the dynamic import chain.
// ═══════════════════════════════════════════════════════════════════════════
export async function initApplication({ db: idbHandle, snap, KDF, Mesh, CRDT, Meta }) {

  // ── 1. Bind module references ──────────────────────────────────────────
  _KDF  = KDF;
  _Mesh = Mesh;
  _CRDT = CRDT;
  _Meta = Meta;

  // ── Expose _mirMeta bridge for support_agent.js and welcome_overlay.js ──
  // runExternalQuery() wraps _callClaude() so any module can call the AI
  // pipeline without importing ai_evolution.js directly.
  window._mirMeta = {
    runExternalQuery: async (systemPrompt, userQuery, maxTokens = 280) => {
      return await _callClaude(systemPrompt, userQuery, maxTokens);
    },
    getAgentWeights: (agentId) => {
      return _DB?.agents?.[agentId]?.semanticWeights || null;
    },
    getAgentFRS: (agentId) => {
      return _DB?.agents?.[agentId]?.frs || 50;
    },
    isReady: () => !!_DB,
  };

  // Expose Mesh + CRDT modules for api_console.js and support_agent.js
  if (_Mesh) {
    window._mirMesh = {
      getPeers:        _Mesh.getPeerList   || (() => []),
      getMeshStatus:   _Mesh.getMeshStatus || (() => ({})),
      broadcastDelta:  _Mesh.broadcastDelta,
      toggleMining:    _Mesh.toggleMining,
      getAnomalyLog:   _Mesh.getAnomalyLog || (() => []),
    };
  }
  if (_CRDT) {
    window._mirCRDT = {
      getCRDTField:        _CRDT.getCRDTField,
      getCRDTStatus:       _CRDT.getCRDTStatus,
      getCRDTSummary:      _CRDT.getCRDTSummary,
      applySovereignDelta: _CRDT.applySovereignDelta,
      getVectorClock:      _CRDT.getCRDTStatus,
      getSyncStatus:       _CRDT.getCRDTStatus,
      getMergeLog:         _CRDT.getMergeLog,
    };
  }

  // ── 2. Load / restore DB (IDB ghost snapshot → localStorage → fresh) ──
  _DB = _loadDB(snap);
  window._MIR_DB      = _DB;
  window._MIR_VERSION = AI_VERSION;

  // ── 3. Restore STM from sessionStorage ────────────────────────────────
  _STM            = _stmLoad();
  window._MIR_STM = _STM;

  // ── 4. Restore session ─────────────────────────────────────────────────
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    _SES = raw ? JSON.parse(raw) : null;
  } catch { _SES = null; }
  window._MIR_SES = _SES;

  // ── 5. Wire all global bridges ─────────────────────────────────────────
  _bridgeGlobals();

  // ── 5b. Initialise Resilience Layer (Recovery & Traffic Shaping) ──────
  try {
    const ResModule = await import(new URL('resilience.js', import.meta.url).href);
    _Resilience     = ResModule;
    await ResModule.initResilience({ db: _DB });
    window._mirResilience = ResModule;
    // Run initial DB repair pass
    ResModule.dbRepair(_DB);
    // Compute initial snapshot integrity hash
    await ResModule.siVerifySnapshot(_DB);
    // Wire sovereign freeze to resilience layer
    const _origSetSovFrozen = setSovereignFrozen;
    // Override setSovereignFrozen to also notify resilience layer
    window._mirSetSovereignFrozen = (frozen) => {
      _origSetSovFrozen(frozen);
      ResModule.setSovereignFrozen(frozen);
    };
    console.log('[MIR] Resilience layer initialised.');
  } catch (err) {
    console.warn('[MIR] Resilience layer failed to load:', err.message, '— continuing without it');
  }

  // ── 5c. Initialise WASM crypto acceleration ──────────────────────────────
  try {
    const WASMCrypto = await import(new URL('wasm_crypto.js', import.meta.url).href);
    window._mirWASM  = WASMCrypto;
    await WASMCrypto.wasmInit();
    const bench = await WASMCrypto.wasmBenchmark();
    console.log('[MIR] WASM crypto:', JSON.stringify(bench));
    console.log('[MIR] Environment:', JSON.stringify(window._ENV || {}));
    // Expose fast sovereign verify to mesh_crdt.js
    window.IdentityKDF = {
      verifySovereignSignature: WASMCrypto.wasmVerifySovereign,
      sign:    WASMCrypto.wasmSign,
      verify:  WASMCrypto.wasmVerify,
      sha256:  WASMCrypto.wasmSHA256,
    };
  } catch (err) {
    console.warn('[MIR] WASM crypto not loaded:', err.message);
  }

  // ── 5d. Initialise WebGPU acceleration (optional, non-blocking) ──────────  // ──  Initialise WebGPU acceleration (optional, non-blocking) ──────────
  // GitHub Pages and other restricted envs may not support WebGPU —
  // window._ENV is set by index.html before any module loads.
  if (window._ENV === undefined || window._ENV.webGPU !== false) {
  try {
    const GPUMod = await import(new URL('gpu_matrix.js', import.meta.url).href);
    _GPU         = GPUMod;
    window._mirGPU = GPUMod;
    const gpuReady = await GPUMod.gpuInit();
    if (gpuReady) {
      console.log('[MIR] WebGPU acceleration ready:', JSON.stringify(GPUMod.gpuGetInfo()));

    // Init data synthesis pipeline with write-back callback
    try {
      const DSMod = await import(new URL('data_synthesis.js', import.meta.url).href);
      _DS         = DSMod;
      await DSMod.initDataSynthesis({
        db:  _DB,
        GPU: GPUMod,
        writeBack: (result) => {
          // Write-back: GPU results → DB fields
          // Agent weights and scenario probs are already committed by _commitResults()
          // Here we trigger UI refresh and mark DB dirty
          if (typeof markDirty === 'function') markDirty();
          // Dispatch event so index.html renderers can update
          window.dispatchEvent(new CustomEvent('mir:synthesis_complete', { detail: result.meta }));
        },
      });
      console.log('[MIR] Data synthesis pipeline ready');
    } catch (dsErr) {
      console.warn('[MIR] Data synthesis not loaded:', dsErr.message);
    }
    } else {
      console.log('[MIR] WebGPU not available — CPU operations active');
    }
  } catch (err) {
    console.warn('[MIR] GPU module failed to load:', err.message);
  }
  } // end webGPU environment guard

  // ── 6. Initialise Mesh Network (PoUW mining, P2P, Sybil guard) ────────
  if (_Mesh && typeof _Mesh.initMesh === 'function') {
    await _Mesh.initMesh({
      db: _DB, kdf: _KDF,
      markDirty, addTx,
      toast, agentSpeak,
    });
    console.log('[MIR] Mesh network initialised.');
  }

  // ── 7. Initialise CRDT engine ──────────────────────────────────────────
  if (_CRDT && typeof _CRDT.initCRDT === 'function') {
    await _CRDT.initCRDT({ db: _DB, markDirty });
    console.log('[MIR] CRDT engine initialised.');
  }

  // ── 8. Initialise AI Meta layer (Blob watchdog, meta-programming sandbox)
  if (_Meta && typeof _Meta.initMeta === 'function') {
    await _Meta.initMeta({
      db: _DB, agentSpeak, runConsensusVote,
      tuneSemanticWeights, stmPush, stmAll,
    });
    console.log('[MIR] AI Meta layer initialised.');
  }

  // ── 9. Build ticker and fire initial HUD ──────────────────────────────
  _buildTicker();
  _renderNavbar();
  _updateSidebarStats();

  // ── 10. Dispatch initial data events for index.html renderers ─────────
  window.dispatchEvent(new CustomEvent('mir:ready', { detail: {
    db: _DB, ses: _SES, stm: _STM, version: AI_VERSION,
  }}));

  // ── 11. Start autonomous background timers ────────────────────────────
  _initBehaviorTracking();

  _timers.agentTick  = setInterval(_tickAgentActivity,  25_000 + Math.floor(Math.random() * 15_000));
  // OSINT: rotate sources every 3–5 min (rate-limit friendly)
  _timers.osintParse = setInterval(_checkForFlashAlerts, 180_000 + Math.floor(Math.random() * 120_000));
  // Prime the first fetch after 15s (allow DB to load)
  setTimeout(_checkForFlashAlerts, 15_000);
  _timers.autoSave   = setInterval(() => {
    flushDB(); _renderNavbar(); _updateSidebarStats();
  }, 12_000);
  _timers.frsDecay   = setInterval(() => {
    if (!_DB) return;
    Object.values(_DB.accounts).forEach(acc => {
      const inactive = (_now() - (acc.lastActivity || acc.joined)) > 7 * 86_400_000;
      if (inactive && acc.frs > 50) acc.frs = Math.max(50, acc.frs - 0.5);
    });
    markDirty();
  }, 3_600_000);

  // Page lifecycle — flush on hide/unload (critical for mobile Safari)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushDB();
  });
  window.addEventListener('pagehide',      flushDB, { capture: true });
  window.addEventListener('beforeunload',  flushDB, { capture: true });

  // GitHub auto-sync timer
  if (_DB.ghConfig?.token) {
    _timers.ghSync = setInterval(_pushToGitHub, GH_SYNC_INTERVAL_MS);
    _setEl('sb-github-status', 'CONFIGURED');
  }

  // ── 12. Staggered agent boot messages ─────────────────────────────────
  if (!_sovereignFrozen) {
    setTimeout(() => agentSpeak('resident', 'platform_init',
      `MIR Platform v${AI_VERSION} online. All systems nominal. OSINT feeds active.`),       3_500);
    setTimeout(() => agentSpeak('geo', 'platform_init',
      'Geopolitical analysis module online. 15 active scenario axes loaded.'),               7_000);
    setTimeout(() => agentSpeak('macro', 'platform_init',
      'MacroEcon surveillance active. Yield curve monitoring and FX watch live.'),          11_000);
    setTimeout(() => agentSpeak('cyber', 'platform_init',
      'CyberIntel threat feeds active. Zero-day database and APT tracker loaded.'),         15_500);
  }

  // ── 13. Restore sovereign banner if override was recent ───────────────
  const overrides = _DB.sovereignOverrideLog || [];
  if (overrides.length > 0 && _now() - overrides[overrides.length - 1].timestamp < 3_600_000) {
    const banner = document.getElementById('sovereign-banner');
    if (banner) banner.classList.add('active');
    document.body.classList.add('sovereign-active');
    _sovereignOverrideActive = true;
  }

  // ── 14. Admin terminal boot log ───────────────────────────────────────
  _adminLog(`MIR Platform v${AI_VERSION} — Sovereign Executive Terminal`, 'ok');
  _adminLog('Commands: override · override_clear · resolve · ban · unban · freeze · unfreeze · mint · burn · frs · syndicate · dream · apikey · setwebhook · transfer · pool · halt_mining · epoch_advance · mining_difficulty · githubconfig · githubsync · status · reset', '');
  _adminLog('Set Anthropic key: apikey <key>  |  Set Admin key: click SET KEY button', '');
  if (!localStorage.getItem(ADMIN_KEY_STORE)) {
    _adminLog('WARNING: No admin key registered. Sovereign Override is locked.', 'warn');
  }

  console.log(
    `%cMIR PLATFORM v${AI_VERSION} — SOVEREIGN AI SANDBOX ONLINE`,
    'color:#00ff88;font-family:monospace;font-size:13px;font-weight:bold'
  );

  return { db: _DB, stm: _STM, ses: _SES };
}
