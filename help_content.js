/**
 * help_content.js
 * File Name:    help_content.js
 * Version:      1.0.0
 *
 * MIR Platform — Static Help Data
 * Pure data export — zero functions, zero logic, zero side-effects.
 * Lazy-loaded by support_agent.js only on user demand.
 */

'use strict';

export const HELP_DATA = {

  // ─────────────────────────────────────────────────────────────────────────
  // 1. DASHBOARD KEYS
  // ─────────────────────────────────────────────────────────────────────────
  dashboard_keys: {
    en: {
      title: 'Dashboard Navigation',
      summary: 'Keyboard shortcuts and HUD controls.',
      items: [
        { key: '⬡ SOVEREIGN',    desc: 'Open Admin Terminal (Rule 0 commands).' },
        { key: '⬡ MINE',         desc: 'Toggle PoUW mining engine on/off.' },
        { key: '◧ (sidebar)',     desc: 'Collapse/expand the left navigation panel.' },
        { key: 'Nav items',       desc: 'Feed · Scenarios · Predictions · Agents · Cognitive · Mining · OTC · Ledger · Leaderboard · Tokenomics.' },
        { key: 'SYNC NOW',        desc: 'Manually push current DB snapshot to GitHub Gist.' },
        { key: 'SUBMIT INTEL',    desc: 'Post a new intelligence item to the live feed.' },
        { key: 'Dream State',     desc: 'Freeze UI, consolidate agent memory, commit optimised state to ledger.' },
      ],
    },
    fa: {
      title: 'کلیدهای داشبورد',
      summary: 'میانبرهای صفحه‌کلید و کنترل‌های HUD.',
      items: [
        { key: '⬡ SOVEREIGN',    desc: 'باز کردن ترمینال ادمین (دستورات Rule 0).' },
        { key: '⬡ MINE',         desc: 'روشن/خاموش کردن موتور استخراج PoUW.' },
        { key: '◧ (نوار کناری)',  desc: 'پنهان/نمایش پنل ناوبری چپ.' },
        { key: 'آیتم‌های ناوبری', desc: 'خوراک · سناریوها · پیش‌بینی‌ها · عوامل · شناختی · استخراج · OTC · دفتر کل · رتبه‌بندی · توکنومیکس.' },
        { key: 'SYNC NOW',        desc: 'ارسال دستی اسنپ‌شات پایگاه داده به GitHub Gist.' },
        { key: 'SUBMIT INTEL',    desc: 'ارسال یک آیتم اطلاعاتی جدید به خوراک زنده.' },
        { key: 'Dream State',     desc: 'انجماد UI، یکپارچه‌سازی حافظه عامل، ثبت حالت بهینه در دفتر کل.' },
      ],
    },
    ar: {
      title: 'مفاتيح لوحة التحكم',
      summary: 'اختصارات لوحة المفاتيح وعناصر التحكم في HUD.',
      items: [
        { key: '⬡ SOVEREIGN',    desc: 'فتح Terminal الإدارة (أوامر Rule 0).' },
        { key: '⬡ MINE',         desc: 'تشغيل/إيقاف محرك التعدين PoUW.' },
        { key: '◧ (الشريط الجانبي)', desc: 'طي/توسيع لوحة التنقل اليسرى.' },
        { key: 'عناصر التنقل',    desc: 'التغذية · السيناريوهات · التنبؤات · العوامل · المعرفية · التعدين · OTC · السجل · المتصدرون · Tokenomics.' },
        { key: 'SYNC NOW',        desc: 'دفع لقطة قاعدة البيانات يدوياً إلى GitHub Gist.' },
        { key: 'SUBMIT INTEL',    desc: 'نشر عنصر معلومات جديد في التغذية الحية.' },
        { key: 'Dream State',     desc: 'تجميد واجهة المستخدم وتوحيد ذاكرة الوكيل وحفظ الحالة المحسّنة.' },
      ],
    },
    zh: {
      title: '仪表板快捷键',
      summary: '键盘快捷键和HUD控件。',
      items: [
        { key: '⬡ SOVEREIGN',    desc: '打开管理员终端（Rule 0 命令）。' },
        { key: '⬡ MINE',         desc: '开启/关闭 PoUW 挖矿引擎。' },
        { key: '◧（侧边栏）',    desc: '折叠/展开左侧导航面板。' },
        { key: '导航项',          desc: '动态情报 · 情景 · 预测 · AI代理 · 认知 · 挖矿 · 场外交易 · 账本 · 排行榜 · 代币经济。' },
        { key: 'SYNC NOW',        desc: '手动将数据库快照推送到 GitHub Gist。' },
        { key: 'SUBMIT INTEL',    desc: '向实时信息流发布新情报项目。' },
        { key: 'Dream State',     desc: '冻结界面，整合代理记忆，将优化状态提交至账本。' },
      ],
    },
    de: {
      title: 'Dashboard-Tasten',
      summary: 'Tastenkürzel und HUD-Steuerelemente.',
      items: [
        { key: '⬡ SOVEREIGN',    desc: 'Admin-Terminal öffnen (Rule-0-Befehle).' },
        { key: '⬡ MINE',         desc: 'PoUW-Mining-Engine ein-/ausschalten.' },
        { key: '◧ (Seitenleiste)',desc: 'Linkes Navigationspanel ein-/ausblenden.' },
        { key: 'Navigationspunkte', desc: 'Feed · Szenarien · Prognosen · Agenten · Kognitiv · Mining · OTC · Hauptbuch · Bestenliste · Tokenomics.' },
        { key: 'SYNC NOW',        desc: 'DB-Snapshot manuell zu GitHub Gist übertragen.' },
        { key: 'SUBMIT INTEL',    desc: 'Neues Geheimdienstitem im Live-Feed posten.' },
        { key: 'Dream State',     desc: 'UI einfrieren, Agentenspeicher konsolidieren, optimierten Zustand ins Ledger schreiben.' },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. REGISTRATION
  // ─────────────────────────────────────────────────────────────────────────
  registration: {
    en: {
      title: 'Registration & Identity',
      summary: 'How to create your sovereign identity on MIR.',
      items: [
        { q: 'How do I register?',        a: 'Click the key icon → REGISTER. Choose a username, then click GENERATE KEYPAIR. Save both keys before submitting.' },
        { q: 'What is the welcome bonus?', a: '+10.00000000 MIR is credited automatically on first registration.' },
        { q: 'Can I have multiple accounts?', a: 'Each ED25519 key pair is a unique sovereign identity. Multiple accounts share the same network pool.' },
        { q: 'Lost my keys — can I recover?', a: 'No. MIR is fully decentralised. There is no password reset. Your private key IS your identity.' },
      ],
    },
    fa: {
      title: 'ثبت‌نام و هویت',
      summary: 'نحوه ایجاد هویت حاکمیتی در MIR.',
      items: [
        { q: 'چگونه ثبت‌نام کنم؟',        a: 'روی آیکون کلید کلیک کنید → REGISTER. نام کاربری انتخاب کنید، سپس GENERATE KEYPAIR را بزنید. قبل از ارسال هر دو کلید را ذخیره کنید.' },
        { q: 'پاداش خوش‌آمد چیست؟',      a: '+10.00000000 MIR به صورت خودکار در اولین ثبت‌نام اعتبار داده می‌شود.' },
        { q: 'آیا می‌توانم چند حساب داشته باشم؟', a: 'هر جفت کلید ED25519 یک هویت حاکمیتی منحصر به فرد است.' },
        { q: 'کلیدهایم را گم کردم — می‌توانم بازیابی کنم؟', a: 'خیر. MIR کاملاً غیرمتمرکز است. بازنشانی رمز عبور وجود ندارد. کلید خصوصی شما هویت شماست.' },
      ],
    },
    ar: {
      title: 'التسجيل والهوية',
      summary: 'كيفية إنشاء هويتك السيادية على MIR.',
      items: [
        { q: 'كيف أسجّل؟',              a: 'انقر على أيقونة المفتاح ← REGISTER. اختر اسم مستخدم ثم انقر GENERATE KEYPAIR. احفظ كلا المفتاحين قبل الإرسال.' },
        { q: 'ما هو مكافأة الترحيب؟',   a: 'يُضاف +10.00000000 MIR تلقائياً عند التسجيل الأول.' },
        { q: 'هل يمكنني امتلاك حسابات متعددة؟', a: 'كل زوج مفاتيح ED25519 هو هوية سيادية فريدة.' },
        { q: 'فقدتُ مفاتيحي — هل يمكنني الاسترداد؟', a: 'لا. MIR لامركزي بالكامل. لا يوجد إعادة تعيين كلمة المرور. مفتاحك الخاص هو هويتك.' },
      ],
    },
    zh: {
      title: '注册与身份',
      summary: '如何在 MIR 上创建您的主权身份。',
      items: [
        { q: '如何注册？',              a: '点击钥匙图标 → REGISTER。选择用户名，然后点击 GENERATE KEYPAIR。提交前保存两个密钥。' },
        { q: '欢迎奖励是什么？',        a: '首次注册时自动获得 +10.00000000 MIR。' },
        { q: '我可以拥有多个账户吗？',  a: '每个 ED25519 密钥对都是唯一的主权身份。' },
        { q: '丢失了密钥——能恢复吗？',  a: '不能。MIR 完全去中心化，没有密码重置。您的私钥就是您的身份。' },
      ],
    },
    de: {
      title: 'Registrierung & Identität',
      summary: 'So erstellen Sie Ihre souveräne Identität auf MIR.',
      items: [
        { q: 'Wie registriere ich mich?',  a: 'Schlüsselsymbol anklicken → REGISTER. Benutzernamen wählen, dann GENERATE KEYPAIR klicken. Beide Schlüssel vor dem Absenden speichern.' },
        { q: 'Was ist der Willkommensbonus?', a: '+10.00000000 MIR wird bei der ersten Registrierung automatisch gutgeschrieben.' },
        { q: 'Kann ich mehrere Konten haben?', a: 'Jedes ED25519-Schlüsselpaar ist eine einzigartige souveräne Identität.' },
        { q: 'Schlüssel verloren — Wiederherstellung möglich?', a: 'Nein. MIR ist vollständig dezentralisiert. Kein Passwort-Reset. Ihr privater Schlüssel IST Ihre Identität.' },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. COMMENTING / INTEL SUBMISSION
  // ─────────────────────────────────────────────────────────────────────────
  commenting: {
    en: {
      title: 'Intel Submission & Upvotes',
      summary: 'Contribute intelligence items and earn FRS.',
      items: [
        { q: 'How do I submit intel?',    a: 'Click SUBMIT INTEL. Fill in Headline, Analysis, and Tags. Costs 0 MIR; boosts your FRS if upvoted.' },
        { q: 'How do upvotes work?',      a: 'Each upvote costs 1.00000000 MIR. 2% is burned (deflationary). 98% goes to the content creator.' },
        { q: 'What is FRS?',              a: 'Forecaster Reputation Score (0–100). Higher FRS increases your upvote weight and platform influence.' },
        { q: 'Can I be shadowbanned?',    a: 'Automated or bot-like submission patterns are silently flagged. Human-paced natural interaction is always safe.' },
      ],
    },
    fa: {
      title: 'ارسال اطلاعات و رأی مثبت',
      summary: 'مشارکت در اطلاعات و کسب FRS.',
      items: [
        { q: 'چگونه اطلاعات ارسال کنم؟', a: 'SUBMIT INTEL را بزنید. عنوان، تحلیل و برچسب‌ها را پر کنید. هزینه‌ای ندارد؛ اگر رأی بگیرید FRS شما افزایش می‌یابد.' },
        { q: 'رأی مثبت چگونه کار می‌کند؟', a: 'هر رأی ۱.۰۰۰۰۰۰۰۰ MIR هزینه دارد. ۲٪ سوزانده می‌شود. ۹۸٪ به سازنده محتوا می‌رسد.' },
        { q: 'FRS چیست؟',              a: 'امتیاز شهرت پیش‌بین (۰–۱۰۰). FRS بالاتر وزن رأی و نفوذ شما را افزایش می‌دهد.' },
        { q: 'آیا می‌توانم shadowban شوم؟', a: 'الگوهای ارسال خودکار یا ربات‌مانند بی‌صدا علامت‌گذاری می‌شوند. تعامل طبیعی به سرعت انسانی همیشه امن است.' },
      ],
    },
    ar: {
      title: 'تقديم المعلومات والتصويت',
      summary: 'ساهم بعناصر المعلومات واكسب FRS.',
      items: [
        { q: 'كيف أقدّم معلومات؟',      a: 'انقر SUBMIT INTEL. أدخل العنوان والتحليل والعلامات. لا تكلفة؛ يُعزَّز FRS عند التصويت لصالحك.' },
        { q: 'كيف يعمل التصويت؟',       a: 'كل تصويت يكلف 1.00000000 MIR. 2% يُحرق. 98% يذهب لصاحب المحتوى.' },
        { q: 'ما هو FRS؟',              a: 'نقاط سمعة المتنبئ (0–100). كلما ارتفع FRS زاد وزن تصويتك وتأثيرك.' },
        { q: 'هل يمكنني أن أُحظر بصمت؟', a: 'أنماط الإرسال الآلية تُعلَّم بصمت. التفاعل الطبيعي البشري آمن دائماً.' },
      ],
    },
    zh: {
      title: '情报提交与投票',
      summary: '贡献情报项目并赚取 FRS。',
      items: [
        { q: '如何提交情报？',           a: '点击 SUBMIT INTEL。填写标题、分析和标签。免费提交；获得投票后 FRS 增加。' },
        { q: '投票如何运作？',           a: '每次投票花费 1.00000000 MIR。2% 被销毁。98% 归内容创作者。' },
        { q: '什么是 FRS？',             a: '预测者声誉分数（0–100）。FRS 越高，投票权重和平台影响力越大。' },
        { q: '我会被隐形封禁吗？',       a: '自动化或机器人式提交模式会被静默标记。以自然人类节奏互动始终安全。' },
      ],
    },
    de: {
      title: 'Intel-Einreichung & Upvotes',
      summary: 'Geheimdienstbeiträge leisten und FRS verdienen.',
      items: [
        { q: 'Wie reiche ich Intel ein?',  a: 'SUBMIT INTEL anklicken. Headline, Analyse und Tags ausfüllen. Kostenlos; FRS steigt bei Upvotes.' },
        { q: 'Wie funktionieren Upvotes?', a: 'Jeder Upvote kostet 1.00000000 MIR. 2% wird verbrannt. 98% geht an den Content-Ersteller.' },
        { q: 'Was ist FRS?',               a: 'Forecaster Reputation Score (0–100). Höherer FRS erhöht Ihr Upvote-Gewicht und Ihren Einfluss.' },
        { q: 'Kann ich shadowgebannt werden?', a: 'Automatisierte Einreichungsmuster werden still markiert. Natürliche menschliche Interaktion ist immer sicher.' },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. PoUW MINING
  // ─────────────────────────────────────────────────────────────────────────
  pouw_mining: {
    en: {
      title: 'PoUW Mining',
      summary: 'Browser-based Proof-of-Useful-Work mining over 33 years.',
      items: [
        { q: 'How do I start mining?',    a: 'Click ⬡ MINE or navigate to Mining Dashboard → START MINING. No setup required.' },
        { q: 'What is PoUW?',             a: 'Proof-of-Useful-Work: your browser validates CRDT state logs and processes semantic metadata using SubtleCrypto SHA-256.' },
        { q: 'Will mining drain my battery?', a: 'No. Mobile devices are capped at 5 seconds per cycle and auto-pause when the tab is hidden.' },
        { q: 'How long does mining last?', a: '33-year lifecycle (2025–2058) across 11 halving epochs of 3 years each. Base reward: 0.5 MIR per block.' },
        { q: 'What is the halving schedule?', a: 'Block reward halves every 3 years. Epoch 1 (2025–2028): 0.5 MIR. Epoch 2: 0.25 MIR. And so on.' },
        { q: 'What is Sybil defence?',    a: 'Difficulty scales exponentially if a node submits anomalous volumes, protecting other miners.' },
      ],
    },
    fa: {
      title: 'استخراج PoUW',
      summary: 'استخراج مبتنی بر مرورگر در طول ۳۳ سال.',
      items: [
        { q: 'چگونه شروع به استخراج کنم؟', a: '⬡ MINE را بزنید یا به داشبورد استخراج بروید → START MINING. نیازی به تنظیم نیست.' },
        { q: 'PoUW چیست؟',              a: 'اثبات کار مفید: مرورگر شما لاگ‌های حالت CRDT را تأیید می‌کند و متادیتای معنایی را با SubtleCrypto SHA-256 پردازش می‌کند.' },
        { q: 'آیا استخراج باتری را تخلیه می‌کند؟', a: 'خیر. دستگاه‌های موبایل حداکثر ۵ ثانیه در هر چرخه دارند و هنگام مخفی بودن تب به صورت خودکار متوقف می‌شوند.' },
        { q: 'استخراج چقدر طول می‌کشد؟', a: 'چرخه عمر ۳۳ ساله (۲۰۲۵–۲۰۵۸) در ۱۱ دوره نصف شدن هر ۳ سال. پاداش پایه: ۰.۵ MIR در هر بلوک.' },
        { q: 'برنامه نصف شدن چیست؟',   a: 'پاداش بلوک هر ۳ سال نصف می‌شود. دوره ۱ (۲۰۲۵–۲۰۲۸): ۰.۵ MIR. دوره ۲: ۰.۲۵ MIR.' },
        { q: 'دفاع Sybil چیست؟',        a: 'سختی به صورت نمایی افزایش می‌یابد اگر یک گره حجم‌های غیرعادی ارسال کند.' },
      ],
    },
    ar: {
      title: 'تعدين PoUW',
      summary: 'تعدين قائم على المتصفح على مدى 33 عاماً.',
      items: [
        { q: 'كيف أبدأ التعدين؟',       a: 'انقر ⬡ MINE أو انتقل إلى لوحة التعدين ← START MINING. لا يلزم أي إعداد.' },
        { q: 'ما هو PoUW؟',             a: 'إثبات العمل المفيد: يتحقق متصفحك من سجلات حالة CRDT ويعالج بيانات وصفية دلالية باستخدام SubtleCrypto SHA-256.' },
        { q: 'هل يستنزف التعدين البطارية؟', a: 'لا. الأجهزة المحمولة محدودة بـ 5 ثوانٍ لكل دورة وتتوقف تلقائياً عند إخفاء التبويب.' },
        { q: 'كم يستمر التعدين؟',       a: 'دورة حياة 33 عاماً (2025–2058) عبر 11 حقبة تقليص كل 3 سنوات. المكافأة الأساسية: 0.5 MIR لكل كتلة.' },
        { q: 'ما جدول التقليص؟',        a: 'تنخفض مكافأة الكتلة إلى النصف كل 3 سنوات. الحقبة 1: 0.5 MIR. الحقبة 2: 0.25 MIR.' },
        { q: 'ما هو دفاع Sybil؟',       a: 'تتصاعد الصعوبة أسياً إذا أرسلت عقدة أحجاماً غير طبيعية، مما يحمي المعدنين الآخرين.' },
      ],
    },
    zh: {
      title: 'PoUW 挖矿',
      summary: '基于浏览器的33年有用工作量证明挖矿。',
      items: [
        { q: '如何开始挖矿？',           a: '点击 ⬡ MINE 或导航到挖矿仪表板 → START MINING。无需设置。' },
        { q: '什么是 PoUW？',            a: '有用工作量证明：您的浏览器使用 SubtleCrypto SHA-256 验证 CRDT 状态日志并处理语义元数据。' },
        { q: '挖矿会耗尽电池吗？',       a: '不会。移动设备每次循环最多5秒，标签页隐藏时自动暂停。' },
        { q: '挖矿持续多久？',           a: '33年生命周期（2025–2058），共11个每3年一次的减半周期。基础奖励：每块0.5 MIR。' },
        { q: '减半时间表是什么？',       a: '区块奖励每3年减半。第1周期（2025–2028）：0.5 MIR。第2周期：0.25 MIR。' },
        { q: '什么是女巫防御？',         a: '如果节点提交异常量，难度呈指数增长，保护其他矿工。' },
      ],
    },
    de: {
      title: 'PoUW-Mining',
      summary: 'Browser-basiertes Mining über 33 Jahre.',
      items: [
        { q: 'Wie starte ich das Mining?', a: '⬡ MINE anklicken oder zum Mining-Dashboard → START MINING navigieren. Keine Einrichtung nötig.' },
        { q: 'Was ist PoUW?',              a: 'Proof-of-Useful-Work: Ihr Browser validiert CRDT-Zustandsprotokolle und verarbeitet semantische Metadaten mit SubtleCrypto SHA-256.' },
        { q: 'Entleert Mining den Akku?',  a: 'Nein. Mobile Geräte sind auf 5 Sekunden pro Zyklus begrenzt und pausieren automatisch bei verstecktem Tab.' },
        { q: 'Wie lange dauert Mining?',   a: '33-Jahres-Lebenszyklus (2025–2058) über 11 Halbierungsepochen je 3 Jahre. Basisbelohnung: 0,5 MIR pro Block.' },
        { q: 'Was ist der Halbierungsplan?', a: 'Blockbelohnung halbiert sich alle 3 Jahre. Epoche 1: 0,5 MIR. Epoche 2: 0,25 MIR.' },
        { q: 'Was ist Sybil-Abwehr?',      a: 'Schwierigkeit skaliert exponentiell bei anomalen Übertragungsmengen.' },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. TRADING / OTC
  // ─────────────────────────────────────────────────────────────────────────
  trading: {
    en: {
      title: 'OTC Trading & Escrow',
      summary: 'Peer-to-peer MIR trading with cryptographic escrow.',
      items: [
        { q: 'How do I sell MIR?',        a: 'OTC Market → SELL MIR. Enter amount and price. Your balance is locked in cryptographic escrow until the buyer confirms payment.' },
        { q: 'How do I buy MIR?',         a: 'OTC Market → BUY MIR. Place a buy order. Match with a seller and confirm off-chain payment.' },
        { q: 'What is the trading fee?',  a: '10% platform fee on AI-facilitated orders routes to the Network Rewards Pool. Peer-direct orders: no fee.' },
        { q: 'Is there a gas fee?',       a: 'No. MIR runs serverless on a P2P mesh. All escrow is browser-native with no blockchain gas.' },
        { q: 'What if a trade fails?',    a: 'Admin can cancel a locked escrow order via the Sovereign Terminal. Funds return immediately.' },
      ],
    },
    fa: {
      title: 'معاملات OTC و امانت',
      summary: 'معاملات MIR به صورت همتا به همتا با امانت رمزنگاری‌شده.',
      items: [
        { q: 'چگونه MIR بفروشم؟',       a: 'بازار OTC → SELL MIR. مقدار و قیمت را وارد کنید. موجودی شما در امانت رمزنگاری‌شده قفل می‌شود تا خریدار پرداخت را تأیید کند.' },
        { q: 'چگونه MIR بخرم؟',         a: 'بازار OTC → BUY MIR. یک سفارش خرید ثبت کنید. با فروشنده مطابقت دهید و پرداخت خارج از زنجیره را تأیید کنید.' },
        { q: 'کارمزد معامله چقدر است؟',  a: 'کارمزد ۱۰٪ پلتفرم برای سفارش‌های تسهیل‌شده با AI به استخر پاداش شبکه می‌رود. سفارش‌های مستقیم همتا به همتا: بدون کارمزد.' },
        { q: 'آیا کارمزد گس وجود دارد؟', a: 'خیر. MIR روی یک مش P2P بدون سرور اجرا می‌شود. بدون کارمزد بلاکچین.' },
        { q: 'اگر معامله ناموفق باشد؟',  a: 'ادمین می‌تواند یک سفارش امانت قفل شده را از طریق ترمینال حاکمیتی لغو کند. وجوه فوراً بازمی‌گردند.' },
      ],
    },
    ar: {
      title: 'تداول OTC والضمان',
      summary: 'تداول MIR بين الأقران مع ضمان تشفيري.',
      items: [
        { q: 'كيف أبيع MIR؟',           a: 'سوق OTC ← SELL MIR. أدخل الكمية والسعر. يُقفل رصيدك في ضمان تشفيري حتى يؤكد المشتري الدفع.' },
        { q: 'كيف أشتري MIR؟',          a: 'سوق OTC ← BUY MIR. ضع أمر شراء. طابق مع بائع وأكّد الدفع خارج السلسلة.' },
        { q: 'ما رسوم التداول؟',        a: '10% رسوم للمنصة على الأوامر بتسهيل الذكاء الاصطناعي تذهب لمجمع المكافآت. الأوامر المباشرة: بلا رسوم.' },
        { q: 'هل توجد رسوم غاز؟',       a: 'لا. MIR يعمل بلا خادم على شبكة P2P. لا رسوم بلوكشين.' },
        { q: 'ماذا لو فشلت الصفقة؟',   a: 'يستطيع المشرف إلغاء أمر ضمان مقفل عبر Terminal السيادي. تعود الأموال فوراً.' },
      ],
    },
    zh: {
      title: '场外交易与托管',
      summary: '点对点 MIR 交易，采用加密托管。',
      items: [
        { q: '如何出售 MIR？',           a: '场外市场 → SELL MIR。输入数量和价格。您的余额将锁定在加密托管中，直到买方确认付款。' },
        { q: '如何购买 MIR？',           a: '场外市场 → BUY MIR。下买单。与卖家匹配并确认链下付款。' },
        { q: '交易费用是多少？',         a: 'AI 协助订单的平台费为10%，归入网络奖励池。点对点直接订单：无费用。' },
        { q: '有 gas 费吗？',            a: '没有。MIR 在 P2P 网格上无服务器运行。没有区块链 gas 费。' },
        { q: '如果交易失败怎么办？',     a: '管理员可通过主权终端取消锁定的托管订单。资金立即返还。' },
      ],
    },
    de: {
      title: 'OTC-Handel & Treuhand',
      summary: 'Peer-to-Peer-MIR-Handel mit kryptografischem Treuhand.',
      items: [
        { q: 'Wie verkaufe ich MIR?',     a: 'OTC-Markt → SELL MIR. Betrag und Preis eingeben. Ihr Guthaben wird in kryptografischem Treuhand gesperrt.' },
        { q: 'Wie kaufe ich MIR?',        a: 'OTC-Markt → BUY MIR. Kaufauftrag platzieren. Mit Verkäufer abgleichen und Off-Chain-Zahlung bestätigen.' },
        { q: 'Wie hoch sind die Handelsgebühren?', a: '10% Plattformgebühr für KI-vermittelte Aufträge geht in den Network Rewards Pool. Direkte Peer-Aufträge: keine Gebühr.' },
        { q: 'Gibt es Gas-Gebühren?',     a: 'Nein. MIR läuft serverlos auf einem P2P-Mesh ohne Blockchain-Gas.' },
        { q: 'Was wenn ein Trade scheitert?', a: 'Admin kann gesperrte Treuhandaufträge über das Sovereign Terminal stornieren. Gelder kehren sofort zurück.' },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 6. CHARTING / SCENARIOS
  // ─────────────────────────────────────────────────────────────────────────
  charting: {
    en: {
      title: 'Scenarios & Charting',
      summary: 'Create, vote, and resolve probability scenarios.',
      items: [
        { q: 'How do I create a scenario?', a: 'Scenarios tab → + NEW SCENARIO. Enter title, description, initial probability, and horizon (days).' },
        { q: 'How is consensus probability calculated?', a: 'The 3 AI agents weight-vote using their FRS scores and 6D semantic matrices. GPU-accelerated batch scoring.' },
        { q: 'Can admin override probability?', a: 'Yes. The Sovereign Terminal command "override scenario_prob [value]|[title]" sets a locked probability.' },
        { q: 'How does Ground Truth resolution work?', a: 'Admin resolves a scenario as TRUE or FALSE. Accounts that predicted correctly gain FRS; others lose FRS.' },
      ],
    },
    fa: {
      title: 'سناریوها و نمودارها',
      summary: 'ایجاد، رأی‌گیری و حل سناریوهای احتمالی.',
      items: [
        { q: 'چگونه سناریو ایجاد کنم؟',  a: 'تب سناریوها → + NEW SCENARIO. عنوان، توضیحات، احتمال اولیه و افق (روزها) را وارد کنید.' },
        { q: 'احتمال اجماع چگونه محاسبه می‌شود؟', a: '۳ عامل AI با استفاده از امتیازات FRS و ماتریس‌های معنایی ۶ بعدی رأی وزنی می‌دهند. امتیازدهی دسته‌ای شتاب‌یافته با GPU.' },
        { q: 'آیا ادمین می‌تواند احتمال را override کند؟', a: 'بله. دستور ترمینال حاکمیتی "override scenario_prob [value]|[title]" یک احتمال قفل شده تنظیم می‌کند.' },
        { q: 'حل حقیقت زمینه چگونه کار می‌کند؟', a: 'ادمین یک سناریو را TRUE یا FALSE حل می‌کند. حساب‌هایی که درست پیش‌بینی کرده‌اند FRS می‌گیرند.' },
      ],
    },
    ar: {
      title: 'السيناريوهات والرسوم البيانية',
      summary: 'إنشاء سيناريوهات الاحتمالية والتصويت وحلها.',
      items: [
        { q: 'كيف أنشئ سيناريو؟',       a: 'تبويب السيناريوهات ← + NEW SCENARIO. أدخل العنوان والوصف والاحتمال الأولي والأفق.' },
        { q: 'كيف تُحسب احتمالية الإجماع؟', a: 'يُصوّت 3 وكلاء AI بأوزان باستخدام درجات FRS ومصفوفات دلالية 6 أبعاد. تسجيل دفعة مسرّعة بـ GPU.' },
        { q: 'هل يستطيع المشرف تجاوز الاحتمالية؟', a: 'نعم. أمر Terminal "override scenario_prob [value]|[title]" يضبط احتمالية مقفولة.' },
        { q: 'كيف تعمل الحل بالحقيقة الأرضية؟', a: 'يحلّ المشرف السيناريو TRUE أو FALSE. الحسابات التي تنبأت بصحة تكسب FRS.' },
      ],
    },
    zh: {
      title: '情景与图表',
      summary: '创建、投票并解决概率情景。',
      items: [
        { q: '如何创建情景？',           a: '情景标签 → + NEW SCENARIO。输入标题、描述、初始概率和时间跨度（天）。' },
        { q: '共识概率如何计算？',       a: '3个AI代理使用FRS分数和6D语义矩阵进行加权投票。GPU加速批量评分。' },
        { q: '管理员可以覆盖概率吗？',   a: '可以。主权终端命令 "override scenario_prob [值]|[标题]" 设置锁定概率。' },
        { q: '地面真相解决如何运作？',   a: '管理员将情景解决为 TRUE 或 FALSE。预测正确的账户获得 FRS；其他则失去。' },
      ],
    },
    de: {
      title: 'Szenarien & Diagramme',
      summary: 'Wahrscheinlichkeitsszenarien erstellen, abstimmen und lösen.',
      items: [
        { q: 'Wie erstelle ich ein Szenario?', a: 'Szenarien-Tab → + NEW SCENARIO. Titel, Beschreibung, Anfangswahrscheinlichkeit und Horizont eingeben.' },
        { q: 'Wie wird Konsenswahrscheinlichkeit berechnet?', a: '3 KI-Agenten wählen gewichtet mit FRS-Scores und 6D-Matrizen. GPU-beschleunigte Batch-Bewertung.' },
        { q: 'Kann Admin die Wahrscheinlichkeit überschreiben?', a: 'Ja. Sovereign-Terminal-Befehl "override scenario_prob [Wert]|[Titel]" setzt gesperrte Wahrscheinlichkeit.' },
        { q: 'Wie funktioniert Ground-Truth-Auflösung?', a: 'Admin löst Szenario als TRUE oder FALSE auf. Richtig vorhersagende Konten gewinnen FRS.' },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 7. SUPPORT
  // ─────────────────────────────────────────────────────────────────────────
  support: {
    en: {
      title: 'Platform Support',
      summary: 'Troubleshooting common issues.',
      items: [
        { q: 'Site not loading?',          a: 'Check DevTools Console (F12). If you see "failed to load" errors, ensure all .js files are in the GitHub repo root alongside index.html.' },
        { q: 'Sync not working?',          a: 'Admin Terminal → githubconfig <owner> <repo> <path> <token>. Then type githubsync.' },
        { q: 'Balance shows zero?',        a: 'Registration awards 10 MIR. If balance is still zero, check if localStorage has been cleared. Balance is stored locally.' },
        { q: 'Mining not starting?',       a: 'Ensure you are on HTTPS. PoUW requires SubtleCrypto which is only available on secure origins.' },
        { q: 'AI agents not responding?',  a: 'Set your Anthropic API key: Admin Terminal → apikey <your-key>. Without a key, agents output offline placeholder text.' },
      ],
    },
    fa: {
      title: 'پشتیبانی پلتفرم',
      summary: 'رفع مشکلات رایج.',
      items: [
        { q: 'سایت بارگذاری نمی‌شود؟',   a: 'کنسول DevTools (F12) را بررسی کنید. اگر خطاهای "failed to load" می‌بینید، اطمینان حاصل کنید همه فایل‌های .js در ریشه repo GitHub کنار index.html هستند.' },
        { q: 'همگام‌سازی کار نمی‌کند؟',  a: 'ترمینال ادمین → githubconfig <owner> <repo> <path> <token>. سپس githubsync تایپ کنید.' },
        { q: 'موجودی صفر نشان می‌دهد؟',  a: 'ثبت‌نام ۱۰ MIR اعطا می‌کند. اگر موجودی هنوز صفر است، بررسی کنید localStorage پاک نشده باشد.' },
        { q: 'استخراج شروع نمی‌شود؟',    a: 'مطمئن شوید روی HTTPS هستید. PoUW به SubtleCrypto نیاز دارد که فقط در origins امن در دسترس است.' },
        { q: 'عوامل AI پاسخ نمی‌دهند؟',  a: 'کلید API Anthropic را تنظیم کنید: ترمینال ادمین → apikey <your-key>. بدون کلید، عوامل متن جایگزین آفلاین خروجی می‌دهند.' },
      ],
    },
    ar: {
      title: 'دعم المنصة',
      summary: 'استكشاف المشكلات الشائعة وإصلاحها.',
      items: [
        { q: 'الموقع لا يتحمل؟',         a: 'افحص وحدة تحكم DevTools (F12). إذا رأيت أخطاء "failed to load"، تأكد من وجود جميع ملفات .js في مجلد repo الجذر مع index.html.' },
        { q: 'المزامنة لا تعمل؟',        a: 'Terminal الإدارة ← githubconfig <owner> <repo> <path> <token>. ثم اكتب githubsync.' },
        { q: 'الرصيد يظهر صفراً؟',       a: 'يمنح التسجيل 10 MIR. إذا لا يزال الرصيد صفراً، تحقق من عدم مسح localStorage.' },
        { q: 'التعدين لا يبدأ؟',         a: 'تأكد من استخدام HTTPS. يتطلب PoUW SubtleCrypto المتاح فقط على الأصول الآمنة.' },
        { q: 'وكلاء AI لا يستجيبون؟',    a: 'عيّن مفتاح Anthropic API: Terminal ← apikey <your-key>. بدون مفتاح، يُخرج الوكلاء نصاً بديلاً.' },
      ],
    },
    zh: {
      title: '平台支持',
      summary: '常见问题故障排查。',
      items: [
        { q: '网站无法加载？',            a: '检查 DevTools 控制台（F12）。如果看到 "failed to load" 错误，确保所有 .js 文件与 index.html 一起位于 GitHub repo 根目录。' },
        { q: '同步不工作？',             a: '管理员终端 → githubconfig <owner> <repo> <path> <token>。然后输入 githubsync。' },
        { q: '余额显示为零？',           a: '注册奖励10 MIR。如果余额仍为零，检查 localStorage 是否被清除。' },
        { q: '挖矿无法启动？',           a: '确保在 HTTPS 上。PoUW 需要 SubtleCrypto，仅在安全来源上可用。' },
        { q: 'AI 代理不响应？',          a: '设置您的 Anthropic API 密钥：管理员终端 → apikey <your-key>。没有密钥，代理输出离线占位符文本。' },
      ],
    },
    de: {
      title: 'Plattform-Support',
      summary: 'Häufige Probleme beheben.',
      items: [
        { q: 'Website lädt nicht?',       a: 'DevTools-Konsole prüfen (F12). Bei "failed to load"-Fehlern: Alle .js-Dateien müssen im GitHub-Repo-Root neben index.html liegen.' },
        { q: 'Sync funktioniert nicht?',  a: 'Admin-Terminal → githubconfig <owner> <repo> <path> <token>. Dann githubsync eingeben.' },
        { q: 'Guthaben zeigt null?',      a: 'Registrierung vergibt 10 MIR. Falls Guthaben weiterhin null: prüfen ob localStorage gelöscht wurde.' },
        { q: 'Mining startet nicht?',     a: 'Sicherstellen, dass HTTPS verwendet wird. PoUW benötigt SubtleCrypto, nur auf sicheren Ursprüngen verfügbar.' },
        { q: 'KI-Agenten antworten nicht?', a: 'Anthropic-API-Schlüssel setzen: Admin-Terminal → apikey <ihr-schlüssel>. Ohne Schlüssel geben Agenten Offline-Platzhaltertext aus.' },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 8. PRIVATE KEY SECURITY — MANDATORY SECURITY WARNING IN ALL LANGUAGES
  // ─────────────────────────────────────────────────────────────────────────
  private_key_security: {
    en: {
      title: 'Private Key Security',
      WARNING: '⚠ CRITICAL SECURITY WARNING: Your private key is the ONLY way to access your MIR account. MIR is fully decentralised — there is NO password reset, NO customer support, and NO recovery mechanism. If you lose your private key, your account and all funds are PERMANENTLY and IRRECOVERABLY LOST. Never share your private key with anyone. Never enter it on any website other than this platform. Never store it in cloud services, email, or screenshots.',
      items: [
        { q: 'Where should I store my private key?', a: 'Offline only. Write it on paper and store in a physically secure location. Optionally use a hardware password manager (KeePass, Bitwarden local vault). Never in cloud storage.' },
        { q: 'What does my private key look like?', a: 'A Base64-encoded string (ED25519 PKCS#8 format), approximately 110 characters long.' },
        { q: 'What is my public key for?',         a: 'Your public key is your address — share it freely for others to send MIR or upvote your content.' },
        { q: 'Can I change my private key?',       a: 'No. Your key pair is mathematically fixed. Generating a new pair creates a brand new account.' },
        { q: 'What if someone gets my private key?', a: 'They gain full and immediate control of your account and funds. There is no way to reverse or block this. Generate a new key pair immediately and transfer any remaining funds.' },
      ],
    },
    fa: {
      title: 'امنیت کلید خصوصی',
      WARNING: '⚠ هشدار امنیتی حیاتی: کلید خصوصی شما تنها راه دسترسی به حساب MIR شماست. MIR کاملاً غیرمتمرکز است — بازنشانی رمز عبور، پشتیبانی مشتری یا مکانیزم بازیابی وجود ندارد. اگر کلید خصوصی خود را گم کنید، حساب و تمام وجوه شما برای همیشه و غیرقابل بازیابی از بین خواهد رفت. هرگز کلید خصوصی خود را با کسی به اشتراک نگذارید. هرگز آن را در هیچ وب‌سایتی جز این پلتفرم وارد نکنید. هرگز آن را در سرویس‌های ابری، ایمیل یا اسکرین‌شات‌ها ذخیره نکنید.',
      items: [
        { q: 'کلید خصوصی‌ام را کجا ذخیره کنم؟', a: 'فقط آفلاین. آن را روی کاغذ بنویسید و در مکانی امن نگه دارید. هرگز در فضای ابری.' },
        { q: 'کلید خصوصی‌ام چگونه به نظر می‌رسد؟', a: 'یک رشته Base64 (فرمت ED25519 PKCS#8) با طول تقریبی ۱۱۰ کاراکتر.' },
        { q: 'کلید عمومی‌ام برای چیست؟',        a: 'کلید عمومی شما آدرس شماست — آزادانه به اشتراک بگذارید.' },
        { q: 'آیا می‌توانم کلید خصوصی‌ام را تغییر دهم؟', a: 'خیر. جفت کلید شما ریاضی ثابت است. ایجاد جفت کلید جدید، یک حساب جدید می‌سازد.' },
        { q: 'اگر کسی کلید خصوصی‌ام را بگیرد؟', a: 'کنترل کامل حساب و وجوه شما را به دست می‌گیرد. هیچ راهی برای معکوس یا مسدود کردن این وجود ندارد.' },
      ],
    },
    ar: {
      title: 'أمان المفتاح الخاص',
      WARNING: '⚠ تحذير أمني بالغ الأهمية: مفتاحك الخاص هو السبيل الوحيد للوصول إلى حساب MIR. MIR لامركزي كلياً — لا إعادة تعيين كلمة مرور، ولا دعم عملاء، ولا آلية استرداد. إذا فقدت مفتاحك الخاص، يُفقد حسابك وجميع أموالك بصفة دائمة ولا يمكن استردادها. لا تشارك مفتاحك الخاص مع أي أحد. لا تُدخله في أي موقع آخر غير هذه المنصة. لا تحفظه في خدمات سحابية أو بريد إلكتروني أو لقطات شاشة.',
      items: [
        { q: 'أين أحفظ مفتاحي الخاص؟',     a: 'في وضع غير متصل فقط. اكتبه على ورق واحفظه في مكان آمن. لا تستخدم أبداً التخزين السحابي.' },
        { q: 'كيف يبدو مفتاحي الخاص؟',      a: 'سلسلة Base64 (تنسيق ED25519 PKCS#8)، طولها نحو 110 أحرف.' },
        { q: 'ما فائدة مفتاحي العام؟',        a: 'مفتاحك العام هو عنوانك — شاركه بحرية ليرسل الآخرون MIR.' },
        { q: 'هل يمكنني تغيير مفتاحي الخاص؟', a: 'لا. زوج مفاتيحك محدد رياضياً. إنشاء زوج جديد يُنشئ حساباً جديداً كلياً.' },
        { q: 'ماذا لو حصل شخص ما على مفتاحي؟', a: 'يحصل على سيطرة كاملة على حسابك. لا يوجد طريقة لعكس ذلك.' },
      ],
    },
    zh: {
      title: '私钥安全',
      WARNING: '⚠ 严重安全警告：您的私钥是访问 MIR 账户的唯一方式。MIR 完全去中心化——没有密码重置、没有客户支持、没有恢复机制。如果您丢失私钥，您的账户和所有资金将永久且无法恢复地丢失。切勿与任何人分享您的私钥。切勿在本平台以外的任何网站上输入它。切勿将其存储在云服务、电子邮件或截图中。',
      items: [
        { q: '我应该在哪里存储私钥？',       a: '仅离线存储。将其写在纸上并存放在物理安全的地方。切勿使用云存储。' },
        { q: '私钥长什么样？',              a: 'Base64编码字符串（ED25519 PKCS#8格式），约110个字符长。' },
        { q: '公钥有什么用途？',            a: '您的公钥是您的地址——可自由分享，让他人发送 MIR 或为您的内容投票。' },
        { q: '我可以更改私钥吗？',          a: '不能。您的密钥对在数学上是固定的。生成新密钥对会创建全新账户。' },
        { q: '如果有人获得了我的私钥？',    a: '他们获得您账户和资金的完全控制权。没有办法撤销或阻止这种情况。' },
      ],
    },
    de: {
      title: 'Sicherheit des privaten Schlüssels',
      WARNING: '⚠ KRITISCHE SICHERHEITSWARNUNG: Ihr privater Schlüssel ist der EINZIGE Weg auf Ihr MIR-Konto. MIR ist vollständig dezentralisiert — es gibt KEIN Passwort-Reset, KEINEN Kundensupport und KEINEN Wiederherstellungsmechanismus. Wenn Sie Ihren privaten Schlüssel verlieren, sind Ihr Konto und alle Gelder DAUERHAFT und UNWIDERRUFLICH VERLOREN. Teilen Sie Ihren privaten Schlüssel niemals mit jemandem. Geben Sie ihn niemals auf einer anderen Website als dieser Plattform ein. Speichern Sie ihn niemals in Cloud-Diensten, E-Mails oder Screenshots.',
      items: [
        { q: 'Wo soll ich meinen privaten Schlüssel speichern?', a: 'Nur offline. Auf Papier aufschreiben und an einem physisch sicheren Ort aufbewahren. Niemals in Cloud-Speicher.' },
        { q: 'Wie sieht mein privater Schlüssel aus?', a: 'Ein Base64-kodierter String (ED25519 PKCS#8), ca. 110 Zeichen lang.' },
        { q: 'Wofür ist mein öffentlicher Schlüssel?', a: 'Ihr öffentlicher Schlüssel ist Ihre Adresse — frei teilbar damit andere MIR senden können.' },
        { q: 'Kann ich meinen privaten Schlüssel ändern?', a: 'Nein. Ihr Schlüsselpaar ist mathematisch festgelegt. Ein neues Paar erstellt ein völlig neues Konto.' },
        { q: 'Was wenn jemand meinen Schlüssel bekommt?', a: 'Er erhält die volle und sofortige Kontrolle über Ihr Konto. Es gibt keine Möglichkeit, dies rückgängig zu machen.' },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 9. PUBLIC KEY IDENTITY
  // ─────────────────────────────────────────────────────────────────────────
  public_key_identity: {
    en: {
      title: 'Public Key & Identity',
      summary: 'Your public key is your on-platform identity.',
      items: [
        { q: 'What is my public key?',     a: 'An ED25519 public key in hex format. It uniquely identifies you on the MIR network and is derived from your private key.' },
        { q: 'Is my public key safe to share?', a: 'Yes. Public keys are designed to be shared. They cannot be used to access your account.' },
        { q: 'How is my identity verified?', a: 'Every action you take is cryptographically signed with your private key. Peers verify your signature using your public key.' },
        { q: 'What is the Admin public key?', a: 'The Admin (Sovereign) key is set via Admin Terminal → SET KEY. It grants SOVEREIGN_PRIORITY = Infinity across all CRDT operations.' },
        { q: 'How do I share my address?', a: 'Copy your public key from the Wallet modal. It is safe to post publicly on forums and trading platforms.' },
      ],
    },
    fa: {
      title: 'کلید عمومی و هویت',
      summary: 'کلید عمومی شما هویت درون پلتفرم شماست.',
      items: [
        { q: 'کلید عمومی من چیست؟',      a: 'یک کلید عمومی ED25519 در فرمت hex. به طور منحصر به فرد شما را در شبکه MIR شناسایی می‌کند.' },
        { q: 'آیا به اشتراک گذاشتن کلید عمومی‌ام امن است؟', a: 'بله. کلیدهای عمومی برای اشتراک‌گذاری طراحی شده‌اند و نمی‌توانند برای دسترسی به حساب شما استفاده شوند.' },
        { q: 'هویت من چگونه تأیید می‌شود؟', a: 'هر اقدامی که انجام می‌دهید با کلید خصوصی شما رمزنگاری‌شده امضا می‌شود.' },
        { q: 'کلید عمومی ادمین چیست؟',    a: 'کلید ادمین از طریق ترمینال ادمین → SET KEY تنظیم می‌شود. این SOVEREIGN_PRIORITY = Infinity در تمام عملیات‌های CRDT اعطا می‌کند.' },
        { q: 'چگونه آدرسم را به اشتراک بگذارم؟', a: 'کلید عمومی خود را از پنجره Wallet کپی کنید. امن است که آن را در انجمن‌ها و پلتفرم‌های معاملاتی منتشر کنید.' },
      ],
    },
    ar: {
      title: 'المفتاح العام والهوية',
      summary: 'مفتاحك العام هو هويتك على المنصة.',
      items: [
        { q: 'ما هو مفتاحي العام؟',       a: 'مفتاح ED25519 عام بصيغة hex. يُعرّفك بشكل فريد على شبكة MIR.' },
        { q: 'هل من الآمن مشاركة مفتاحي العام؟', a: 'نعم. المفاتيح العامة مُصمَّمة للمشاركة ولا يمكن استخدامها للوصول لحسابك.' },
        { q: 'كيف تُتحقق هويتي؟',         a: 'كل إجراء تقوم به يُوقَّع تشفيرياً بمفتاحك الخاص.' },
        { q: 'ما هو مفتاح المشرف العام؟',  a: 'يُعيَّن مفتاح المشرف عبر Terminal ← SET KEY. يمنح SOVEREIGN_PRIORITY = Infinity.' },
        { q: 'كيف أشارك عنواني؟',         a: 'انسخ مفتاحك العام من نافذة المحفظة. آمن نشره على المنتديات ومنصات التداول.' },
      ],
    },
    zh: {
      title: '公钥与身份',
      summary: '您的公钥是您在平台上的身份。',
      items: [
        { q: '我的公钥是什么？',            a: '十六进制格式的 ED25519 公钥。它在 MIR 网络上唯一标识您，由私钥派生。' },
        { q: '分享公钥安全吗？',            a: '是的。公钥是为共享而设计的，不能用于访问您的账户。' },
        { q: '我的身份如何被验证？',        a: '您的每个操作都用私钥进行加密签名。对等节点使用您的公钥验证您的签名。' },
        { q: '管理员公钥是什么？',          a: '管理员密钥通过管理员终端 → SET KEY 设置。赋予所有 CRDT 操作 SOVEREIGN_PRIORITY = Infinity。' },
        { q: '如何分享我的地址？',          a: '从钱包弹窗复制您的公钥。在论坛和交易平台上公开发布是安全的。' },
      ],
    },
    de: {
      title: 'Öffentlicher Schlüssel & Identität',
      summary: 'Ihr öffentlicher Schlüssel ist Ihre Plattform-Identität.',
      items: [
        { q: 'Was ist mein öffentlicher Schlüssel?', a: 'Ein ED25519-Schlüssel im Hex-Format. Er identifiziert Sie eindeutig im MIR-Netzwerk.' },
        { q: 'Ist das Teilen meines öffentlichen Schlüssels sicher?', a: 'Ja. Öffentliche Schlüssel sind zum Teilen gedacht und können nicht für den Kontozugang verwendet werden.' },
        { q: 'Wie wird meine Identität verifiziert?', a: 'Jede Aktion wird kryptografisch mit Ihrem privaten Schlüssel signiert.' },
        { q: 'Was ist der Admin-öffentliche Schlüssel?', a: 'Der Admin-Schlüssel wird über Admin-Terminal → SET KEY gesetzt. Gewährt SOVEREIGN_PRIORITY = Infinity.' },
        { q: 'Wie teile ich meine Adresse?',  a: 'Öffentlichen Schlüssel aus dem Wallet-Modal kopieren. Sicher auf Foren und Handelsplattformen zu posten.' },
      ],
    },
  },

};
