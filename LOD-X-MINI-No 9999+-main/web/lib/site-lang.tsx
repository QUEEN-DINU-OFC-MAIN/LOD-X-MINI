'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type SiteLang = 'en' | 'si' | 'ar';

const DICT = {
  en: {
    navHome: 'Home',
    navConnect: 'Connect',
    navCommands: 'Commands',
    navStatus: 'Status',
    navPanel: 'Panel',
    navGuide: 'Guide',
    navFaq: 'FAQ',
    navAbout: 'About',
    navPairNumber: 'Pair Number',
    footerDesc:
      'Instant WhatsApp companion with 150+ commands, status auto-tools, AI chat, media downloaders, and a unified self-service dashboard.',
    footerPlatform: 'Platform',
    footerResources: 'Resources',
    footerLegal: 'Legal & Support',
    footerPrivacy: 'Privacy Policy',
    footerTerms: 'Terms of Service',
    footerOnline: 'All Cluster Nodes Online',
    footerPoweredBy: 'FREE LOD CONNECTED',

    heroBadge: 'Multi-Server Cloud Platform · Live Now',
    heroTitle1: 'Connect your WhatsApp to',
    heroTitleHighlight: 'LOD X MINI',
    heroTitle2: 'in seconds.',
    heroSub:
      'Link with an 8-digit pairing code or QR scan — no extra app needed. Enjoy 150+ commands, status auto-view & react, AI assistant, media downloaders, and your own personal web dashboard.',
    heroBtnConnect: 'Connect Now — Free',
    heroBtnGuide: 'Step-by-Step Guide',
    heroBtnPanel: 'Open My Panel',
    statConnected: 'Connected Bots',
    statCommands: 'Commands Ready',
    statServers: 'Active Servers',
    statUptime: 'Live Uptime',
    quickStartTitle: 'Connect in 3 Simple Steps',
    quickStartSub: 'Zero setup required — pair directly from WhatsApp Linked Devices.',
    step1Title: 'Open Connect Page',
    step1Desc: 'Accept the fair-use rules and choose Phone Pairing Code or QR Code.',
    step2Title: 'Enter Code in WhatsApp',
    step2Desc: 'Go to WhatsApp → Linked Devices → Link with phone number instead.',
    step3Title: 'Control via Web Panel',
    step3Desc: 'Sign in with your number and password from your DM to customize everything.',
    featuresTitle: 'Everything Built In, Ready Out of the Box',
    featuresSub: 'Designed for speed, reliability, and effortless control on both mobile and PC.',

    connectBadge: 'Instant WhatsApp Linking',
    connectTitle: 'Connect Your Number',
    connectSub: 'Pair your WhatsApp account in under 30 seconds using an 8-digit code or QR scan.',
    rulesHeading: 'Before You Connect — Platform Rules',
    rulesSub: 'Please review and accept these fair-use guidelines to keep the cluster fast for everyone.',
    acceptRulesBtn: 'I Agree — Continue to Connect',
    methodPhone: 'Phone Pairing Code',
    methodPhoneSub: 'Recommended · Best for single phone users',
    methodQr: 'QR Code Scan',
    methodQrSub: 'Fastest if you have the page open on PC',

    panelBadge: 'Self-Service Control Center',
    panelTitle: 'My Bot Dashboard',
    panelSub: 'Manage status automation, custom auto-replies, scheduled posts, and bot preferences.',

    guideBadge: 'Visual Walkthrough · Mobile & PC',
    guideTitle: 'Complete Step-by-Step User Guide',
    guideSub:
      'Every screen explained with highlighted boxes, lines, and numbered callouts for both Mobile phones and PC / Laptop.',
    deviceMobile: 'Mobile View',
    devicePc: 'PC / Laptop View',
    clickToZoom: 'Click image to enlarge'
  },
  si: {
    navHome: 'මුල් පිටුව',
    navConnect: 'සම්බන්ධ වන්න',
    navCommands: 'විධාන (Commands)',
    navStatus: 'තත්ත්වය (Status)',
    navPanel: 'පැනලය (Panel)',
    navGuide: 'උපදෙස් (Guide)',
    navFaq: 'නිතර අසන ප්‍රශ්න',
    navAbout: 'අප ගැන',
    navPairNumber: 'අංකය සම්බන්ධ කරන්න',
    footerDesc:
      'විධාන 150+ ක්, ස්වයංක්‍රීය Status බැලීම සහ React කිරීම, AI සහායක, Media ඩවුන්ලෝඩර් සහ ඔබේම පාලන පැනලයක් සහිත වේගවත්ම WhatsApp Bot සේවාව.',
    footerPlatform: 'ප්‍රධාන පිටු',
    footerResources: 'උපකාරක පිටු',
    footerLegal: 'නීතිමය තොරතුරු',
    footerPrivacy: 'පෞද්ගලිකත්ව ප්‍රතිපත්තිය',
    footerTerms: 'සේවා කොන්දේසි',
    footerOnline: 'සියලුම සර්වර් සක්‍රීයයි',
    footerPoweredBy: 'FREE LOD CONNECTED',

    heroBadge: 'Multi-Server Cloud Platform · දැන් සක්‍රීයයි',
    heroTitle1: 'තත්පර කිහිපයෙන් ඔබේ WhatsApp ගිණුම',
    heroTitleHighlight: 'LOD X MINI',
    heroTitle2: 'සමඟ සම්බන්ධ කරන්න.',
    heroSub:
      'අංක 8 ක Pairing Code එකක් හෝ QR කේතයක් මගින් පහසුවෙන් සම්බන්ධ කරන්න. Commands 150+, Auto Status Seen & React, AI Chat, Media Downloaders සහ ඔබටම වෙන්වූ Web Panel එකක් නොමිලේ ලබාගන්න.',
    heroBtnConnect: 'දැන්ම සම්බන්ධ වන්න — නොමිලේ',
    heroBtnGuide: 'පියවරෙන් පියවර උපදෙස් (Guide)',
    heroBtnPanel: 'මගේ Panel එකට යන්න',
    statConnected: 'සම්බන්ධිත Bot ගණන',
    statCommands: 'මුළු Commands ගණන',
    statServers: 'සක්‍රීය Servers',
    statUptime: 'සජීවී ක්‍රියාකාරීත්වය',
    quickStartTitle: 'සරල පියවර 3 කින් සම්බන්ධ වන්න',
    quickStartSub: 'වෙනත් App කිසිවක් අවශ්‍ය නැත — කෙලින්ම WhatsApp Linked Devices මගින් සම්බන්ධ කරන්න.',
    step1Title: 'Connect පිටුවට පිවිසෙන්න',
    step1Desc: 'නීති රීති වලට එකඟ වී Phone Pairing Code හෝ QR Code ක්‍රමය තෝරන්න.',
    step2Title: 'WhatsApp හි කේතය ඇතුළත් කරන්න',
    step2Desc: 'WhatsApp → Linked Devices → Link with phone number instead වෙත ගොස් කේතය ලබාදෙන්න.',
    step3Title: 'Web Panel මගින් පාලනය කරන්න',
    step3Desc: 'ඔබේ WhatsApp වෙත ලැබෙන මුරපදය (Password) භාවිතා කර Panel එකට ලොග් වී සැකසුම් වෙනස් කරන්න.',
    featuresTitle: 'ඔබට අවශ්‍ය සියලුම පහසුකම් එකම තැනකින්',
    featuresSub: 'Mobile සහ PC දෙකටම ගැලපෙන ලෙස ඉතා වේගවත්ව ක්‍රියාත්මක වේ.',

    connectBadge: 'ක්ෂණික WhatsApp සම්බන්ධතාවය',
    connectTitle: 'ඔබේ දුරකථන අංකය සම්බන්ධ කරන්න',
    connectSub: 'තත්පර 30 ක් ඇතුළත අංක 8 ක කේතය හෝ QR Scan මගින් ඔබේ WhatsApp සම්බන්ධ කරන්න.',
    rulesHeading: 'සම්බන්ධ වීමට පෙර — සේවා නීති රීති',
    rulesSub: 'සියලු දෙනාටම වේගවත් සේවාවක් ලබාදීම සඳහා කරුණාකර මෙම කොන්දේසි කියවා එකඟ වන්න.',
    acceptRulesBtn: 'මම එකඟ වෙමි — ඉදිරියට යන්න',
    methodPhone: 'දුරකථන අංකයෙන් (Pairing Code)',
    methodPhoneSub: 'වඩාත් සුදුසුයි · එකම දුරකථනයක් භාවිතා කරන අයට',
    methodQr: 'QR කේතය Scan කිරීමෙන්',
    methodQrSub: 'PC / Laptop එකකින් පිටුව විවෘත කර ඇත්නම් වේගවත්ම ක්‍රමය',

    panelBadge: 'ස්වයං පාලන මධ්‍යස්ථානය',
    panelTitle: 'මගේ Bot පාලන පැනලය',
    panelSub: 'Status ස්වයංක්‍රීයකරණය, Auto-Replies, Scheduled Status සහ Bot සැකසුම් මෙතැනින් පාලනය කරන්න.',

    guideBadge: 'රූප සටහන් සහිත උපදෙස් · Mobile සහ PC',
    guideTitle: 'සම්පූර්ණ පියවරෙන් පියවර උපදෙස් මාලාව',
    guideSub:
      'Mobile සහ PC / Laptop දෙකටම අදාළව සෑම පිටුවක්ම ඉරි සහ අංක යොදා පැහැදිලිව විස්තර කර ඇත.',
    deviceMobile: 'Mobile පෙනුම',
    devicePc: 'PC / Laptop පෙනුම',
    clickToZoom: 'විශාල කර බැලීමට රූපය මත ක්ලික් කරන්න'
  },
  ar: {
    navHome: 'الرئيسية',
    navConnect: 'اتصال',
    navCommands: 'الأوامر',
    navStatus: 'الحالة',
    navPanel: 'لوحة التحكم',
    navGuide: 'الدليل',
    navFaq: 'الأسئلة الشائعة',
    navAbout: 'حول المنصة',
    navPairNumber: 'ربط الرقم الآن',
    footerDesc:
      'مساعد واتساب فوري يضم أكثر من 150 أمرًا، أدوات الحالة التلقائية، محادثة الذكاء الاصطناعي، تحميل الوسائط، ولوحة تحكم شخصية متكاملة.',
    footerPlatform: 'المنصة',
    footerResources: 'المصادر',
    footerLegal: 'القانونية والدعم',
    footerPrivacy: 'سياسة الخصوصية',
    footerTerms: 'شروط الخدمة',
    footerOnline: 'جميع الخوادم متصلة الآن',
    footerPoweredBy: 'FREE LOD CONNECTED',

    heroBadge: 'منصة سحابية متعددة الخوادم · متاح الآن',
    heroTitle1: 'اربط حساب واتساب الخاص بك مع',
    heroTitleHighlight: 'LOD X MINI',
    heroTitle2: 'في ثوانٍ معدودة.',
    heroSub:
      'اربط رقمك عبر رمز مكون من 8 أرقام أو مسح QR بدون أي تطبيق إضافي. استمتع بأكثر من 150 أمرًا، مشاهدة وتفاعل تلقائي مع الحالات، ولوحة تحكم ويب خاصة بك.',
    heroBtnConnect: 'اتصل الآن — مجانًا',
    heroBtnGuide: 'دليل الاستخدام بالصور',
    heroBtnPanel: 'فتح لوحة التحكم',
    statConnected: 'البوتات المتصلة',
    statCommands: 'الأوامر الجاهزة',
    statServers: 'الخوادم النشطة',
    statUptime: 'وقت التشغيل المباشر',
    quickStartTitle: 'اتصل في 3 خطوات بسيطة',
    quickStartSub: 'لا حاجة لأي إعدادات معقدة — اربط مباشرة من الأجهزة المرتبطة في واتساب.',
    step1Title: 'افتح صفحة الاتصال',
    step1Desc: 'وافق على شروط الاستخدام واختر رمز الربط بالهاتف أو رمز QR.',
    step2Title: 'أدخل الرمز في واتساب',
    step2Desc: 'انتقل إلى واتساب ← الأجهزة المرتبطة ← الربط برقم الهاتف بدلاً من ذلك.',
    step3Title: 'تحكم عبر لوحة الويب',
    step3Desc: 'سجّل الدخول برقمك وكلمة المرور المرسلة إليك لتخصيص جميع الإعدادات.',
    featuresTitle: 'كل ما تحتاجه مدمج وجاهز للعمل',
    featuresSub: 'مصمم للسرعة والثبات وسهولة التحكم على كل من الهاتف والكمبيوتر.',

    connectBadge: 'ربط فوري لحساب واتساب',
    connectTitle: 'اربط رقم هاتفك',
    connectSub: 'اربط حسابك في أقل من 30 ثانية باستخدام رمز مكون من 8 أرقام أو مسح رمز QR.',
    rulesHeading: 'قبل الاتصال — قواعد المنصة',
    rulesSub: 'يرجى قراءة وقبول إرشادات الاستخدام العادل للحفاظ على سرعة الخوادم للجميع.',
    acceptRulesBtn: 'أوافق — المتابعة للاتصال',
    methodPhone: 'رمز الربط برقم الهاتف',
    methodPhoneSub: 'موصى به · الأفضل لمستخدمي الهاتف الواحد',
    methodQr: 'مسح رمز QR',
    methodQrSub: 'الأسرع إذا كنت تفتح الصفحة على الكمبيوتر',

    panelBadge: 'مركز التحكم الذاتي',
    panelTitle: 'لوحة تحكم البوت',
    panelSub: 'إدارة تفاعل الحالات التلقائي، الردود المخصصة، جدولة الحالات، وإعدادات البوت.',

    guideBadge: 'شرح مصور · للهاتف والكمبيوتر',
    guideTitle: 'دليل المستخدم الكامل خطوة بخطوة',
    guideSub:
      'شرح تفصيلي لكل شاشة مع مربعات توضيحية وخطوط مرقمة لكل من الهاتف المحمول والكمبيوتر.',
    deviceMobile: 'عرض الهاتف',
    devicePc: 'عرض الكمبيوتر',
    clickToZoom: 'اضغط على الصورة للتكبير'
  }
} as const;

export type DictKey = keyof typeof DICT.en;

interface LangContextValue {
  lang: SiteLang;
  setLang: (l: SiteLang) => void;
  t: (k: DictKey) => string;
  isRtl: boolean;
}

const LangContext = createContext<LangContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (k) => DICT.en[k],
  isRtl: false
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<SiteLang>('en');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('rcd_site_lang') as SiteLang | null;
      if (saved === 'en' || saved === 'si' || saved === 'ar') {
        setLangState(saved);
      }
    } catch {}
  }, []);

  const setLang = (next: SiteLang) => {
    setLangState(next);
    try {
      window.localStorage.setItem('rcd_site_lang', next);
    } catch {}
  };

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }
  }, [lang]);

  const t = (k: DictKey): string => {
    return DICT[lang]?.[k] ?? DICT.en[k] ?? k;
  };

  return (
    <LangContext.Provider value={{ lang, setLang, t, isRtl: lang === 'ar' }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
