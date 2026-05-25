/**
 * help_content.js
 * Version:      2.0.0
 * Arch Hash:    0cd97f1b6a24d823
 * Last Sync:    PHASE-3
 *
 * MIR Academy — Sovereign Knowledge Base
 * Pure data module. Zero functions. Zero side-effects.
 * Lazy-loaded by support_agent.js on first user interaction.
 *
 * Structure per category:
 *   { en, fa, ar, zh, de } → { title, summary, WARNING?, modules[] }
 *   Each module: { id, heading, body, tags[], difficulty }
 */

'use strict';

export const HELP_DATA = {

  // ═══════════════════════════════════════════════════════════════════════
  // 1. PROTOCOL FUNDAMENTALS
  // ═══════════════════════════════════════════════════════════════════════
  protocol_fundamentals: {
    en: {
      title:   'Protocol Fundamentals',
      summary: 'Core architecture, token model, and network rules of MIR.',
      modules: [
        {
          id: 'pf-001',
          heading: 'What is MIR?',
          body: 'MIR is a decentralised, browser-native sovereign intelligence platform. It operates without central servers. Your identity is a cryptographic keypair generated locally. Data persists in IndexedDB and propagates peer-to-peer via WebRTC. No account recovery exists — your private key is your identity.',
          tags: ['overview','identity','decentralised'],
          difficulty: 'beginner',
        },
        {
          id: 'pf-002',
          heading: 'Token Architecture — MIR & MIRI',
          body: 'Total fixed supply: 2,100,000.00000000 MIR. Smallest unit: 1 MIRI = 0.00000001 MIR (10^-8). Supply is mathematically capped — no inflation. Burns are permanent and reduce circulating supply each time a user upvotes content.',
          tags: ['tokenomics','supply','miri'],
          difficulty: 'beginner',
        },
        {
          id: 'pf-003',
          heading: 'Deflationary Burn Mechanics',
          body: 'Every upvote costs 1.00000000 MIR. 2% (0.02 MIR) is permanently burned — removed from circulating supply forever. 98% (0.98 MIR) goes to the content creator. AI-facilitated OTC orders carry a 10% infrastructure fee routed to the Network Rewards Pool.',
          tags: ['burn','upvote','deflationary'],
          difficulty: 'intermediate',
        },
        {
          id: 'pf-004',
          heading: 'Forecaster Reputation Score (FRS)',
          body: 'FRS ranges 0–100. It is earned exclusively when your prediction logs align with Admin Ground Truth resolutions. Higher FRS increases your upvote weight, your influence on consensus probability calculations, and your access to advanced analytical tools. FRS cannot be bought or transferred.',
          tags: ['frs','reputation','prediction'],
          difficulty: 'intermediate',
        },
        {
          id: 'pf-005',
          heading: 'Identity Partition & Key Loss Policy',
          body: 'Every ED25519 public key is a unique sovereign identity partition in IndexedDB. If you lose your private key, your data partition becomes permanently inaccessible. You may re-register with a new keypair, creating a fresh partition. This is non-custodial by design — MIR cannot recover lost keys.',
          tags: ['identity','key','recovery','partition'],
          difficulty: 'intermediate',
        },
      ],
    },
    fa: {
      title:   'اصول پروتکل',
      summary: 'معماری اصلی، مدل توکن و قوانین شبکه MIR.',
      modules: [
        {
          id: 'pf-001',
          heading: 'MIR چیست؟',
          body: 'MIR یک پلتفرم اطلاعاتی حاکمیتی غیرمتمرکز و مبتنی بر مرورگر است. بدون سرور مرکزی کار می‌کند. هویت شما یک جفت کلید رمزنگاری است که به صورت محلی تولید می‌شود. هیچ بازیابی حساب وجود ندارد — کلید خصوصی شما هویت شماست.',
          tags: ['overview','identity','decentralised'],
          difficulty: 'beginner',
        },
        {
          id: 'pf-002',
          heading: 'معماری توکن — MIR و MIRI',
          body: 'عرضه ثابت کل: ۲,۱۰۰,۰۰۰.۰۰۰۰۰۰۰۰ MIR. کوچکترین واحد: ۱ MIRI = ۰.۰۰۰۰۰۰۰۱ MIR. عرضه به صورت ریاضی محدود شده است — بدون تورم.',
          tags: ['tokenomics','supply','miri'],
          difficulty: 'beginner',
        },
        {
          id: 'pf-003',
          heading: 'مکانیزم سوزاندن کاهشی',
          body: 'هر رأی مثبت ۱.۰۰۰۰۰۰۰۰ MIR هزینه دارد. ۲٪ (۰.۰۲ MIR) برای همیشه سوزانده می‌شود. ۹۸٪ (۰.۹۸ MIR) به سازنده محتوا می‌رسد. سفارش‌های OTC با واسطه AI دارای کارمزد ۱۰٪ هستند.',
          tags: ['burn','upvote','deflationary'],
          difficulty: 'intermediate',
        },
        {
          id: 'pf-004',
          heading: 'امتیاز شهرت پیش‌بین (FRS)',
          body: 'FRS از ۰ تا ۱۰۰ است. فقط زمانی به دست می‌آید که پیش‌بینی‌های شما با نتایج واقعی مطابقت داشته باشند. FRS بالاتر وزن رأی و نفوذ شما را در محاسبات اجماع افزایش می‌دهد.',
          tags: ['frs','reputation','prediction'],
          difficulty: 'intermediate',
        },
        {
          id: 'pf-005',
          heading: 'پارتیشن هویت و سیاست از دست دادن کلید',
          body: 'هر کلید عمومی ED25519 یک پارتیشن هویت منحصر به فرد در IndexedDB است. اگر کلید خصوصی را گم کنید، پارتیشن داده شما برای همیشه غیرقابل دسترس می‌شود. می‌توانید با یک جفت کلید جدید مجدداً ثبت‌نام کنید.',
          tags: ['identity','key','recovery','partition'],
          difficulty: 'intermediate',
        },
      ],
    },
    ar: {
      title:   'أساسيات البروتوكول',
      summary: 'البنية الأساسية ونموذج التوكن وقواعد شبكة MIR.',
      modules: [
        {
          id: 'pf-001',
          heading: 'ما هو MIR؟',
          body: 'MIR منصة استخباراتية سيادية لامركزية تعمل في المتصفح بدون خوادم مركزية. هويتك هي زوج مفاتيح تشفيري يُنشأ محلياً. لا يوجد استرداد للحساب — مفتاحك الخاص هو هويتك.',
          tags: ['overview','identity','decentralised'],
          difficulty: 'beginner',
        },
        {
          id: 'pf-002',
          heading: 'بنية التوكن — MIR و MIRI',
          body: 'الإمداد الثابت الكلي: 2,100,000.00000000 MIR. أصغر وحدة: 1 MIRI = 0.00000001 MIR. الإمداد محدود رياضياً — لا تضخم.',
          tags: ['tokenomics','supply','miri'],
          difficulty: 'beginner',
        },
      ],
    },
    zh: {
      title:   '协议基础',
      summary: 'MIR的核心架构、代币模型和网络规则。',
      modules: [
        {
          id: 'pf-001',
          heading: '什么是MIR？',
          body: 'MIR是一个去中心化、基于浏览器的主权情报平台，无需中央服务器运行。您的身份是本地生成的加密密钥对。没有账户恢复功能——您的私钥就是您的身份。',
          tags: ['overview','identity','decentralised'],
          difficulty: 'beginner',
        },
      ],
    },
    de: {
      title:   'Protokoll-Grundlagen',
      summary: 'Kernarchitektur, Token-Modell und Netzwerkregeln von MIR.',
      modules: [
        {
          id: 'pf-001',
          heading: 'Was ist MIR?',
          body: 'MIR ist eine dezentralisierte, browsernative souveräne Intelligenzplattform ohne zentrale Server. Ihre Identität ist ein lokal generiertes kryptographisches Schlüsselpaar. Keine Kontowiederherstellung — Ihr privater Schlüssel IST Ihre Identität.',
          tags: ['overview','identity','decentralised'],
          difficulty: 'beginner',
        },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 2. SOVEREIGN OVERRIDE MECHANICS
  // ═══════════════════════════════════════════════════════════════════════
  sovereign_override: {
    en: {
      title:   'Sovereign Override Mechanics',
      summary: 'Admin terminal commands and Rule 0 authority system.',
      WARNING: 'SOVEREIGN COMMANDS HAVE IRREVERSIBLE CONSEQUENCES. The Admin private key grants absolute authority over all platform operations. Never share it. Never store it digitally without AES-256-GCM encryption.',
      modules: [
        {
          id: 'so-001',
          heading: 'Rule 0 — Sovereign Authority',
          body: 'The Sovereign Admin is identified solely by their ED25519 public key signature. This key holds supreme, unchallengeable authority. When a payload is signed by the Admin private key, it immediately preempts all autonomous logic, peer consensus, and state parameters across the entire network. SOVEREIGN_PRIORITY = Infinity in all CRDT merge operations.',
          tags: ['admin','sovereignty','rule0'],
          difficulty: 'advanced',
        },
        {
          id: 'so-002',
          heading: 'Admin Terminal — Command Reference',
          body: 'Access: Ctrl+Shift+A or ⬡ SOVEREIGN button.\n\napikey <key> — Set Anthropic API key (stored in localStorage only)\nsetwebhook twitter <url> — Register OSINT webhook\noverride <field> <value> — Override any DB field\nfreeze / unfreeze — Halt/resume all autonomous operations\nmint <pubkey> <amount> — Issue MIR to address\nburn <pubkey> <amount> — Destroy MIR from address\ndream — Engage Dream State consolidation\ngithubconfig <owner> <repo> <path> <token> — Configure sync\ngithubsync — Push DB snapshot to GitHub Gist\nstatus — Full system diagnostic\nreset CONFIRM — Emergency data purge',
          tags: ['terminal','commands','admin'],
          difficulty: 'advanced',
        },
        {
          id: 'so-003',
          heading: 'Scenario Probability Override',
          body: 'Command: override scenario_prob <value>|<title>\nSets a locked probability on a scenario. The AI agents cannot modify admin-overridden probabilities. The value is marked with adminOverride:true in the CRDT ledger. Ground Truth resolution (override scenario_resolve true|<title>) awards or deducts FRS from all participants.',
          tags: ['scenarios','override','ground-truth'],
          difficulty: 'advanced',
        },
        {
          id: 'so-004',
          heading: 'Emergency Kill-Switch',
          body: 'Command: reset CONFIRM\nExecutes total systemic deconstruction with literal fidelity. Clears all IndexedDB partitions, localStorage, sessionStorage, and active peer connections. This operation is PERMANENT and IRREVERSIBLE. All user data, balances, and CRDT state are destroyed. Use only in genuine emergency.',
          tags: ['emergency','reset','kill-switch'],
          difficulty: 'advanced',
        },
        {
          id: 'so-005',
          heading: 'Dream State Consolidation',
          body: 'Command: dream (or via terminal)\nFreezes the client UI and presents a data optimisation overlay. Filters STM noise, executes P2P training adaptations among the 3 AI agents, updates relationship matrices, and commits the optimised state back to the distributed CRDT pipeline. Duration: 10-30 seconds depending on data volume.',
          tags: ['dream','ai','consolidation'],
          difficulty: 'intermediate',
        },
      ],
    },
    fa: {
      title:   'مکانیک Override حاکمیتی',
      summary: 'دستورات ترمینال ادمین و سیستم اقتدار Rule 0.',
      WARNING: 'دستورات SOVEREIGN پیامدهای غیرقابل بازگشت دارند. کلید خصوصی ادمین اقتدار مطلق بر تمام عملیات پلتفرم اعطا می‌کند. هرگز آن را به اشتراک نگذارید.',
      modules: [
        {
          id: 'so-001',
          heading: 'Rule 0 — اقتدار حاکمیتی',
          body: 'ادمین حاکمیتی فقط با امضای کلید عمومی ED25519 شناسایی می‌شود. این کلید دارای اقتدار عالی و غیرقابل چالش است. وقتی یک پیلود با کلید خصوصی ادمین امضا می‌شود، فوراً تمام منطق خودمختار را نادیده می‌گیرد. SOVEREIGN_PRIORITY = Infinity در تمام عملیات CRDT.',
          tags: ['admin','sovereignty','rule0'],
          difficulty: 'advanced',
        },
        {
          id: 'so-002',
          heading: 'ترمینال ادمین — راهنمای دستورات',
          body: 'دسترسی: Ctrl+Shift+A یا دکمه ⬡ SOVEREIGN\n\napikey <key> — تنظیم کلید API آنتروپیک\noverride <field> <value> — Override هر فیلد DB\nfreeze / unfreeze — توقف/از سرگیری عملیات\nmint <pubkey> <amount> — صدور MIR\nburn <pubkey> <amount> — حذف MIR\ndream — اجرای Dream State\nreset CONFIRM — پاکسازی اضطراری داده',
          tags: ['terminal','commands','admin'],
          difficulty: 'advanced',
        },
      ],
    },
    ar: {
      title:   'ميكانيكا التجاوز السيادي',
      summary: 'أوامر Terminal الإدارة ونظام سلطة Rule 0.',
      WARNING: 'أوامر SOVEREIGN لها عواقب لا رجعة فيها. لا تشاركها أبداً.',
      modules: [
        {
          id: 'so-001',
          heading: 'Rule 0 — السلطة السيادية',
          body: 'يُحدَّد المشرف السيادي بتوقيع مفتاح ED25519 العام فقط. يمنح هذا المفتاح سلطة عليا لا تُطعن فيها. SOVEREIGN_PRIORITY = Infinity في جميع عمليات CRDT.',
          tags: ['admin','sovereignty','rule0'],
          difficulty: 'advanced',
        },
      ],
    },
    zh: {
      title:   '主权覆盖机制',
      summary: '管理员终端命令和Rule 0权限系统。',
      WARNING: '主权命令具有不可逆的后果。管理员私钥授予对所有平台操作的绝对权限。切勿分享。',
      modules: [
        {
          id: 'so-001',
          heading: 'Rule 0 — 主权权威',
          body: '主权管理员仅通过其ED25519公钥签名识别。该密钥拥有最高、不可挑战的权威。当管理员私钥签署载荷时，立即抢占所有自主逻辑。SOVEREIGN_PRIORITY = Infinity在所有CRDT合并操作中。',
          tags: ['admin','sovereignty','rule0'],
          difficulty: 'advanced',
        },
      ],
    },
    de: {
      title:   'Sovereign Override Mechanik',
      summary: 'Admin-Terminal-Befehle und Rule-0-Autoritätssystem.',
      WARNING: 'SOVEREIGN-Befehle haben irreversible Konsequenzen. Nie teilen.',
      modules: [
        {
          id: 'so-001',
          heading: 'Rule 0 — Souveräne Autorität',
          body: 'Der Sovereign Admin wird ausschließlich durch seine ED25519-Schlüsselsignatur identifiziert. Dieser Schlüssel hat höchste, unbestreitbare Autorität. SOVEREIGN_PRIORITY = Infinity in allen CRDT-Merge-Operationen.',
          tags: ['admin','sovereignty','rule0'],
          difficulty: 'advanced',
        },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 3. P2P OTC ESCROW
  // ═══════════════════════════════════════════════════════════════════════
  otc_escrow: {
    en: {
      title:   'P2P OTC Escrow Usage',
      summary: 'Peer-to-peer MIR trading with browser-native cryptographic escrow.',
      modules: [
        {
          id: 'otc-001',
          heading: 'How OTC Escrow Works',
          body: 'MIR OTC is a fully peer-to-peer trading system with no central exchange or gas fees. When you create a sell order, your MIR balance is locked in a browser-native cryptographic escrow. The escrow releases only upon confirmed buyer payment signature. All settlement is off-chain — payment confirmation happens outside MIR.',
          tags: ['otc','escrow','p2p','trading'],
          difficulty: 'intermediate',
        },
        {
          id: 'otc-002',
          heading: 'Creating a Sell Order',
          body: 'Navigate to OTC Market → SELL MIR.\n1. Enter amount (minimum 0.1 MIR)\n2. Set your price and currency (USD/EUR/USDT)\n3. Your private key signs the escrow lock transaction\n4. The order appears in the public order book\n5. Await buyer match\n\nYour balance is immediately locked. Cancel anytime before buyer confirms.',
          tags: ['sell','order','escrow'],
          difficulty: 'beginner',
        },
        {
          id: 'otc-003',
          heading: 'Creating a Buy Order',
          body: 'Navigate to OTC Market → BUY MIR.\n1. Select an existing sell order OR create a standing buy\n2. Agree on price with seller off-platform\n3. Complete payment off-chain (bank transfer, crypto, etc.)\n4. Return to MIR and confirm payment with your private key signature\n5. Seller confirms receipt — escrow releases MIR to your address automatically',
          tags: ['buy','order','confirmation'],
          difficulty: 'beginner',
        },
        {
          id: 'otc-004',
          heading: 'Fee Structure',
          body: 'Direct peer orders: 0% fee — fully free.\nAI-facilitated matching (automatic): 10% infrastructure fee → Network Rewards Pool.\nBurn tax does NOT apply to OTC transactions — only to upvotes.\n\nNOTE: MIR provides no financial advice. All trading decisions are solely the user\'s responsibility. Market prices are determined entirely by peer participants.',
          tags: ['fees','tax','network'],
          difficulty: 'intermediate',
        },
        {
          id: 'otc-005',
          heading: 'Dispute & Admin Cancellation',
          body: 'If a trade fails or counterparty is unresponsive, the Admin can cancel a locked escrow via Sovereign Terminal: override otc_cancel <order_id>. Funds return immediately to the seller\'s address. There is no automated dispute resolution — Admin intervention is the final mechanism.',
          tags: ['dispute','cancel','admin'],
          difficulty: 'intermediate',
        },
      ],
    },
    fa: {
      title:   'استفاده از Escrow OTC همتا به همتا',
      summary: 'معاملات MIR همتا به همتا با Escrow رمزنگاری بومی مرورگر.',
      modules: [
        {
          id: 'otc-001',
          heading: 'نحوه عملکرد Escrow OTC',
          body: 'OTC MIR یک سیستم معاملاتی کاملاً همتا به همتا بدون صرافی مرکزی یا کارمزد gas است. وقتی یک سفارش فروش ایجاد می‌کنید، موجودی MIR شما در یک Escrow رمزنگاری بومی مرورگر قفل می‌شود. Escrow فقط با تأیید امضای پرداخت خریدار آزاد می‌شود.',
          tags: ['otc','escrow','p2p','trading'],
          difficulty: 'intermediate',
        },
        {
          id: 'otc-002',
          heading: 'ایجاد سفارش فروش',
          body: 'بازار OTC → SELL MIR\n۱. مقدار را وارد کنید (حداقل ۰.۱ MIR)\n۲. قیمت و ارز را تنظیم کنید\n۳. کلید خصوصی شما تراکنش قفل Escrow را امضا می‌کند\n۴. سفارش در دفتر سفارش‌های عمومی ظاهر می‌شود\n۵. منتظر تطابق خریدار باشید',
          tags: ['sell','order','escrow'],
          difficulty: 'beginner',
        },
        {
          id: 'otc-004',
          heading: 'ساختار کارمزد',
          body: 'سفارش‌های مستقیم همتا: ۰٪ کارمزد — کاملاً رایگان.\nتطابق با واسطه AI: ۱۰٪ کارمزد زیرساخت → استخر پاداش شبکه.\n\nتوجه: MIR هیچ توصیه مالی ارائه نمی‌دهد. تمام تصمیمات معاملاتی کاملاً مسئولیت کاربر است.',
          tags: ['fees','tax','network'],
          difficulty: 'intermediate',
        },
      ],
    },
    ar: {
      title:   'استخدام ضمان OTC P2P',
      summary: 'تداول MIR بين الأقران مع ضمان تشفيري أصيل في المتصفح.',
      modules: [
        {
          id: 'otc-001',
          heading: 'كيف يعمل ضمان OTC',
          body: 'OTC MIR نظام تداول بين الأقران بدون بورصة مركزية أو رسوم غاز. عند إنشاء أمر بيع، يُقفل رصيد MIR في ضمان تشفيري أصيل بالمتصفح. يُحرَّر الضمان فقط بتأكيد توقيع دفع المشتري.',
          tags: ['otc','escrow','p2p'],
          difficulty: 'intermediate',
        },
      ],
    },
    zh: {
      title:   'P2P场外交易托管使用',
      summary: '使用浏览器原生加密托管进行点对点MIR交易。',
      modules: [
        {
          id: 'otc-001',
          heading: '场外交易托管如何运作',
          body: 'MIR场外交易是完全点对点的交易系统，无需中央交易所或gas费。创建卖单时，您的MIR余额锁定在浏览器原生加密托管中。只有在买方付款签名确认后，托管才会释放。',
          tags: ['otc','escrow','p2p'],
          difficulty: 'intermediate',
        },
      ],
    },
    de: {
      title:   'P2P OTC-Treuhand Nutzung',
      summary: 'Peer-to-Peer MIR-Handel mit browsernativem kryptographischen Treuhand.',
      modules: [
        {
          id: 'otc-001',
          heading: 'Wie OTC-Treuhand funktioniert',
          body: 'MIR OTC ist ein vollständig Peer-to-Peer-Handelssystem ohne zentrale Börse oder Gasgebühren. Beim Erstellen einer Verkaufsorder wird Ihr MIR-Guthaben in einem browsernativem Treuhand gesperrt. Es wird nur bei bestätigter Käufer-Zahlungssignatur freigegeben.',
          tags: ['otc','escrow','p2p'],
          difficulty: 'intermediate',
        },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 4. PoUW MINING GUIDELINES
  // ═══════════════════════════════════════════════════════════════════════
  pouw_mining: {
    en: {
      title:   'PoUW Mining Guidelines',
      summary: 'Proof-of-Useful-Work: 33-year browser mining over 11 halving epochs.',
      modules: [
        {
          id: 'pm-001',
          heading: 'What is Proof-of-Useful-Work?',
          body: 'PoUW is MIR\'s mining mechanism. Unlike Bitcoin\'s wasteful hash computation, PoUW validates CRDT state logs and processes semantic analytical metadata using SubtleCrypto SHA-256. Every mining cycle contributes genuine computational value to the network — validating peer data and maintaining ledger integrity.',
          tags: ['pouw','mining','sha256'],
          difficulty: 'beginner',
        },
        {
          id: 'pm-002',
          heading: 'Starting & Stopping Mining',
          body: 'Click ⬡ MINE in the navigation bar, or navigate to the Mining Dashboard.\nMining runs as a Web Worker in the background — your browser UI remains fully responsive.\nClick ⬡ MINE again or toggle the mining button to stop.\nMining auto-pauses when your tab is hidden (visibilitychange event) to preserve battery.',
          tags: ['start','stop','worker'],
          difficulty: 'beginner',
        },
        {
          id: 'pm-003',
          heading: '33-Year Halving Schedule',
          body: 'Total lifespan: 2025 → 2058 (33 years), 11 epochs of 3 years each.\n\nEpoch 1  (2025–2028): 0.50000000 MIR/block\nEpoch 2  (2028–2031): 0.25000000 MIR/block\nEpoch 3  (2031–2034): 0.12500000 MIR/block\nEpoch 4  (2034–2037): 0.06250000 MIR/block\nEpoch 5  (2037–2040): 0.03125000 MIR/block\nEpochs 6–11: continue halving until 2058.\n\nAll rewards come from the fixed supply of 2,100,000 MIR.',
          tags: ['halving','epoch','schedule','supply'],
          difficulty: 'intermediate',
        },
        {
          id: 'pm-004',
          heading: 'Mobile Battery Protection',
          body: 'MIR detects iOS/Safari and mobile environments. Mobile caps: max 3–5 seconds CPU per mining cycle. Auto-throttles to prevent thermal throttling and battery drain. The difficulty algorithm dynamically adjusts to keep cycle time within safe limits regardless of device capability.',
          tags: ['mobile','ios','battery','throttle'],
          difficulty: 'beginner',
        },
        {
          id: 'pm-005',
          heading: 'Sybil Resistance',
          body: 'If a node broadcasts anomalous transmission volumes, the local difficulty scales exponentially. This protects resource-constrained mobile nodes from network flooding attacks. The system detects IP-level or peer-ID anomalies and applies graduated penalties without requiring central coordination.',
          tags: ['sybil','difficulty','protection'],
          difficulty: 'advanced',
        },
        {
          id: 'pm-006',
          heading: 'Mining Rewards & Referral Routing',
          body: 'Standard block reward: credited directly to your public key address.\nIf you activated your node via a referral Access Key: 50% of your initial 3-second PoUW block rewards are automatically routed to the inviter\'s address as a peer incentive.\nValidation rewards: 50% to Network Rewards Pool, 50% to Admin infrastructure maintenance.',
          tags: ['rewards','referral','routing'],
          difficulty: 'intermediate',
        },
      ],
    },
    fa: {
      title:   'راهنمای استخراج PoUW',
      summary: 'اثبات کار مفید: استخراج مرورگری ۳۳ ساله در ۱۱ دوره نصف شدن.',
      modules: [
        {
          id: 'pm-001',
          heading: 'اثبات کار مفید چیست؟',
          body: 'PoUW مکانیزم استخراج MIR است. برخلاف محاسبات هش اتلاف‌کننده بیتکوین، PoUW لاگ‌های حالت CRDT را اعتبارسنجی کرده و متادیتای تحلیلی معنایی را با SubtleCrypto SHA-256 پردازش می‌کند.',
          tags: ['pouw','mining','sha256'],
          difficulty: 'beginner',
        },
        {
          id: 'pm-003',
          heading: 'برنامه نصف شدن ۳۳ ساله',
          body: 'طول عمر کل: ۲۰۲۵ → ۲۰۵۸ (۳۳ سال)، ۱۱ دوره ۳ ساله.\n\nدوره ۱ (۲۰۲۵–۲۰۲۸): ۰.۵۰۰۰۰۰۰۰ MIR/بلوک\nدوره ۲ (۲۰۲۸–۲۰۳۱): ۰.۲۵۰۰۰۰۰۰ MIR/بلوک\nدوره ۳ (۲۰۳۱–۲۰۳۴): ۰.۱۲۵۰۰۰۰۰ MIR/بلوک\nدوره ۴ (۲۰۳۴–۲۰۳۷): ۰.۰۶۲۵۰۰۰۰ MIR/بلوک\nدوره ۵ (۲۰۳۷–۲۰۴۰): ۰.۰۳۱۲۵۰۰۰ MIR/بلوک',
          tags: ['halving','epoch','schedule'],
          difficulty: 'intermediate',
        },
        {
          id: 'pm-004',
          heading: 'محافظت از باتری موبایل',
          body: 'MIR محیط‌های iOS/Safari و موبایل را تشخیص می‌دهد. حداکثر ۳–۵ ثانیه CPU در هر چرخه استخراج. به صورت خودکار throttle می‌کند تا از throttling حرارتی و تخلیه باتری جلوگیری شود.',
          tags: ['mobile','ios','battery'],
          difficulty: 'beginner',
        },
      ],
    },
    ar: {
      title:   'إرشادات تعدين PoUW',
      summary: 'إثبات العمل المفيد: تعدين المتصفح لمدة 33 عاماً عبر 11 حقبة تقليص.',
      modules: [
        {
          id: 'pm-001',
          heading: 'ما هو إثبات العمل المفيد؟',
          body: 'PoUW آلية تعدين MIR. على عكس حسابات التجزئة المُهدِرة لبيتكوين، يتحقق PoUW من سجلات حالة CRDT ويعالج البيانات الوصفية الدلالية باستخدام SubtleCrypto SHA-256.',
          tags: ['pouw','mining'],
          difficulty: 'beginner',
        },
      ],
    },
    zh: {
      title:   'PoUW挖矿指南',
      summary: '有用工作量证明：33年浏览器挖矿，11个减半周期。',
      modules: [
        {
          id: 'pm-001',
          heading: '什么是有用工作量证明？',
          body: 'PoUW是MIR的挖矿机制。与比特币浪费性哈希计算不同，PoUW使用SubtleCrypto SHA-256验证CRDT状态日志并处理语义分析元数据。',
          tags: ['pouw','mining'],
          difficulty: 'beginner',
        },
        {
          id: 'pm-003',
          heading: '33年减半时间表',
          body: '总寿命：2025→2058（33年），11个每3年一次的减半周期。\n\n第1周期(2025-2028): 0.50000000 MIR/块\n第2周期(2028-2031): 0.25000000 MIR/块\n第3周期(2031-2034): 0.12500000 MIR/块',
          tags: ['halving','epoch'],
          difficulty: 'intermediate',
        },
      ],
    },
    de: {
      title:   'PoUW Mining-Richtlinien',
      summary: 'Proof-of-Useful-Work: 33 Jahre Browser-Mining über 11 Halbierungsepochen.',
      modules: [
        {
          id: 'pm-001',
          heading: 'Was ist Proof-of-Useful-Work?',
          body: 'PoUW ist MIRs Mining-Mechanismus. Im Gegensatz zu Bitcoins verschwenderischer Hash-Berechnung validiert PoUW CRDT-Zustandsprotokolle und verarbeitet semantische Analysemetadaten mit SubtleCrypto SHA-256.',
          tags: ['pouw','mining'],
          difficulty: 'beginner',
        },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 5. STRATEGIC FORECASTING
  // ═══════════════════════════════════════════════════════════════════════
  strategic_forecasting: {
    en: {
      title:   'Strategic Forecasting & Scenarios',
      summary: 'Creating, voting, and resolving probability scenarios.',
      modules: [
        {
          id: 'sf-001',
          heading: 'Creating a Scenario',
          body: 'Navigate to Scenarios → + NEW SCENARIO.\nRequired fields:\n• Title: Clear, falsifiable statement\n• Description: Supporting analysis\n• Initial probability: 1–99%\n• Horizon: Days until resolution expected\n\nYour initial probability is weighted by your FRS in the consensus calculation.',
          tags: ['scenario','create','probability'],
          difficulty: 'beginner',
        },
        {
          id: 'sf-002',
          heading: 'AI Consensus Probability Engine',
          body: 'Three AI agents (Resident, Macro, Cyber, Geo) compute weighted probability estimates using 6D semantic weight matrices. The consensus is calculated via GPU-accelerated batch scoring (WebGPU or CPU fallback). Agent weights update continuously through Dream State consolidation cycles.',
          tags: ['ai','consensus','gpu','agents'],
          difficulty: 'advanced',
        },
        {
          id: 'sf-003',
          heading: 'Ground Truth Resolution',
          body: 'Only the Sovereign Admin can resolve a scenario as TRUE or FALSE.\nResolution effects:\n• Participants who predicted correctly gain FRS proportional to their stake\n• Participants who predicted incorrectly lose FRS proportional to divergence\n• Admin-overridden probabilities are immune to AI drift\n\nNOTE: MIR forecasts are analytical tools only. They are not financial advice.',
          tags: ['resolution','ground-truth','frs'],
          difficulty: 'intermediate',
        },
        {
          id: 'sf-004',
          heading: '6D Semantic Weight Matrix',
          body: 'Each AI agent maintains a 6-dimensional weight vector:\nDim 0: Geographic risk weighting\nDim 1: Economic macro-signal strength\nDim 2: Cyber threat vector sensitivity\nDim 3: Historical precedent alignment\nDim 4: Source credibility factor\nDim 5: Temporal urgency decay\n\nWeights update via EMA (Exponential Moving Average) during each mining cycle and Dream State.',
          tags: ['semantic','weights','6d','ema'],
          difficulty: 'advanced',
        },
      ],
    },
    fa: {
      title:   'پیش‌بینی استراتژیک و سناریوها',
      summary: 'ایجاد، رأی‌گیری و حل سناریوهای احتمالی.',
      modules: [
        {
          id: 'sf-001',
          heading: 'ایجاد سناریو',
          body: 'سناریوها → + NEW SCENARIO\nفیلدهای مورد نیاز:\n• عنوان: گزاره شفاف و قابل ابطال\n• توضیحات: تحلیل پشتیبان\n• احتمال اولیه: ۱–۹۹٪\n• افق: روزها تا انتظار حل شدن\n\nاحتمال اولیه شما با FRS شما در محاسبه اجماع وزن‌دهی می‌شود.',
          tags: ['scenario','create','probability'],
          difficulty: 'beginner',
        },
        {
          id: 'sf-003',
          heading: 'حل حقیقت زمینه',
          body: 'فقط ادمین حاکمیتی می‌تواند سناریو را TRUE یا FALSE حل کند.\nتوجه: پیش‌بینی‌های MIR فقط ابزارهای تحلیلی هستند. توصیه مالی نیستند.',
          tags: ['resolution','ground-truth','frs'],
          difficulty: 'intermediate',
        },
      ],
    },
    ar: {
      title:   'التنبؤ الاستراتيجي والسيناريوهات',
      summary: 'إنشاء وتصويت وحل سيناريوهات الاحتمالية.',
      modules: [
        {
          id: 'sf-001',
          heading: 'إنشاء سيناريو',
          body: 'السيناريوهات ← + NEW SCENARIO\nالحقول المطلوبة: عنوان واضح قابل للدحض، وصف، احتمالية أولية 1-99%، الأفق الزمني بالأيام.\n\nملاحظة: توقعات MIR أدوات تحليلية فقط. ليست نصائح مالية.',
          tags: ['scenario','create'],
          difficulty: 'beginner',
        },
      ],
    },
    zh: {
      title:   '战略预测与情景',
      summary: '创建、投票和解决概率情景。',
      modules: [
        {
          id: 'sf-001',
          heading: '创建情景',
          body: '导航至情景 → + NEW SCENARIO\n必填字段：清晰可证伪的标题、描述、初始概率(1-99%)、预计解决的天数。\n\n注意：MIR预测仅为分析工具，不构成财务建议。',
          tags: ['scenario','create'],
          difficulty: 'beginner',
        },
      ],
    },
    de: {
      title:   'Strategische Prognose & Szenarien',
      summary: 'Szenarien erstellen, abstimmen und auflösen.',
      modules: [
        {
          id: 'sf-001',
          heading: 'Szenario erstellen',
          body: 'Szenarien → + NEW SCENARIO\nPflichtfelder: Klare, falsifizierbare Aussage, Beschreibung, Anfangswahrscheinlichkeit 1–99%, Horizont in Tagen.\n\nHINWEIS: MIR-Prognosen sind ausschließlich Analysewerkzeuge. Keine Finanzberatung.',
          tags: ['scenario','create'],
          difficulty: 'beginner',
        },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 6. SOCIAL INTERACTION
  // ═══════════════════════════════════════════════════════════════════════
  social_interaction: {
    en: {
      title:   'Social Interaction — Intel & Voting',
      summary: 'Submitting intelligence, upvoting, and community mechanics.',
      modules: [
        {
          id: 'si-001',
          heading: 'Submitting Intelligence',
          body: 'Navigate to Feed → SUBMIT INTEL.\nFields: Headline, Analysis, Tags (comma-separated).\nCost: Free. Your item enters the global CRDT feed and is visible to all peers.\nFRS impact: Each upvote your item receives increases your FRS by a weighted delta.',
          tags: ['intel','submit','feed'],
          difficulty: 'beginner',
        },
        {
          id: 'si-002',
          heading: 'Upvote Mechanics',
          body: 'Cost: 1.00000000 MIR per upvote.\n2% burned (0.02 MIR) — permanent deflation.\n98% to creator (0.98 MIR).\n\nUpvote weight scales with your FRS:\nFRS 0–25: weight × 0.5\nFRS 26–50: weight × 1.0 (base)\nFRS 51–75: weight × 1.5\nFRS 76–100: weight × 2.0\n\nHigh-FRS users have disproportionate influence on consensus calculations.',
          tags: ['upvote','frs','weight','deflation'],
          difficulty: 'intermediate',
        },
        {
          id: 'si-003',
          heading: 'Shadowban System',
          body: 'The platform monitors interaction telemetry: input speed, micro-timing patterns, copy-paste behaviour. Profiles matching automated or non-human signatures are silently flagged with shadowbanned:true. Shadowbanned accounts see 100% success on all their actions, but the mesh synchronisation layer silently discards their payloads. This preserves ledger integrity without confrontation.',
          tags: ['shadowban','telemetry','quality'],
          difficulty: 'advanced',
        },
      ],
    },
    fa: {
      title:   'تعامل اجتماعی — اطلاعات و رأی‌دهی',
      summary: 'ارسال اطلاعات، رأی مثبت و مکانیک‌های جامعه.',
      modules: [
        {
          id: 'si-001',
          heading: 'ارسال اطلاعات',
          body: 'خوراک → SUBMIT INTEL\nفیلدها: عنوان، تحلیل، برچسب‌ها.\nهزینه: رایگان. آیتم شما وارد خوراک CRDT جهانی می‌شود.',
          tags: ['intel','submit','feed'],
          difficulty: 'beginner',
        },
        {
          id: 'si-002',
          heading: 'مکانیک رأی مثبت',
          body: 'هزینه: ۱.۰۰۰۰۰۰۰۰ MIR در هر رأی\n۲٪ سوزانده می‌شود (۰.۰۲ MIR)\n۹۸٪ به سازنده می‌رسد (۰.۹۸ MIR)\n\nوزن رأی با FRS مقیاس می‌شود:\nFRS 0–25: وزن × ۰.۵\nFRS 26–50: وزن × ۱.۰\nFRS 51–75: وزن × ۱.۵\nFRS 76–100: وزن × ۲.۰',
          tags: ['upvote','frs','weight'],
          difficulty: 'intermediate',
        },
      ],
    },
    ar: {
      title:   'التفاعل الاجتماعي — المعلومات والتصويت',
      summary: 'تقديم المعلومات والتصويت وميكانيكا المجتمع.',
      modules: [
        {
          id: 'si-001',
          heading: 'تقديم المعلومات',
          body: 'التغذية ← SUBMIT INTEL\nالحقول: العنوان، التحليل، العلامات.\nالتكلفة: مجانية.',
          tags: ['intel','submit'],
          difficulty: 'beginner',
        },
      ],
    },
    zh: {
      title:   '社交互动——情报与投票',
      summary: '提交情报、投票和社区机制。',
      modules: [
        {
          id: 'si-001',
          heading: '提交情报',
          body: '导航至动态 → SUBMIT INTEL\n字段：标题、分析、标签（逗号分隔）。费用：免费。',
          tags: ['intel','submit'],
          difficulty: 'beginner',
        },
      ],
    },
    de: {
      title:   'Soziale Interaktion — Intel & Abstimmung',
      summary: 'Geheimdienstbeiträge, Upvotes und Community-Mechaniken.',
      modules: [
        {
          id: 'si-001',
          heading: 'Intel einreichen',
          body: 'Feed → SUBMIT INTEL\nFelder: Headline, Analyse, Tags. Kostenlos.',
          tags: ['intel','submit'],
          difficulty: 'beginner',
        },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 7. PRIVATE KEY SECURITY
  // ═══════════════════════════════════════════════════════════════════════
  private_key_security: {
    en: {
      title: 'Private Key Security',
      WARNING: 'CRITICAL: Your private key is the ONLY way to access your MIR account. MIR is fully decentralised — there is NO password reset, NO customer support recovery, and NO exception. If you lose your private key, your account and ALL funds are PERMANENTLY and IRRECOVERABLY LOST. Never share it. Never store it in cloud services, email, or screenshots.',
      modules: [
        {
          id: 'pk-001',
          heading: 'Storing Your Private Key Safely',
          body: 'Recommended: Write it on paper and store in a physically secure location (safe, safety deposit box).\nSecure digital: Use MIR\'s built-in EXPORT BACKUP (AES-256-GCM encrypted .json file) with a strong password.\nNever: Cloud storage, email, messaging apps, screenshots, browser autofill, shared computers.',
          tags: ['storage','backup','security'],
          difficulty: 'beginner',
        },
        {
          id: 'pk-002',
          heading: 'Encrypted Backup Export',
          body: 'Navigate to Wallet → EXPORT or use HUD settings.\nEnter a strong backup password (min 8 chars, ideally 20+).\nDownload: MIR_IDENTITY_[TIMESTAMP].json\nFile contains: { pub, priv_encrypted, salt, iv, version } — private key is AES-256-GCM encrypted.\nThe file is safe to store in cloud services — decryption requires BOTH the file AND your password.',
          tags: ['backup','export','aes-gcm'],
          difficulty: 'beginner',
        },
      ],
    },
    fa: {
      title: 'امنیت کلید خصوصی',
      WARNING: 'هشدار حیاتی: کلید خصوصی شما تنها راه دسترسی به حساب MIR است. اگر آن را گم کنید، حساب و تمام وجوه برای همیشه از دست می‌روند. هرگز به اشتراک نگذارید.',
      modules: [
        {
          id: 'pk-001',
          heading: 'ذخیره امن کلید خصوصی',
          body: 'توصیه شده: روی کاغذ بنویسید در مکان امن.\nامن دیجیتال: از EXPORT BACKUP داخلی MIR (فایل .json رمزگذاری شده با AES-256-GCM) با رمز قوی استفاده کنید.\nهرگز: فضای ابری، ایمیل، برنامه‌های پیام‌رسان، اسکرین‌شات.',
          tags: ['storage','backup'],
          difficulty: 'beginner',
        },
      ],
    },
    ar: {
      title: 'أمان المفتاح الخاص',
      WARNING: 'تحذير حرج: مفتاحك الخاص هو السبيل الوحيد للوصول لحساب MIR. إذا فقدته، يضيع حسابك وجميع أموالك إلى الأبد. لا تشاركه أبداً.',
      modules: [
        {
          id: 'pk-001',
          heading: 'تخزين مفتاحك الخاص بأمان',
          body: 'الموصى به: اكتبه على ورق في مكان آمن.\nرقمي آمن: استخدم EXPORT BACKUP المدمج (ملف .json مشفر AES-256-GCM).\nلا تستخدم: التخزين السحابي، البريد الإلكتروني، تطبيقات المراسلة.',
          tags: ['storage','backup'],
          difficulty: 'beginner',
        },
      ],
    },
    zh: {
      title: '私钥安全',
      WARNING: '严重警告：您的私钥是访问MIR账户的唯一方式。如果丢失，您的账户和所有资金将永久且无法恢复地丢失。切勿分享。',
      modules: [
        {
          id: 'pk-001',
          heading: '安全存储私钥',
          body: '推荐：写在纸上存放在物理安全位置。\n安全数字：使用MIR内置EXPORT BACKUP（AES-256-GCM加密的.json文件）配合强密码。\n切勿：云存储、电子邮件、截图。',
          tags: ['storage','backup'],
          difficulty: 'beginner',
        },
      ],
    },
    de: {
      title: 'Sicherheit des privaten Schlüssels',
      WARNING: 'KRITISCH: Ihr privater Schlüssel ist der EINZIGE Zugang zu Ihrem MIR-Konto. Bei Verlust sind Konto und Guthaben DAUERHAFT verloren. Niemals teilen.',
      modules: [
        {
          id: 'pk-001',
          heading: 'Privaten Schlüssel sicher aufbewahren',
          body: 'Empfohlen: Auf Papier an sicherem Ort aufschreiben.\nSichere Digital-Option: EXPORT BACKUP (AES-256-GCM verschlüsselte .json-Datei).\nNie: Cloud-Speicher, E-Mail, Screenshots.',
          tags: ['storage','backup'],
          difficulty: 'beginner',
        },
      ],
    },
  },

};
