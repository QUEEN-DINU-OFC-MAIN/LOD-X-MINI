'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useLang, type SiteLang } from '@/lib/site-lang';
import {
  BookOpen,
  Smartphone,
  Monitor,
  ZoomIn,
  X,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  HelpCircle,
  ShieldCheck
} from 'lucide-react';

interface CalloutItem {
  badge: string;
  title: Record<SiteLang, string>;
  desc: Record<SiteLang, string>;
}

interface GuideStep {
  id: string;
  stepNum: string;
  chapter: Record<SiteLang, string>;
  title: Record<SiteLang, string>;
  subtitle: Record<SiteLang, string>;
  pageUrl: string;
  mobileImg: string;
  pcImg: string;
  callouts: CalloutItem[];
  tip?: Record<SiteLang, string>;
}

const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'home',
    stepNum: '01',
    chapter: {
      en: 'Home Page',
      si: 'මුල් පිටුව (Home)',
      ar: 'الصفحة الرئيسية'
    },
    title: {
      en: 'Explore the Home Page & Switch Language',
      si: 'මුල් පිටුව සහ භාෂාව තෝරාගැනීම (Home Page)',
      ar: 'استكشاف الصفحة الرئيسية وتغيير اللغة'
    },
    subtitle: {
      en: 'Everything starts at the Home page — switch between English, Sinhala, or Arabic, check live cluster stats, or jump straight to Connect.',
      si: 'වෙබ් අඩවියේ මුල් පිටුවෙන් ඔබට කැමති භාෂාවක් (English / සිංහල / العربية) තෝරාගත හැකි අතර සජීවී Bot දත්ත සහ ප්‍රධාන පිටු වෙත පිවිසිය හැක.',
      ar: 'ابدأ من الصفحة الرئيسية لتغيير اللغة، متابعة إحصائيات الخوادم المباشرة، أو الانتقال مباشرة لصفحة الربط.'
    },
    pageUrl: '/',
    mobileImg: '/guide/mobile-01-home.webp',
    pcImg: '/guide/pc-01-home.webp',
    callouts: [
      {
        badge: '1',
        title: {
          en: 'Brand Logo & Language Switcher (EN / සිං / ع)',
          si: 'ලාංඡනය සහ භාෂාව මාරු කරන බොත්තම (EN / සිං / ع)',
          ar: 'الشعار ومبدل اللغة (EN / සිං / ع)'
        },
        desc: {
          en: 'Tap English, සිංහල, or العربية in the top header to translate the entire website immediately.',
          si: 'ඉහළ තීරුවේ ඇති English, සිංහල හෝ العربية බොත්තම මගින් මුළු වෙබ් අඩවියේම භාෂාව ක්ෂණිකව වෙනස් කරගන්න.',
          ar: 'اضغط على اللغة المفضلة في أعلى الصفحة لترجمة الموقع بالكامل فورًا.'
        }
      },
      {
        badge: '2',
        title: {
          en: 'Primary Action Buttons (Connect / Panel / Guide)',
          si: 'ප්‍රධාන බොත්තම් (Connect / Panel / Guide)',
          ar: 'الأزرار الرئيسية (اتصال / لوحة التحكم / الدليل)'
        },
        desc: {
          en: 'Click "Connect Now" to link your WhatsApp number, "Open My Panel" to customize your bot, or "Step-by-Step Guide" for visual help.',
          si: 'ඔබේ අංකය සම්බන්ධ කිරීමට "Connect Now" ද, සැකසුම් වෙනස් කිරීමට "Panel" ද ක්ලික් කරන්න.',
          ar: 'اضغط على زر الاتصال لربط رقمك أو افتح لوحة التحكم لإدارة إعدادات البوت.'
        }
      },
      {
        badge: '3',
        title: {
          en: 'Live Multi-Server Connected Bots Chart',
          si: 'සජීවී සම්බන්ධිත Bot ප්‍රස්තාරය',
          ar: 'مخطط البوتات المتصلة المباشر'
        },
        desc: {
          en: 'Shows real-time active bots aggregated across all cluster servers updated every few seconds.',
          si: 'සියලුම සර්වර් වල දැනට සක්‍රීයව පවතින මුළු Bot ගණන සජීවීව මෙහි පෙන්වයි.',
          ar: 'يعرض إجمالي البوتات المتصلة عبر جميع الخوادم في الوقت الفعلي.'
        }
      },
      {
        badge: '4',
        title: {
          en: 'Quick Navigation Bar (Top Pill on PC / Bottom Dock on Mobile)',
          si: 'වේගවත් Navigation තීරුව (PC ඉහළින් / Mobile පහළින්)',
          ar: 'شريط التنقل السريع (أعلى الكمبيوتر / أسفل الهاتف)'
        },
        desc: {
          en: 'Switch between Home, Connect, Commands, Status, Panel, and Guide with a single tap.',
          si: 'ඕනෑම පිටුවකට එක් ක්ලික් කිරීමකින් පිවිසීමට මෙම Navigation තීරුව භාවිතා කරන්න.',
          ar: 'تنقل بسهولة بين جميع صفحات المنصة بضغطة واحدة.'
        }
      }
    ]
  },
  {
    id: 'rules',
    stepNum: '02',
    chapter: {
      en: 'Connect · Rules',
      si: 'නීති රීති (Rules)',
      ar: 'شروط الاستخدام'
    },
    title: {
      en: 'Step 1 of Connecting: Accept Fair-Use Rules',
      si: 'සම්බන්ධ වීමේ පළමු පියවර: සේවා කොන්දේසි පිළිගැනීම',
      ar: 'الخطوة الأولى للاتصال: الموافقة على شروط الاستخدام'
    },
    subtitle: {
      en: 'When you open /connect, review the fair-use rules so your WhatsApp account and our servers stay safe.',
      si: 'Connect පිටුවට පිවිසි විට පළමුව මෙම නීති රීති කියවා එකඟ වීමෙන් ඔබේ ගිණුමේ ආරක්ෂාව තහවුරු වේ.',
      ar: 'عند فتح صفحة الاتصال، اقرأ إرشادات الاستخدام العادل ووافق عليها للمتابعة.'
    },
    pageUrl: '/connect',
    mobileImg: '/guide/mobile-02-rules.webp',
    pcImg: '/guide/pc-02-rules.webp',
    callouts: [
      {
        badge: '1',
        title: {
          en: 'Platform Safety & Fair-Use Guidelines',
          si: 'ආරක්ෂිත භාවිතය සඳහා උපදෙස් මාලාව',
          ar: 'إرشادات الأمان والاستخدام العادل'
        },
        desc: {
          en: 'Explains how to avoid WhatsApp spam bans and how session privacy works.',
          si: 'Spam වලින් වැළකී ආරක්ෂිතව Bot භාවිතා කරන ආකාරය මෙහි සඳහන් වේ.',
          ar: 'توضح كيفية تجنب الحظر والحفاظ على أمان جلستك.'
        }
      },
      {
        badge: '2',
        title: {
          en: 'Agreement Checkbox',
          si: 'එකඟතා කොටුව (Checkbox)',
          ar: 'مربع الموافقة على الشروط'
        },
        desc: {
          en: 'Tick "I have read and agree to the rules above" to unlock the Continue button.',
          si: 'ඉදිරියට යාමට මෙම කොටුව (Tick) ලකුණු කරන්න.',
          ar: 'ضع علامة صح لتفعيل زر المتابعة.'
        }
      },
      {
        badge: '3',
        title: {
          en: 'Accept & Continue Button',
          si: 'Accept & Continue බොත්තම',
          ar: 'زر الموافقة والمتابعة'
        },
        desc: {
          en: 'Click here to proceed to choosing your connection method.',
          si: 'මෙය ක්ලික් කර සම්බන්ධ වන ක්‍රමය තෝරන පියවරට පිවිසෙන්න.',
          ar: 'اضغط هنا للانتقال إلى اختيار طريقة الربط.'
        }
      }
    ]
  },
  {
    id: 'method',
    stepNum: '03',
    chapter: {
      en: 'Connect · Method',
      si: 'ක්‍රමය තේරීම (Method)',
      ar: 'اختيار طريقة الربط'
    },
    title: {
      en: 'Step 2 of Connecting: Choose Phone Code or QR Scan',
      si: 'දෙවන පියවර: Phone Pairing Code හෝ QR ක්‍රමය තෝරන්න',
      ar: 'الخطوة الثانية: اختر رمز الهاتف أو مسح QR'
    },
    subtitle: {
      en: 'Pick option A if you are using the same phone, or option B if you have this website open on a PC / second screen.',
      si: 'ඔබ එකම දුරකථනයෙන් සම්බන්ධ වන්නේ නම් A (Phone Code) තෝරන්න. PC එකකින් බලන්නේ නම් B (QR Code) තෝරන්න.',
      ar: 'اختر الطريقة A إذا كنت تستخدم نفس الهاتف، أو الطريقة B إذا كنت تفتح الموقع من الكمبيوتر.'
    },
    pageUrl: '/connect',
    mobileImg: '/guide/mobile-03-method.webp',
    pcImg: '/guide/pc-03-method.webp',
    callouts: [
      {
        badge: 'A',
        title: {
          en: 'Phone Pairing Code (Recommended)',
          si: 'දුරකථන අංකයෙන් ලබාගන්නා කේතය (Phone Pairing Code)',
          ar: 'رمز الربط برقم الهاتف (موصى به)'
        },
        desc: {
          en: 'Generates an 8-digit code you can copy and paste right inside WhatsApp notifications — no second device required.',
          si: 'අංක 8 ක කේතයක් ලබාගෙන එය Copy කර කෙලින්ම WhatsApp වෙත ලබාදිය හැක. වෙනත් දුරකථනයක් අවශ්‍ය නැත.',
          ar: 'يولد رمزًا من 8 أرقام يمكنك نسخه ولصقه مباشرة في واتساب دون الحاجة لجهاز ثانٍ.'
        }
      },
      {
        badge: 'B',
        title: {
          en: 'QR Code Scan',
          si: 'QR කේතය Scan කිරීම (QR Code)',
          ar: 'مسح رمز QR'
        },
        desc: {
          en: 'Displays a live QR code on screen that you can scan using WhatsApp → Linked Devices → Link a Device.',
          si: 'තිරයේ දිස්වන QR කේතය ඔබේ දුරකථනයේ WhatsApp මගින් Scan කර තත්පර කිහිපයෙන් සම්බන්ධ විය හැක.',
          ar: 'يعرض رمز QR مباشر لمسحه عبر كاميرا واتساب من الأجهزة المرتبطة.'
        }
      }
    ]
  },
  {
    id: 'phone',
    stepNum: '04',
    chapter: {
      en: 'Phone Pairing',
      si: 'දුරකථන කේතය (Pairing)',
      ar: 'الربط برقم الهاتف'
    },
    title: {
      en: 'Step 3A: Link with an 8-Digit Phone Pairing Code',
      si: '3A පියවර: අංක 8 ක Pairing Code එක ලබාගැනීම',
      ar: 'الخطوة 3A: الربط عبر رمز الهاتف المكون من 8 أرقام'
    },
    subtitle: {
      en: 'Select your country code, type your WhatsApp number without the leading zero, and request your 8-digit code.',
      si: 'ඔබේ රට තෝරා, මුලට 0 නොමැතිව දුරකථන අංකය ඇතුළත් කර "Get Pairing Code" ක්ලික් කරන්න.',
      ar: 'اختر رمز الدولة، أدخل رقم واتساب بدون الصفر الأول، ثم اضغط للحصول على الرمز.'
    },
    pageUrl: '/connect',
    mobileImg: '/guide/mobile-04-phone.webp',
    pcImg: '/guide/pc-04-phone.webp',
    callouts: [
      {
        badge: '1',
        title: {
          en: 'Country Dial Code Selector (+94 Sri Lanka, etc.)',
          si: 'රට සහ කේතය තෝරන ස්ථානය (+94 Sri Lanka)',
          ar: 'اختيار مفتاح الدولة (+94 وغيرها)'
        },
        desc: {
          en: 'Click to pick your country or search by country name / dial code.',
          si: 'ඔබේ රට තේරීමට මෙතැන ක්ලික් කරන්න (ශ්‍රී ලංකාව සඳහා +94).',
          ar: 'اضغط لاختيار دولتك أو البحث عن مفتاح الدولة.'
        }
      },
      {
        badge: '2',
        title: {
          en: 'WhatsApp Phone Number Input',
          si: 'දුරකථන අංකය ඇතුළත් කරන කොටුව',
          ar: 'حقل إدخال رقم واتساب'
        },
        desc: {
          en: 'Enter your phone number without the leading 0 (for example: 771234567).',
          si: 'මුලට බිංදුව (0) නොමැතිව ඔබේ අංකය ඇතුළත් කරන්න (උදා: 771234567).',
          ar: 'أدخل رقمك بدون الصفر في البداية.'
        }
      },
      {
        badge: '3',
        title: {
          en: 'Get Pairing Code Button',
          si: 'Get Pairing Code බොත්තම',
          ar: 'زر الحصول على رمز الربط'
        },
        desc: {
          en: 'Click to generate your 8-digit code (XXXX-XXXX). Copy it and enter it in WhatsApp → Linked Devices → Link with phone number instead.',
          si: 'මෙය ක්ලික් කළ විට ලැබෙන අංක 8 කේතය Copy කරගෙන WhatsApp → Linked Devices → Link with phone number වෙත ලබාදෙන්න.',
          ar: 'اضغط لتوليد الرمز ثم انسخه وأدخله في إشعار واتساب.'
        }
      },
      {
        badge: '4',
        title: {
          en: 'Switch Between Phone Code & QR Anytime',
          si: 'Phone Code සහ QR අතර මාරු වීම',
          ar: 'التبديل بين رمز الهاتف ورمز QR'
        },
        desc: {
          en: 'Use the top mode toggle if you want to switch to QR scanning instead.',
          si: 'ඔබට අවශ්‍ය නම් ඉහළින් ඇති QR Code බොත්තම මගින් QR ක්‍රමයට මාරු විය හැක.',
          ar: 'يمكنك التبديل إلى مسح رمز QR في أي وقت من الأعلى.'
        }
      }
    ],
    tip: {
      en: 'Once linked, the bot immediately sends a welcome message to your own WhatsApp DM containing your 6-character Panel Password!',
      si: 'සම්බන්ධ වූ වහාම ඔබේම WhatsApp අංකයට Bot විසින් පණිවිඩයක් මගින් ඔබේ Panel Password එක එවනු ලැබේ!',
      ar: 'بمجرد الربط، سيرسل البوت رسالة ترحيبية على واتساب تحتوي على كلمة مرور لوحة التحكم الخاصة بك!'
    }
  },
  {
    id: 'qr',
    stepNum: '05',
    chapter: {
      en: 'QR Scan',
      si: 'QR කේතය (QR Scan)',
      ar: 'مسح رمز QR'
    },
    title: {
      en: 'Step 3B: Link by Scanning a Live QR Code',
      si: '3B පියවර: QR කේතය Scan කර සම්බන්ධ වීම',
      ar: 'الخطوة 3B: الربط عبر مسح رمز QR المباشر'
    },
    subtitle: {
      en: 'Best when viewing the website on a laptop/PC while holding your phone in hand.',
      si: 'ඔබ Laptop හෝ PC එකකින් වෙබ් අඩවිය විවෘත කරගෙන සිටින විට වේගවත්ම ක්‍රමය මෙයයි.',
      ar: 'الطريقة الأسرع عند فتح الموقع على شاشة الكمبيوتر.'
    },
    pageUrl: '/connect',
    mobileImg: '/guide/mobile-05-qr.webp',
    pcImg: '/guide/pc-05-qr.webp',
    callouts: [
      {
        badge: '1',
        title: {
          en: 'Generate QR Code Button / QR Display Box',
          si: 'Generate QR Code බොත්තම සහ QR කොටුව',
          ar: 'زر توليد رمز QR ومنطقة العرض'
        },
        desc: {
          en: 'Click "Generate QR Code" to start a live pairing session and display a scannable QR image.',
          si: 'QR කේතය ලබාගැනීමට "Generate QR Code" බොත්තම ක්ලික් කරන්න.',
          ar: 'اضغط لتوليد رمز QR مباشر جاهز للمسح.'
        }
      },
      {
        badge: '2',
        title: {
          en: 'Step-by-Step WhatsApp Scan Instructions',
          si: 'Scan කරන ආකාරය පිළිබඳ කෙටි උපදෙස්',
          ar: 'خطوات مسح الرمز من داخل واتساب'
        },
        desc: {
          en: 'Open WhatsApp → Settings / Menu (⋮) → Linked Devices → Link a Device and point your camera at the QR.',
          si: 'WhatsApp → Linked Devices → Link a Device වෙත ගොස් තිරයේ ඇති QR කේතය Scan කරන්න.',
          ar: 'افتح واتساب ← الأجهزة المرتبطة ← ربط جهاز، ووجّه الكاميرا نحو الرمز.'
        }
      }
    ]
  },
  {
    id: 'commands',
    stepNum: '06',
    chapter: {
      en: 'Commands (150+)',
      si: 'විධාන (Commands)',
      ar: 'الأوامر (150+)'
    },
    title: {
      en: 'Browse, Search & Copy Any of the 150+ Bot Commands',
      si: 'Commands 150+ අතරින් අවශ්‍ය විධානය සොයා Copy කරගන්න',
      ar: 'تصفح وابحث وانسخ أي أمر من أوامر البوت (+150)'
    },
    subtitle: {
      en: 'Every command is organized by category with instant search and one-click copy.',
      si: 'සියලුම Commands කාණ්ඩ වශයෙන් වෙන් කර ඇති අතර එක් ක්ලික් කිරීමකින් Copy කරගත හැක.',
      ar: 'جميع الأوامر مصنفة حسب الفئة مع بحث فوري ونسخ بضغطة واحدة.'
    },
    pageUrl: '/commands',
    mobileImg: '/guide/mobile-06-commands.webp',
    pcImg: '/guide/pc-06-commands.webp',
    callouts: [
      {
        badge: '1',
        title: {
          en: 'Instant Command Search Bar',
          si: 'විධාන සොයන Search තීරුව',
          ar: 'شريط البحث الفوري عن الأوامر'
        },
        desc: {
          en: 'Type any keyword like "song", "tiktok", "status", or "ai" to filter commands immediately.',
          si: 'ඔබට අවශ්‍ය ඕනෑම විධානයක් (උදා: song, video, status, ai) මෙහි Type කර ක්ෂණිකව සොයාගන්න.',
          ar: 'اكتب اسم الأمر أو وظيفته لتصفية القائمة فورًا.'
        }
      },
      {
        badge: '2',
        title: {
          en: 'Category Filter Tabs',
          si: 'කාණ්ඩ තෝරන බොත්තම් (Categories)',
          ar: 'أزرار تصفية الفئات'
        },
        desc: {
          en: 'Filter by Download, Media, Status, Auto-Reply, AI, Group, or Owner commands.',
          si: 'Download, Status, AI, Media වැනි කාණ්ඩ අනුව Commands වෙන් කර බැලීමට මෙය භාවිතා කරන්න.',
          ar: 'اختر الفئة المطلوبة لعرض أوامرها فقط.'
        }
      },
      {
        badge: '3',
        title: {
          en: 'Command Card & One-Click Copy',
          si: 'Command කාඩ්පත සහ Copy බොත්තම',
          ar: 'بطاقة الأمر وزر النسخ السريع'
        },
        desc: {
          en: 'Click any command card to copy the command (e.g. .menu or .song) straight to your clipboard.',
          si: 'ඕනෑම Command එකක් මත ක්ලික් කර එය Copy කරගෙන WhatsApp හි Paste කළ හැක.',
          ar: 'اضغط على أي أمر لنسخه مباشرة إلى الحافظة.'
        }
      }
    ]
  },
  {
    id: 'status',
    stepNum: '07',
    chapter: {
      en: 'Live Status',
      si: 'සර්වර් තත්ත්වය (Status)',
      ar: 'حالة الخوادم'
    },
    title: {
      en: 'Monitor Real-Time Cluster Health & Server Nodes',
      si: 'සජීවී සර්වර් ක්‍රියාකාරීත්වය සහ දත්ත පරීක්ෂා කිරීම (/status)',
      ar: 'مراقبة حالة الخوادم والإحصائيات المباشرة'
    },
    subtitle: {
      en: 'See live connected bot counts aggregated across all servers in server.js, memory health, and uptime.',
      si: 'සියලුම සර්වර් වල සක්‍රීය Bot ගණන, Uptime කාලය සහ පද්ධතියේ වේගය මෙම පිටුවෙන් බලාගත හැක.',
      ar: 'تابع عدد البوتات المتصلة عبر جميع الخوادم ووقت التشغيل المباشر.'
    },
    pageUrl: '/status',
    mobileImg: '/guide/mobile-07-status.webp',
    pcImg: '/guide/pc-07-status.webp',
    callouts: [
      {
        badge: '1',
        title: {
          en: 'Cluster Operational Banner & Refresh Control',
          si: 'පද්ධතියේ සජීවී තත්ත්වය සහ Refresh බොත්තම',
          ar: 'مؤشر حالة المنصة وزر التحديث'
        },
        desc: {
          en: 'Confirms all backend nodes are online and lets you refresh telemetry anytime.',
          si: 'සර්වර් සියල්ල ක්‍රියාත්මක බව පෙන්වන අතර නවතම දත්ත ලබාගැනීමට Refresh කළ හැක.',
          ar: 'يؤكد عمل جميع الخوادم ويتيح تحديث البيانات فورًا.'
        }
      },
      {
        badge: '2',
        title: {
          en: 'Key Metric Cards (Connected Bots, Capacity, Uptime)',
          si: 'ප්‍රධාන දත්ත කාඩ්පත් (Connected Bots, Capacity, Uptime)',
          ar: 'بطاقات المؤشرات الرئيسية'
        },
        desc: {
          en: 'Displays combined active sessions across every configured backend server.',
          si: 'සියලුම සර්වර් වල එකතුවක් ලෙස සම්බන්ධිත මුළු Bot ගණන සහ ධාරිතාවය පෙන්වයි.',
          ar: 'تعرض إجمالي الجلسات النشطة والسعة المتاحة.'
        }
      },
      {
        badge: '3',
        title: {
          en: 'Live Trend Graph & Server Health Details',
          si: 'සජීවී ප්‍රස්තාරය සහ Server විස්තර',
          ar: 'الرسم البياني المباشر وتفاصيل الخوادم'
        },
        desc: {
          en: 'Visualizes connected-bot activity over time.',
          si: 'කාලයත් සමඟ සම්බන්ධ වී ඇති Bot ප්‍රමාණය ප්‍රස්තාරයක් ලෙස පෙන්වයි.',
          ar: 'يعرض نشاط البوتات المتصلة بمرور الوقت.'
        }
      }
    ]
  },
  {
    id: 'panel-login',
    stepNum: '08',
    chapter: {
      en: 'Panel Sign-In',
      si: 'පැනලයට පිවිසීම (Login)',
      ar: 'تسجيل دخول اللوحة'
    },
    title: {
      en: 'Sign In to Your Personal Bot Control Panel',
      si: 'ඔබේ Bot පාලන පැනලයට (Panel) ලොග් වන ආකාරය',
      ar: 'تسجيل الدخول إلى لوحة تحكم البوت الخاصة بك'
    },
    subtitle: {
      en: 'Use your connected phone number and the 6-character password sent to your WhatsApp DM (or send .settings in WhatsApp for a 1-tap login link).',
      si: 'ඔබ සම්බන්ධ කළ දුරකථන අංකය සහ ඔබේ WhatsApp වෙත ලැබුණු අකුරු 6 ක මුරපදය (Password) ලබාදී ලොග් වන්න.',
      ar: 'أدخل رقمك المتصل وكلمة المرور المكونة من 6أحرف المرسلة إلى رسائلك الخاصة في واتساب.'
    },
    pageUrl: '/panel',
    mobileImg: '/guide/mobile-08-panel-login.webp',
    pcImg: '/guide/pc-08-panel-login.webp',
    callouts: [
      {
        badge: '1',
        title: {
          en: 'Connected WhatsApp Number Field',
          si: 'සම්බන්ධ කළ WhatsApp දුරකථන අංකය',
          ar: 'حقل رقم واتساب المتصل'
        },
        desc: {
          en: 'Enter your full number with country code (e.g. 94771234567).',
          si: 'රටේ කේතය සමඟ ඔබේ සම්පූර්ණ අංකය ඇතුළත් කරන්න (උදා: 94771234567).',
          ar: 'أدخل رقمك الكامل مع رمز الدولة (مثال: 94771234567).'
        }
      },
      {
        badge: '2',
        title: {
          en: '6-Character Bot Password',
          si: 'අකුරු 6 ක මුරපදය (Bot Password)',
          ar: 'كلمة مرور البوت (6 خانات)'
        },
        desc: {
          en: 'Sent automatically to your WhatsApp DM when you connect, or type .settings in WhatsApp anytime.',
          si: 'Bot සම්බන්ධ වූ විට ඔබේ WhatsApp වෙත ලැබෙන Password එක හෝ .settings විධානයෙන් ලැබෙන Password එක මෙහි යොදන්න.',
          ar: 'تُرسل تلقائيًا إلى محادثتك عند الاتصال أو عند إرسال الأمر .settings.'
        }
      },
      {
        badge: '3',
        title: {
          en: 'Sign In Button (Auto-Routes Across Cluster Servers)',
          si: 'Sign In බොත්තම',
          ar: 'زر تسجيل الدخول'
        },
        desc: {
          en: 'Automatically locates which server hosts your bot and opens your dashboard.',
          si: 'ඔබේ Bot කුමන සර්වරයේ තිබුණද ස්වයංක්‍රීයව හඳුනාගෙන ඔබේ Dashboard එක විවෘත කරයි.',
          ar: 'يتعرف تلقائيًا على الخادم الذي يستضيف البوت الخاص بك ويفتح لوحة التحكم.'
        }
      }
    ]
  },
  {
    id: 'panel-dashboard',
    stepNum: '09',
    chapter: {
      en: 'Panel · Status',
      si: 'Status සැකසුම් (Panel)',
      ar: 'إعدادات الحالة'
    },
    title: {
      en: 'Customize Status Auto-Seen, Reactions & Voice Replies',
      si: 'Status Auto-Seen, React Emojis සහ Voice Reply සැකසුම්',
      ar: 'تخصيص المشاهدة التلقائية للحالات والتفاعلات والرد الصوتي'
    },
    subtitle: {
      en: 'Once signed in, switch between dashboard tabs to configure automatic status viewing, emoji reactions, and voice notes.',
      si: 'Panel එකට ලොග් වූ පසු Status ස්වයංක්‍රීයව බැලීම (Auto-Seen), React වැටෙන Emoji වෙනස් කිරීම සහ Voice Reply පහසුවෙන් සකසා ගත හැක.',
      ar: 'بعد تسجيل الدخول، تنقل بين التبويبات لضبط مشاهدة الحالات والتفاعل بالرموز التعبيرية.'
    },
    pageUrl: '/panel',
    mobileImg: '/guide/mobile-09-panel-dashboard.webp',
    pcImg: '/guide/pc-09-panel-dashboard.webp',
    callouts: [
      {
        badge: '1',
        title: {
          en: 'Dashboard Navigation Tabs',
          si: 'පැනලයේ ප්‍රධාන කොටස් (Tabs)',
          ar: 'تبويبات لوحة التحكم'
        },
        desc: {
          en: 'Switch between Overview, Status & Voice, Auto-Replies, Schedule, and Bot Settings.',
          si: 'Overview, Status & Voice, Auto-Replies, Schedule සහ Bot Settings අතර මාරු වීමට මෙම Tabs භාවිතා කරන්න.',
          ar: 'تنقل بين نظرة عامة، الحالة والصوت، الردود التلقائية، الجدولة، وإعدادات البوت.'
        }
      },
      {
        badge: '2',
        title: {
          en: 'Auto Status View & Custom Reaction Emojis',
          si: 'Auto Status View සහ React Emojis',
          ar: 'مشاهدة الحالات تلقائيًا ورموز التفاعل'
        },
        desc: {
          en: 'Toggle automatic status viewing/liking and customize the exact emoji list your bot reacts with.',
          si: 'Status ඉබේම බැලීමට සහ ඔබ කැමති Emoji වලින් React වැටීමට මෙතැනින් සකසන්න.',
          ar: 'فعّل مشاهدة الحالات تلقائيًا وحدد قائمة الرموز التعبيرية المفضلة لديك.'
        }
      },
      {
        badge: '3',
        title: {
          en: 'Save Status Settings Button',
          si: 'Save බොත්තම',
          ar: 'زر حفظ الإعدادات'
        },
        desc: {
          en: 'Applies your new status settings to your live bot immediately without restarting.',
          si: 'ඔබ වෙනස් කළ සැකසුම් එසැණින් ක්‍රියාත්මක කිරීමට Save ක්ලික් කරන්න.',
          ar: 'يحفظ التغييرات ويطبقها على البوت مباشرة دون إعادة تشغيل.'
        }
      }
    ]
  },
  {
    id: 'panel-settings',
    stepNum: '10',
    chapter: {
      en: 'Panel · Bot Mode',
      si: 'Bot ප්‍රධාන සැකසුම්',
      ar: 'وضع البوت والحماية'
    },
    title: {
      en: 'Control Bot Access Mode, Anti-Delete & Presence',
      si: 'Bot ක්‍රියාත්මක වන ආකාරය (Public/Private) සහ Anti-Delete සැකසුම්',
      ar: 'التحكم في وضع الوصول واستعادة الرسائل المحذوفة'
    },
    subtitle: {
      en: 'Choose who can use your bot, enable deleted-message recovery, and manage auto-typing / read receipts.',
      si: 'Bot භාවිතා කළ හැක්කේ කාටද යන්න (Public / Private / Groups) සහ මකා දැමූ පණිවිඩ නැවත ලබාගැනීම (Anti-Delete) මෙතැනින් පාලනය කරන්න.',
      ar: 'حدد من يمكنه استخدام البوت وفعّل استعادة الرسائل المحذوفة ومؤشرات الكتابة.'
    },
    pageUrl: '/panel',
    mobileImg: '/guide/mobile-10-panel-settings.webp',
    pcImg: '/guide/pc-10-panel-settings.webp',
    callouts: [
      {
        badge: '1',
        title: {
          en: 'Bot Access Mode Selector (Public / Self / Groups / Inbox)',
          si: 'Bot Access Mode (Public / Self / Groups / Inbox)',
          ar: 'اختيار وضع وصول البوت'
        },
        desc: {
          en: 'Set whether everyone can use commands or only you (Self mode).',
          si: 'සියලු දෙනාටම Bot භාවිතා කළ හැකිද (Public) නැතහොත් ඔබට පමණක්ද (Self) යන්න තෝරන්න.',
          ar: 'حدد ما إذا كان البوت متاحًا للجميع أو لك فقط.'
        }
      },
      {
        badge: '2',
        title: {
          en: 'Anti-Delete, Always Online & Auto-Typing Switches',
          si: 'Anti-Delete, Always Online සහ Auto-Typing ස්විචයන්',
          ar: 'مفاتيح استعادة المحذوفات والظهور متصلًا'
        },
        desc: {
          en: 'Turn on Anti-Delete to recover deleted messages & media directly to your DM.',
          si: 'අන් අය මකා දමන පණිවිඩ (Delete for Everyone) ඔබේ අංකයට ගෙන්වා ගැනීමට Anti-Delete ක්‍රියාත්මක කරන්න.',
          ar: 'فعّل استعادة الرسائل المحذوفة لتصلك مباشرة في محادثتك الخاصة.'
        }
      },
      {
        badge: '3',
        title: {
          en: 'Command Prefix & Save Controls',
          si: 'Command Prefix (.) සහ Save බොත්තම',
          ar: 'بادئة الأوامر وحفظ التعديلات'
        },
        desc: {
          en: 'Customize your command prefix (default .) and save changes.',
          si: 'විධාන සඳහා භාවිතා කරන ලකුණ (උදා: .) වෙනස් කර Save කළ හැක.',
          ar: 'غيّر بادئة الأوامر واحفظ الإعدادات بضغطة واحدة.'
        }
      }
    ]
  },
  {
    id: 'faq',
    stepNum: '11',
    chapter: {
      en: 'FAQ & Help',
      si: 'නිතර අසන ප්‍රශ්න (FAQ)',
      ar: 'الأسئلة الشائعة'
    },
    title: {
      en: 'Find Instant Answers in the FAQ Page',
      si: 'ගැටලු සඳහා ක්ෂණික විසඳුම් — FAQ පිටුව (/faq)',
      ar: 'إجابات فورية لأشهر الأسئلة في صفحة الأسئلة الشائعة'
    },
    subtitle: {
      en: 'Have a question about pairing codes, passwords, or keeping your session active? Check /faq anytime.',
      si: 'Pairing කේතය, මුරපදය හෝ Bot භාවිතය ගැන ඔබට ඇති වන ඕනෑම ගැටලුවකට පිළිතුරු මෙහි ඇත.',
      ar: 'هل لديك سؤال حول رموز الربط أو كلمة المرور؟ ستجد الإجابة هنا.'
    },
    pageUrl: '/faq',
    mobileImg: '/guide/mobile-11-faq.webp',
    pcImg: '/guide/pc-11-faq.webp',
    callouts: [
      {
        badge: '1',
        title: {
          en: 'FAQ Search & Category Filters',
          si: 'ප්‍රශ්න සොයන තීරුව සහ කාණ්ඩ',
          ar: 'البحث وتصنيف الأسئلة الشائعة'
        },
        desc: {
          en: 'Filter questions by Pairing, Panel, Commands, or Safety.',
          si: 'Pairing, Panel, Commands හෝ Safety යන කාණ්ඩ යටතේ ප්‍රශ්න තෝරා බලන්න.',
          ar: 'صفِّ الأسئلة حسب الربط، لوحة التحكم، الأوامر، أو الأمان.'
        }
      },
      {
        badge: '2',
        title: {
          en: 'Expandable Answer Accordion Cards',
          si: 'පිළිතුරු විවෘත වන කාඩ්පත්',
          ar: 'بطاقات الأسئلة والأجوبة القابلة للفتح'
        },
        desc: {
          en: 'Tap any question to reveal a clear step-by-step solution.',
          si: 'ඕනෑම ප්‍රශ්නයක් මත ක්ලික් කළ විට එහි සම්පූර්ණ පිළිතුර දිස්වේ.',
          ar: 'اضغط على أي سؤال لعرض الإجابة التفصيلية.'
        }
      }
    ]
  },
  {
    id: 'about',
    stepNum: '12',
    chapter: {
      en: 'About & Support',
      si: 'අප ගැන (About)',
      ar: 'حول المنصة والدعم'
    },
    title: {
      en: 'Learn About RCD X MINI & Contact Support',
      si: 'RCD X MINI පිළිබඳ විස්තර සහ සහාය ලබාගැනීම (/about)',
      ar: 'تعرف على المنصة وفريق التطوير والدعم الفني'
    },
    subtitle: {
      en: 'Read about our platform features, community standards, and direct contact links for the DEXTER MODZ team.',
      si: 'අපගේ සේවාවේ විශේෂාංග සහ DEXTER MODZ කණ්ඩායම සම්බන්ධ කරගත හැකි නිල සබැඳි මෙහි ඇත.',
      ar: 'تعرف على مميزات المنصة وروابط التواصل المباشر مع فريق التطوير.'
    },
    pageUrl: '/about',
    mobileImg: '/guide/mobile-12-about.webp',
    pcImg: '/guide/pc-12-about.webp',
    callouts: [
      {
        badge: '1',
        title: {
          en: 'Platform Highlights & Multi-Server Reliability',
          si: 'සේවාවේ ප්‍රධාන විශේෂාංග',
          ar: 'أبرز مميزات المنصة واعتمادية الخوادم'
        },
        desc: {
          en: 'Overview of why thousands of users rely on RCD X MINI every day.',
          si: 'RCD X MINI සේවාවේ වේගය සහ විශ්වසනීයත්වය පිළිබඳ විස්තර.',
          ar: 'نظرة شاملة على سرعة واستقرار المنصة.'
        }
      },
      {
        badge: '2',
        title: {
          en: 'Direct Developer & Community Support Links',
          si: 'සංවර්ධක කණ්ඩායම සම්බන්ධ කරගැනීම',
          ar: 'روابط التواصل المباشر مع الدعم الفني'
        },
        desc: {
          en: 'Reach out on WhatsApp or jump straight to pairing your number.',
          si: 'ඕනෑම සහායක් සඳහා කෙලින්ම WhatsApp හරහා සම්බන්ධ වීමේ හැකියාව.',
          ar: 'تواصل معنا عبر واتساب لأي مساعدة فنية.'
        }
      }
    ]
  }
];

export default function GuidePage() {
  const { lang, t } = useLang();
  const [device, setDevice] = useState<'mobile' | 'pc'>('mobile');
  const [zoomItem, setZoomItem] = useState<{ src: string; title: string } | null>(null);

  return (
    <div className="flex flex-col gap-7">
      <section className="glass-card gradient-ring relative overflow-hidden rounded-3xl px-5 py-8 text-center sm:px-8 sm:py-10">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-amber-400/35 bg-amber-400/10 px-3.5 py-1 text-[11px] font-bold text-amber-300">
          <BookOpen className="h-3.5 w-3.5" />
          {t('guideBadge')}
        </div>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          {t('guideTitle')}
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-xs leading-relaxed text-slate-300 sm:text-sm">
          {t('guideSub')}
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-300">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[11px] font-extrabold text-black">
              1
            </span>
            {lang === 'si'
              ? 'රූපයේ කහ පැහැති කොටුව සහ ඉර මගින් අදාළ කොටස පෙන්වයි'
              : lang === 'ar'
              ? 'المربعات والخطوط الصفراء تشير إلى العنصر المشروح بالرقم'
              : 'Yellow highlight boxes & lines point to each numbered step'}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-slate-300">
            <ZoomIn className="h-3.5 w-3.5 text-emerald-400" />
            {t('clickToZoom')}
          </span>
        </div>
      </section>

      <div className="sticky top-[57px] z-30 flex flex-col gap-2.5 rounded-2xl border border-white/10 bg-[#070a10]/90 p-2.5 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex items-center justify-between gap-2 sm:justify-start">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {lang === 'si' ? 'තිරයේ වර්ගය:' : lang === 'ar' ? 'نوع الشاشة:' : 'Screen View:'}
          </span>
          <div className="inline-flex rounded-xl border border-white/10 bg-black/60 p-1">
            <button
              type="button"
              onClick={() => setDevice('mobile')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                device === 'mobile'
                  ? 'bg-emerald-400 text-black shadow-[0_2px_12px_-2px_rgba(52,211,153,0.6)]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              {t('deviceMobile')}
            </button>
            <button
              type="button"
              onClick={() => setDevice('pc')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                device === 'pc'
                  ? 'bg-emerald-400 text-black shadow-[0_2px_12px_-2px_rgba(52,211,153,0.6)]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
              {t('devicePc')}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
          {GUIDE_STEPS.map((s) => (
            <a
              key={s.id}
              href={`#step-${s.id}`}
              className="shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-200"
            >
              <span className="mr-1 font-mono text-amber-400">{s.stepNum}</span>
              {s.chapter[lang]}
            </a>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {GUIDE_STEPS.map((step) => {
          const activeImg = device === 'mobile' ? step.mobileImg : step.pcImg;
          return (
            <section
              key={step.id}
              id={`step-${step.id}`}
              className="glass-card gradient-ring scroll-mt-32 overflow-hidden rounded-3xl p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] pb-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-400/15 font-mono text-sm font-extrabold text-amber-300 shadow-[0_0_16px_-4px_rgba(250,204,21,0.4)]">
                    {step.stepNum}
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                        {step.chapter[lang]}
                      </span>
                      <Link
                        href={step.pageUrl}
                        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-slate-300 hover:border-emerald-400/40 hover:text-emerald-300"
                      >
                        {step.pageUrl}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                    </div>
                    <h2 className="mt-0.5 text-base font-extrabold text-white sm:text-lg">
                      {step.title[lang]}
                    </h2>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-black/40 p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setDevice('mobile')}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold transition ${
                      device === 'mobile'
                        ? 'bg-amber-400 text-black'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Smartphone className="h-3 w-3" /> Mobile
                  </button>
                  <button
                    type="button"
                    onClick={() => setDevice('pc')}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold transition ${
                      device === 'pc'
                        ? 'bg-amber-400 text-black'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Monitor className="h-3 w-3" /> PC
                  </button>
                </div>
              </div>

              <div
                className={`mt-5 grid items-start gap-6 ${
                  device === 'mobile'
                    ? 'lg:grid-cols-[1fr_340px]'
                    : 'lg:grid-cols-[1fr_480px]'
                }`}
              >
                <div className="flex flex-col gap-3.5">
                  <p className="text-xs leading-relaxed text-slate-300 sm:text-sm">
                    {step.subtitle[lang]}
                  </p>

                  <div className="flex flex-col gap-2.5">
                    {step.callouts.map((c) => (
                      <div
                        key={c.badge}
                        className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-black/35 p-3.5 transition hover:border-amber-400/35"
                      >
                        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400 font-mono text-xs font-extrabold text-black shadow-[0_0_12px_rgba(250,204,21,0.55)]">
                          {c.badge}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xs font-bold text-white sm:text-sm">
                            {c.title[lang]}
                          </h3>
                          <p className="mt-1 text-xs leading-relaxed text-slate-400">
                            {c.desc[lang]}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {step.tip && (
                    <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-200">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <span>{step.tip[lang]}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() =>
                      setZoomItem({
                        src: activeImg,
                        title: `${step.stepNum} · ${step.title[lang]} (${
                          device === 'mobile' ? 'Mobile' : 'PC / Laptop'
                        })`
                      })
                    }
                    className="group relative w-full overflow-hidden rounded-2xl border-2 border-amber-400/35 bg-[#05070b] shadow-[0_14px_40px_-12px_rgba(0,0,0,0.85)] transition hover:border-amber-400/70"
                  >
                    <img
                      src={activeImg}
                      alt={`${step.title[lang]} - ${device}`}
                      loading="lazy"
                      className={`mx-auto w-full object-contain transition duration-300 group-hover:scale-[1.015] ${
                        device === 'mobile' ? 'max-h-[560px]' : 'max-h-[420px]'
                      }`}
                    />
                    <div className="flex items-center justify-between border-t border-white/10 bg-black/80 px-3.5 py-2 text-[11px] text-slate-300">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-amber-300">
                        {device === 'mobile' ? (
                          <Smartphone className="h-3.5 w-3.5" />
                        ) : (
                          <Monitor className="h-3.5 w-3.5" />
                        )}
                        {device === 'mobile' ? t('deviceMobile') : t('devicePc')}
                      </span>
                      <span className="inline-flex items-center gap-1 text-slate-400 group-hover:text-white">
                        <ZoomIn className="h-3.5 w-3.5 text-emerald-400" />
                        {t('clickToZoom')}
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <section className="glass-card gradient-ring rounded-3xl p-6 text-center sm:p-8">
        <div className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-300">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h2 className="mt-3 text-lg font-extrabold text-white sm:text-xl">
          {lang === 'si'
            ? 'දැන්ම ඔබේ WhatsApp අංකය සම්බන්ධ කිරීමට සූදානම්ද?'
            : lang === 'ar'
            ? 'هل أنت مستعد لربط رقم واتساب الخاص بك الآن؟'
            : 'Ready to Connect Your WhatsApp Number?'}
        </h2>
        <p className="mx-auto mt-1.5 max-w-md text-xs text-slate-400 sm:text-sm">
          {lang === 'si'
            ? 'තත්පර 30 ක් ඇතුළත නොමිලේම ඔබේ Bot සම්බන්ධ කරගෙන සියලුම පහසුකම් අත්විඳින්න.'
            : lang === 'ar'
            ? 'اربط رقمك مجانًا في أقل من 30 ثانية واستمتع بجميع المميزات.'
            : 'Link your number in under 30 seconds and unlock all 150+ commands and status automation.'}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/connect"
            className="btn-shine inline-flex items-center gap-2 rounded-2xl px-6 py-2.5 text-xs font-bold text-black sm:text-sm"
          >
            {t('heroBtnConnect')} <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/faq"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-xs font-semibold text-slate-200 hover:border-white/25 sm:text-sm"
          >
            <HelpCircle className="h-4 w-4 text-cyan-300" /> {t('navFaq')}
          </Link>
        </div>
      </section>

      {zoomItem && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setZoomItem(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 backdrop-blur-md sm:p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-amber-400/40 bg-[#070a10] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-xs font-bold text-amber-300 sm:text-sm">
                {zoomItem.title}
              </span>
              <button
                type="button"
                onClick={() => setZoomItem(null)}
                className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" /> Close
              </button>
            </div>
            <div className="overflow-auto p-3 sm:p-5">
              <img
                src={zoomItem.src}
                alt={zoomItem.title}
                className="mx-auto max-h-[80vh] w-auto rounded-xl object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
