// «حيدرة كت» — the Arabic fonts people can pick for texts and captions: 100 families with open licences (most
// SIL OFL), each checked to load from its CDN with CORS and to draw joined Arabic on a canvas. A font is fetched only
// when a text uses it. Shared by the server (to accept a font id) and the page (to load it).

export const FONT_KINDS = {
  sans: "حديث",
  display: "عناوين",
  naskh: "نسخ",
  kufi: "كوفي",
  ruqaa: "رقعة",
  maghribi: "مغربي",
  handwriting: "يدوي ونستعليق",
  decorative: "زخرفي",
} as const;
export type FontKind = keyof typeof FONT_KINDS;

export interface FontFamily {
  id: string;
  /** the family's own name (its credits) */
  family: string;
  ar: string;
  kind: FontKind;
  /** the weights there are files for, each with its file */
  files: Partial<Record<400 | 700 | 900 | number, string>>;
  license: string;
}

type Row = [id: string, family: string, ar: string, kind: FontKind, weights: number[], urls: string[], license: string];

const ROWS: Row[] = [
  ["alan-sans", "Alan Sans", "آلان سانس", "sans", [400, 700, 900], ["https://cdn.jsdelivr.net/fontsource/fonts/alan-sans@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/alan-sans@latest/arabic-700-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/alan-sans@latest/arabic-900-normal.woff2"], "OFL-1.1"],
  ["alexandria", "Alexandria", "الإسكندرية", "sans", [400, 700, 900], ["https://cdn.jsdelivr.net/fontsource/fonts/alexandria@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/alexandria@latest/arabic-700-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/alexandria@latest/arabic-900-normal.woff2"], "OFL-1.1"],
  ["alkalami", "Alkalami", "القلمي", "maghribi", [400], ["https://cdn.jsdelivr.net/fontsource/fonts/alkalami@latest/arabic-400-normal.woff2"], "OFL-1.1"],
  ["almarai", "Almarai", "المراعي", "sans", [400, 700], ["https://cdn.jsdelivr.net/fontsource/fonts/almarai@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/almarai@latest/arabic-700-normal.woff2"], "OFL-1.1"],
  ["alyamama", "Alyamama", "اليمامة", "display", [400, 700, 900], ["https://cdn.jsdelivr.net/fontsource/fonts/alyamama@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/alyamama@latest/arabic-700-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/alyamama@latest/arabic-900-normal.woff2"], "OFL-1.1"],
  ["amiri", "Amiri", "أميري", "naskh", [400, 700], ["https://cdn.jsdelivr.net/fontsource/fonts/amiri@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/amiri@latest/arabic-700-normal.woff2"], "OFL-1.1"],
  ["amiri-quran", "Amiri Quran", "أميري قرآن", "naskh", [400], ["https://cdn.jsdelivr.net/fontsource/fonts/amiri-quran@latest/arabic-400-normal.woff2"], "OFL-1.1"],
  ["aref-ruqaa", "Aref Ruqaa", "رقعة عارف", "ruqaa", [400, 700], ["https://cdn.jsdelivr.net/fontsource/fonts/aref-ruqaa@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/aref-ruqaa@latest/arabic-700-normal.woff2"], "OFL-1.1"],
  ["aref-ruqaa-ink", "Aref Ruqaa Ink", "رقعة عارف ملوّن", "ruqaa", [400, 700], ["https://cdn.jsdelivr.net/fontsource/fonts/aref-ruqaa-ink@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/aref-ruqaa-ink@latest/arabic-700-normal.woff2"], "OFL-1.1"],
  ["badeen-display", "Badeen Display", "بديع", "display", [400], ["https://cdn.jsdelivr.net/fontsource/fonts/badeen-display@latest/arabic-400-normal.woff2"], "OFL-1.1"],
  ["baloo-bhaijaan-2", "Baloo Bhaijaan 2", "بالو بهايجان", "display", [400, 700], ["https://cdn.jsdelivr.net/fontsource/fonts/baloo-bhaijaan-2@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/baloo-bhaijaan-2@latest/arabic-700-normal.woff2"], "OFL-1.1"],
  ["beiruti", "Beiruti", "بيروتي", "sans", [400, 700, 900], ["https://cdn.jsdelivr.net/fontsource/fonts/beiruti@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/beiruti@latest/arabic-700-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/beiruti@latest/arabic-900-normal.woff2"], "OFL-1.1"],
  ["blaka", "Blaka", "بلاكا", "display", [400], ["https://cdn.jsdelivr.net/fontsource/fonts/blaka@latest/arabic-400-normal.woff2"], "OFL-1.1"],
  ["blaka-hollow", "Blaka Hollow", "بلاكا مفرّغ", "decorative", [400], ["https://cdn.jsdelivr.net/fontsource/fonts/blaka-hollow@latest/arabic-400-normal.woff2"], "OFL-1.1"],
  ["blaka-ink", "Blaka Ink", "بلاكا ملوّن", "decorative", [400], ["https://cdn.jsdelivr.net/fontsource/fonts/blaka-ink@latest/arabic-400-normal.woff2"], "OFL-1.1"],
  ["cairo", "Cairo", "القاهرة", "sans", [400, 700, 900], ["https://cdn.jsdelivr.net/fontsource/fonts/cairo@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/cairo@latest/arabic-700-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/cairo@latest/arabic-900-normal.woff2"], "OFL-1.1"],
  ["cairo-play", "Cairo Play", "القاهرة بلاي", "sans", [400, 700, 900], ["https://cdn.jsdelivr.net/fontsource/fonts/cairo-play@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/cairo-play@latest/arabic-700-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/cairo-play@latest/arabic-900-normal.woff2"], "OFL-1.1"],
  ["cascadia-code", "Cascadia Code", "كاسكاديا", "sans", [400, 700], ["https://cdn.jsdelivr.net/fontsource/fonts/cascadia-code@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/cascadia-code@latest/arabic-700-normal.woff2"], "OFL-1.1"],
  ["changa", "Changa", "تشانغا", "sans", [400, 700], ["https://cdn.jsdelivr.net/fontsource/fonts/changa@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/changa@latest/arabic-700-normal.woff2"], "OFL-1.1"],
  ["el-messiri", "El Messiri", "المسيري", "display", [400, 700], ["https://cdn.jsdelivr.net/fontsource/fonts/el-messiri@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/el-messiri@latest/arabic-700-normal.woff2"], "OFL-1.1"],
  ["estedad", "Estedad", "استعداد", "sans", [400, 700, 900], ["https://cdn.jsdelivr.net/fontsource/fonts/estedad@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/estedad@latest/arabic-700-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/estedad@latest/arabic-900-normal.woff2"], "OFL-1.1"],
  ["fustat", "Fustat", "الفسطاط", "sans", [400, 700], ["https://cdn.jsdelivr.net/fontsource/fonts/fustat@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/fustat@latest/arabic-700-normal.woff2"], "OFL-1.1"],
  ["gulzar", "Gulzar", "گلزار نستعليق", "handwriting", [400], ["https://cdn.jsdelivr.net/fontsource/fonts/gulzar@latest/arabic-400-normal.woff2"], "OFL-1.1"],
  ["handjet", "Handjet", "هاندجت", "decorative", [400, 700, 900], ["https://cdn.jsdelivr.net/fontsource/fonts/handjet@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/handjet@latest/arabic-700-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/handjet@latest/arabic-900-normal.woff2"], "OFL-1.1"],
  ["harmattan", "Harmattan", "هرمتان", "naskh", [400, 700], ["https://cdn.jsdelivr.net/fontsource/fonts/harmattan@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/harmattan@latest/arabic-700-normal.woff2"], "OFL-1.1"],
  ["ibm-plex-sans-arabic", "IBM Plex Sans Arabic", "بلكس عربي", "sans", [400, 700], ["https://cdn.jsdelivr.net/fontsource/fonts/ibm-plex-sans-arabic@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/ibm-plex-sans-arabic@latest/arabic-700-normal.woff2"], "OFL-1.1"],
  ["jomhuria", "Jomhuria", "جمهورية", "display", [400], ["https://cdn.jsdelivr.net/fontsource/fonts/jomhuria@latest/arabic-400-normal.woff2"], "OFL-1.1"],
  ["katibeh", "Katibeh", "كتيبة", "display", [400], ["https://cdn.jsdelivr.net/fontsource/fonts/katibeh@latest/arabic-400-normal.woff2"], "OFL-1.1"],
  ["kufam", "Kufam", "كوفام", "kufi", [400, 700, 900], ["https://cdn.jsdelivr.net/fontsource/fonts/kufam@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/kufam@latest/arabic-700-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/kufam@latest/arabic-900-normal.woff2"], "OFL-1.1"],
  ["lalezar", "Lalezar", "لاله‌زار", "display", [400], ["https://cdn.jsdelivr.net/fontsource/fonts/lalezar@latest/arabic-400-normal.woff2"], "OFL-1.1"],
  ["lateef", "Lateef", "لطيف", "naskh", [400, 700], ["https://cdn.jsdelivr.net/fontsource/fonts/lateef@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/lateef@latest/arabic-700-normal.woff2"], "OFL-1.1"],
  ["lemonada", "Lemonada", "ليمونادة", "display", [400, 700], ["https://cdn.jsdelivr.net/fontsource/fonts/lemonada@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/lemonada@latest/arabic-700-normal.woff2"], "OFL-1.1"],
  ["mada", "Mada", "مدى", "sans", [400, 700, 900], ["https://cdn.jsdelivr.net/fontsource/fonts/mada@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/mada@latest/arabic-700-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/mada@latest/arabic-900-normal.woff2"], "OFL-1.1"],
  ["marhey", "Marhey", "مرحى", "display", [400, 700], ["https://cdn.jsdelivr.net/fontsource/fonts/marhey@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/marhey@latest/arabic-700-normal.woff2"], "OFL-1.1"],
  ["markazi-text", "Markazi Text", "مركزي", "naskh", [400, 700], ["https://cdn.jsdelivr.net/fontsource/fonts/markazi-text@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/markazi-text@latest/arabic-700-normal.woff2"], "OFL-1.1"],
  ["mirza", "Mirza", "ميرزا", "naskh", [400, 700], ["https://cdn.jsdelivr.net/fontsource/fonts/mirza@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/mirza@latest/arabic-700-normal.woff2"], "OFL-1.1"],
  ["noto-kufi-arabic", "Noto Kufi Arabic", "نوتو كوفي", "kufi", [400, 700, 900], ["https://cdn.jsdelivr.net/fontsource/fonts/noto-kufi-arabic@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/noto-kufi-arabic@latest/arabic-700-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/noto-kufi-arabic@latest/arabic-900-normal.woff2"], "OFL-1.1"],
  ["noto-naskh-arabic", "Noto Naskh Arabic", "نوتو نسخ", "naskh", [400, 700], ["https://cdn.jsdelivr.net/fontsource/fonts/noto-naskh-arabic@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/noto-naskh-arabic@latest/arabic-700-normal.woff2"], "OFL-1.1"],
  ["noto-nastaliq-urdu", "Noto Nastaliq Urdu", "نوتو نستعليق", "handwriting", [400, 700], ["https://cdn.jsdelivr.net/fontsource/fonts/noto-nastaliq-urdu@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/noto-nastaliq-urdu@latest/arabic-700-normal.woff2"], "OFL-1.1"],
  ["noto-sans-arabic", "Noto Sans Arabic", "نوتو سانس", "sans", [400, 700, 900], ["https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-arabic@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-arabic@latest/arabic-700-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-arabic@latest/arabic-900-normal.woff2"], "OFL-1.1"],
  ["oi", "Oi", "أوي", "display", [400], ["https://cdn.jsdelivr.net/fontsource/fonts/oi@latest/arabic-400-normal.woff2"], "OFL-1.1"],
  ["parastoo", "Parastoo", "پرستو", "naskh", [400, 700], ["https://cdn.jsdelivr.net/fontsource/fonts/parastoo@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/parastoo@latest/arabic-700-normal.woff2"], "OFL-1.1"],
  ["playpen-sans-arabic", "Playpen Sans Arabic", "بلاي بن", "handwriting", [400, 700], ["https://cdn.jsdelivr.net/fontsource/fonts/playpen-sans-arabic@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/playpen-sans-arabic@latest/arabic-700-normal.woff2"], "OFL-1.1"],
  ["qahiri", "Qahiri", "قاهري", "kufi", [400], ["https://cdn.jsdelivr.net/fontsource/fonts/qahiri@latest/arabic-400-normal.woff2"], "OFL-1.1"],
  ["rakkas", "Rakkas", "رقّاص", "display", [400], ["https://cdn.jsdelivr.net/fontsource/fonts/rakkas@latest/arabic-400-normal.woff2"], "OFL-1.1"],
  ["readex-pro", "Readex Pro", "ريدكس", "sans", [400, 700], ["https://cdn.jsdelivr.net/fontsource/fonts/readex-pro@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/readex-pro@latest/arabic-700-normal.woff2"], "OFL-1.1"],
  ["reem-kufi", "Reem Kufi", "ريم كوفي", "kufi", [400, 700], ["https://cdn.jsdelivr.net/fontsource/fonts/reem-kufi@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/reem-kufi@latest/arabic-700-normal.woff2"], "OFL-1.1"],
  ["reem-kufi-fun", "Reem Kufi Fun", "ريم كوفي مرح", "decorative", [400, 700], ["https://cdn.jsdelivr.net/fontsource/fonts/reem-kufi-fun@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/reem-kufi-fun@latest/arabic-700-normal.woff2"], "OFL-1.1"],
  ["reem-kufi-ink", "Reem Kufi Ink", "ريم كوفي ملوّن", "decorative", [400], ["https://cdn.jsdelivr.net/fontsource/fonts/reem-kufi-ink@latest/arabic-400-normal.woff2"], "OFL-1.1"],
  ["rubik", "Rubik", "روبيك", "sans", [400, 700, 900], ["https://cdn.jsdelivr.net/fontsource/fonts/rubik@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/rubik@latest/arabic-700-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/rubik@latest/arabic-900-normal.woff2"], "OFL-1.1"],
  ["ruwudu", "Ruwudu", "رودو", "maghribi", [400, 700], ["https://cdn.jsdelivr.net/fontsource/fonts/ruwudu@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/ruwudu@latest/arabic-700-normal.woff2"], "OFL-1.1"],
  ["scheherazade-new", "Scheherazade New", "شهرزاد", "naskh", [400, 700], ["https://cdn.jsdelivr.net/fontsource/fonts/scheherazade-new@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/scheherazade-new@latest/arabic-700-normal.woff2"], "OFL-1.1"],
  ["tajawal", "Tajawal", "تجوال", "sans", [400, 700, 900], ["https://cdn.jsdelivr.net/fontsource/fonts/tajawal@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/tajawal@latest/arabic-700-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/tajawal@latest/arabic-900-normal.woff2"], "OFL-1.1"],
  ["vazirmatn", "Vazirmatn", "وزیرمتن", "sans", [400, 700, 900], ["https://cdn.jsdelivr.net/fontsource/fonts/vazirmatn@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/vazirmatn@latest/arabic-700-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/vazirmatn@latest/arabic-900-normal.woff2"], "OFL-1.1"],
  ["vibes", "Vibes", "فايبز", "decorative", [400], ["https://cdn.jsdelivr.net/fontsource/fonts/vibes@latest/arabic-400-normal.woff2"], "OFL-1.1"],
  ["zain", "Zain", "زين", "sans", [400, 700, 900], ["https://cdn.jsdelivr.net/fontsource/fonts/zain@latest/arabic-400-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/zain@latest/arabic-700-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/zain@latest/arabic-900-normal.woff2"], "OFL-1.1"],
  ["sahel", "Sahel", "ساحل", "sans", [400, 700, 900], ["https://cdn.jsdelivr.net/npm/sahel-font@3.4.0/dist/Sahel.woff2", "https://cdn.jsdelivr.net/npm/sahel-font@3.4.0/dist/Sahel-Bold.woff2", "https://cdn.jsdelivr.net/npm/sahel-font@3.4.0/dist/Sahel-Black.woff2"], "OFL-1.1"],
  ["samim", "Samim", "صمیم", "sans", [400, 700], ["https://cdn.jsdelivr.net/npm/samim-font@4.0.5/dist/Samim.woff2", "https://cdn.jsdelivr.net/npm/samim-font@4.0.5/dist/Samim-Bold.woff2"], "OFL-1.1 (Arabic) + Bitstream Vera/Apache-2.0 (Latin)"],
  ["shabnam", "Shabnam", "شبنم", "sans", [400, 700], ["https://cdn.jsdelivr.net/npm/shabnam-font@5.0.0/dist/Shabnam.woff2", "https://cdn.jsdelivr.net/npm/shabnam-font@5.0.0/dist/Shabnam-Bold.woff2"], "OFL-1.1 (Arabic) + Bitstream Vera/Apache-2.0 (Latin)"],
  ["tanha", "Tanha", "تنها", "sans", [400], ["https://cdn.jsdelivr.net/npm/tanha-font@0.10.0/dist/Tanha.woff2"], "Bitstream Vera + Public Domain changes (+ Apache-2.0 Latin)"],
  ["gandom", "Gandom", "گندم", "sans", [400], ["https://cdn.jsdelivr.net/npm/gandom-font@0.8.0/dist/Gandom.woff2"], "OFL-1.1 (Arabic) + Bitstream Vera/Apache-2.0 (Latin)"],
  ["nahid", "Nahid", "ناهید", "sans", [400], ["https://cdn.jsdelivr.net/npm/nahid-font@0.3.0/dist/Nahid.woff2"], "Bitstream Vera + Public Domain changes"],
  ["vazir-code", "Vazir Code", "وزیرکد", "sans", [400], ["https://cdn.jsdelivr.net/npm/vazir-code-font@1.1.2/dist/Vazir-Code.woff2"], "Bitstream Vera + Public Domain changes"],
  ["nafees-nastaleeq", "Nafees Nastaleeq", "نفیس نستعلیق", "handwriting", [400], ["https://cdn.jsdelivr.net/npm/nafees-nastaliq@1.0.0/fonts/nafees-nastaliq-v1.2.woff2"], "CRULP Nafees license (free, redistributable, MIT-style)"],
  ["mikhak", "Mikhak", "میخک", "handwriting", [400, 700, 900], ["https://cdn.jsdelivr.net/gh/aminabedi68/Mikhak@9dea055eb3dfc752879442224460c6e5d6ebe232/fonts/webfonts/statics/Mikhak-Regular.woff2", "https://cdn.jsdelivr.net/gh/aminabedi68/Mikhak@9dea055eb3dfc752879442224460c6e5d6ebe232/fonts/webfonts/statics/Mikhak-Bold.woff2", "https://cdn.jsdelivr.net/gh/aminabedi68/Mikhak@9dea055eb3dfc752879442224460c6e5d6ebe232/fonts/webfonts/statics/Mikhak-Black.woff2"], "OFL-1.1"],
  ["azarmehr-mono", "AzarMehr Monospaced Sans", "آذرمهر", "sans", [400, 700], ["https://cdn.jsdelivr.net/gh/aminabedi68/AzarMehrMonospaced@cf10e052b7f7ddc9d8c5f599161d44caf198041a/Sans/Font/AzarMehrMonospacedSansRegular.ttf", "https://cdn.jsdelivr.net/gh/aminabedi68/AzarMehrMonospaced@cf10e052b7f7ddc9d8c5f599161d44caf198041a/Sans/Font/AzarMehrMonospacedSansBold.ttf"], "OFL-1.1"],
  ["behdad", "Behdad", "بهداد", "sans", [400], ["https://cdn.jsdelivr.net/gh/font-store/BehdadFont@7c302bb454eef288edbaf67792d3f4e5abb91f24/dist/Behdad-Regular.woff2"], "OFL-1.1"],
  ["nika", "Nika", "نیکا", "naskh", [400], ["https://cdn.jsdelivr.net/gh/font-store/NikaFont@476b4ab5d2aa2b7466a1141618bd4ffcaf39cdd1/dist/Nika-Regular.woff2"], "OFL-1.1"],
  ["ganjnameh-sans", "Ganjnameh Sans", "گنجنامه", "sans", [400], ["https://cdn.jsdelivr.net/gh/font-store/GanjnamehFont@a005bc1c065548cbaa4918d4dfe9c108125e60aa/dist/GanjNamehSans-Regular.woff2"], "OFL-1.1"],
  ["farbod", "Farbod", "فربد", "naskh", [400], ["https://cdn.jsdelivr.net/gh/font-store/FarbodFont@6ec04f80e9fd7a444a40a70360d5e71a9c827adf/dist/Farbod-Regular.woff2"], "OFL-1.1"],
  ["shahab", "Shahab", "شهاب", "sans", [400], ["https://cdn.jsdelivr.net/gh/font-store/ShahabFont@bbacdcfa339d442d0739dab31369749f786e3f35/dist/Shahab-Regular.woff2"], "OFL-1.1"],
  ["noon", "Noon", "نون", "naskh", [400], ["https://cdn.jsdelivr.net/gh/font-store/NoonFont@6a720e65c22f8301b7e538317dafb2f7b623898a/dist/Noon-Regular.woff2"], "OFL-1.1"],
  ["milad-azad", "Milad Azad", "میلاد آزاد", "sans", [400], ["https://cdn.jsdelivr.net/gh/font-store/font-MiladAzad@59f634ef38e23a060ab441f4212b949a13132394/dist/MiladAzad-Regular.woff2"], "OFL-1.1"],
  ["vizheh-azad", "Vizheh Azad", "ویژه آزاد", "sans", [400], ["https://cdn.jsdelivr.net/gh/font-store/font-VizhehAzad@e82a39ff57f8fcc714c8d924893fd342ed8234b2/dist/VizhehAzad-Regular.woff2"], "OFL-1.1"],
  ["iran-nastaliq", "IranNastaliq", "ایران نستعلیق", "handwriting", [400], ["https://cdn.jsdelivr.net/gh/font-store/font-IranNastaliq@78bdb48a0d951fe309c5818da05c45d443f6685f/WebFonts/IranNastaliq-Web.woff2"], "OFL-1.1 (per font-store repo)"],
  ["iranian-sans", "Iranian Sans", "ایرانیان سانس", "sans", [400, 700], ["https://cdn.jsdelivr.net/gh/font-store/font-Iranian@dbce4f0357916aab48cf8239594e2df32a59be7f/Web-fonts/IranianSans/IranianSansWeb-Regular.woff", "https://cdn.jsdelivr.net/gh/font-store/font-Iranian@dbce4f0357916aab48cf8239594e2df32a59be7f/Web-fonts/IranianSans/IranianSansWeb-Bold.woff"], "OFL-1.1"],
  ["iranian-serif", "Iranian Serif", "ایرانیان سریف", "naskh", [400], ["https://cdn.jsdelivr.net/gh/font-store/font-Iranian@dbce4f0357916aab48cf8239594e2df32a59be7f/Web-fonts/IranianSerif/IranianSerifWeb-Regular.woff"], "OFL-1.1"],
  ["amiri-typewriter", "Amiri Typewriter", "أميري طابعة", "naskh", [400, 700], ["https://cdn.jsdelivr.net/gh/aliftype/amiri-typewriter@45b75f0046b00530ace29aa95c5bf8a85b73583e/AmiriTypewriter-Regular.ttf", "https://cdn.jsdelivr.net/gh/aliftype/amiri-typewriter@45b75f0046b00530ace29aa95c5bf8a85b73583e/AmiriTypewriter-Bold.ttf"], "OFL-1.1"],
  ["hussaini-nastaleeq", "Hussaini Nastaleeq", "حسيني نستعليق", "handwriting", [400], ["https://cdn.jsdelivr.net/gh/aliftype/hussaini-nastaleeq@38abe87d17218f3c1b9edeef6cfd2aa9396910f9/hussaini-nastaleeq.ttf"], "CRULP Nafees license (free, redistributable, MIT-style)"],
  ["sahl-naskh", "Sahl Naskh", "سهل نسخ", "naskh", [400, 700], ["https://cdn.jsdelivr.net/gh/khaledhosny/sahl-naskh@aff8af05bb9b730367d52cb752a77661faa35b22/webfonts/sahlnaskh-regular.ttf", "https://cdn.jsdelivr.net/gh/khaledhosny/sahl-naskh@aff8af05bb9b730367d52cb752a77661faa35b22/webfonts/sahlnaskh-bold.ttf"], "Apache-2.0"],
  ["droid-arabic-kufi", "Droid Arabic Kufi", "درويد كوفي", "kufi", [400], ["https://cdn.jsdelivr.net/gh/TahseenAlaa/Droid-Arabic-Kufi@43e75f5b70b73fa2a78abb9a56d6c25bc00cc5bb/DroidArabicKufi/DroidKufi-Regular.ttf"], "Apache-2.0"],
  ["kitab", "Kitab", "كتاب", "naskh", [400, 700], ["https://cdn.jsdelivr.net/gh/nuqayah/kitab-font@6f52ec09833744e1158b10e887b57447977b5f6e/Kitab-Regular.ttf", "https://cdn.jsdelivr.net/gh/nuqayah/kitab-font@6f52ec09833744e1158b10e887b57447977b5f6e/Kitab-Bold.ttf"], "OFL-1.1"],
  ["arad", "Arad", "آراد", "sans", [400, 700, 900], ["https://cdn.jsdelivr.net/gh/MohamadDarvishi/Arad@76121ab5a3f4478f16a3c1790e132631b34afa8e/Fonts/Main_Fonts/Static_Webfont/Arad-Regular.woff2", "https://cdn.jsdelivr.net/gh/MohamadDarvishi/Arad@76121ab5a3f4478f16a3c1790e132631b34afa8e/Fonts/Main_Fonts/Static_Webfont/Arad-Bold.woff2", "https://cdn.jsdelivr.net/gh/MohamadDarvishi/Arad@76121ab5a3f4478f16a3c1790e132631b34afa8e/Fonts/Main_Fonts/Static_Webfont/Arad-Black.woff2"], "OFL-1.1"],
  ["ario", "Ario", "آریو", "display", [400], ["https://cdn.jsdelivr.net/gh/MohamadDarvishi/Ario@42509b0eaba8a755f614c84e05fd8737956a3d45/Fonts/Main_Fonts/Webfonts/Ario-Dots1.woff2"], "OFL-1.1"],
  ["rooyin", "Rooyin", "رویین", "decorative", [400, 700], ["https://cdn.jsdelivr.net/gh/MohamadDarvishi/Rooyin@34547205edfc77a11eebe1f9bd20de849870729f/Fonts/Webfont/RooyinFree-Regular.woff2", "https://cdn.jsdelivr.net/gh/MohamadDarvishi/Rooyin@34547205edfc77a11eebe1f9bd20de849870729f/Fonts/Webfont/RooyinFree-Bold.woff2"], "OFL-1.1"],
  ["sorena", "Sorena", "سورنا", "decorative", [400], ["https://cdn.jsdelivr.net/gh/MDarvishi5124/Sorena@9584c01c2d384ea1ced74455dede7082620b68c4/Fonts/webfont/Sorena-Normal.woff2"], "OFL-1.1"],
  ["unixel", "Unixel", "یونیکسل", "decorative", [400], ["https://cdn.jsdelivr.net/gh/MDarvishi5124/Unixel@8b826de3f93d5981df9bdf6d471fd694d909f5a5/font/unixel-Regular.woff2"], "OFL-1.1"],
  ["estedad-mad", "Estedad Mad", "استعداد مد", "display", [400], ["https://cdn.jsdelivr.net/gh/MDarvishi5124/Estedad-Mad@770472f2d9f420610ccdf0b6c33584b73060fe51/Fonts/Estedad-Mad.woff2"], "OFL-1.1"],
  ["montserrat-arabic", "Montserrat Arabic", "مونتسرات عربي", "sans", [400, 700, 900], ["https://cdn.jsdelivr.net/gh/typeagm/Montserrat-Arabic@24c709a6483704dc2968b9edd3d92e5f63dd3dff/fonts/WEB/Montserrat-Arabic-Regular.woff2", "https://cdn.jsdelivr.net/gh/typeagm/Montserrat-Arabic@24c709a6483704dc2968b9edd3d92e5f63dd3dff/fonts/WEB/Montserrat-Arabic-Bold.woff2", "https://cdn.jsdelivr.net/gh/typeagm/Montserrat-Arabic@24c709a6483704dc2968b9edd3d92e5f63dd3dff/fonts/WEB/Montserrat-Arabic-Black.woff2"], "OFL-1.1"],
  ["zad", "Zad", "زاد", "sans", [400, 700], ["https://cdn.jsdelivr.net/gh/ahmedvnabil/zad-font@ada212f85083d468665ba20eaa6eaf5a51a91a83/fonts/Zad-Regular.woff2", "https://cdn.jsdelivr.net/gh/ahmedvnabil/zad-font@ada212f85083d468665ba20eaa6eaf5a51a91a83/fonts/Zad-Bold.woff2"], "OFL-1.1"],
  ["sepehr", "Sepehr", "سپهر", "sans", [400, 700], ["https://cdn.jsdelivr.net/gh/googlefonts/sepehr-fonts@90f5da4017f0ed91867b74c60954cafd8568bd7a/fonts/Sepehr-Regular.ttf", "https://cdn.jsdelivr.net/gh/googlefonts/sepehr-fonts@90f5da4017f0ed91867b74c60954cafd8568bd7a/fonts/Sepehr-Bold.ttf"], "OFL-1.1"],
  ["ulduz", "Ulduz", "اولدوز", "display", [400], ["https://cdn.jsdelivr.net/gh/zoha-fontgraph/Ulduz@8370f6bf02b9c866b16b5a19ab65357e0fc9dcac/Ulduz.ttf"], "OFL-1.1"],
  ["dongol", "Dongol", "دونجل", "display", [400], ["https://cdn.jsdelivr.net/gh/ahmedsamy-forks/dongol-font@9ed84fb763abc5bd81e3d95e1b888a83df4c167d/fonts/Dongol-Regular.ttf"], "OFL-1.1"],
  ["beaconhouse-nastaliq", "Beaconhouse Nastaliq", "بیکن‌ہاؤس نستعلیق", "handwriting", [400], ["https://cdn.jsdelivr.net/gh/BSS-codeoutsourced/Beaconhouse-Nastaliq@8390cb78132571848d6e41f4f0de1220141b77c0/fonts/BeaconhouseNastaliq-Regular.ttf"], "OFL-1.1"],
  ["mehr-nastaliq", "Mehr Nastaliq", "مہر نستعلیق", "handwriting", [400], ["https://cdn.jsdelivr.net/gh/abbassiddiqi/mehr@46562a135796bb3feaf6aa79de9e08206a9d3e34/mehr.woff"], "CC-BY-SA-4.0 (attribution required)"],
  ["vazirmatn-rd", "Vazirmatn RD", "وزیرمتن نقطه‌گرد", "sans", [400, 700, 900], ["https://cdn.jsdelivr.net/npm/vazirmatn@33.0.3/Round-Dots/fonts/webfonts/Vazirmatn-RD-Regular.woff2", "https://cdn.jsdelivr.net/npm/vazirmatn@33.0.3/Round-Dots/fonts/webfonts/Vazirmatn-RD-Bold.woff2", "https://cdn.jsdelivr.net/npm/vazirmatn@33.0.3/Round-Dots/fonts/webfonts/Vazirmatn-RD-Black.woff2"], "OFL-1.1"],
  ["leraw", "Leraw", "لەراو", "sans", [400, 700, 900], ["https://cdn.jsdelivr.net/gh/iolitetech/Leraw@acdea2a8a1243e4a125baf8e04af2155ee336470/fonts/static/Leraw-Regular.ttf", "https://cdn.jsdelivr.net/gh/iolitetech/Leraw@acdea2a8a1243e4a125baf8e04af2155ee336470/fonts/static/Leraw-Bold.ttf", "https://cdn.jsdelivr.net/gh/iolitetech/Leraw@acdea2a8a1243e4a125baf8e04af2155ee336470/fonts/static/Leraw-Black.ttf"], "OFL-1.1"],
  ["kawkab-mono", "Kawkab Mono", "كوكب مونو", "sans", [400, 700], ["https://cdn.jsdelivr.net/npm/typeface-kawkabmono@1.0.0/fonts/KawkabMono-Regular.woff2", "https://cdn.jsdelivr.net/npm/typeface-kawkabmono@1.0.0/fonts/KawkabMono-Bold.woff2"], "OFL-1.1"],
  ["dejavu-sans", "DejaVu Sans", "ديجا فو", "sans", [400, 700], ["https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf", "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf"], "Bitstream Vera License + Public Domain (DejaVu changes)"],
  ["hayyan", "Hayyan", "حیان", "decorative", [400], ["https://cdn.jsdelivr.net/gh/Azadfont/Hayyan@cb943a66c94dd8ec6b1155082f93bb28b5167d95/Fonts/Hayyantest27-Regular.ttf"], "OFL-1.1"]
];

export const FONT_LIST: FontFamily[] = ROWS.map(([id, family, ar, kind, weights, urls, license]) => ({ id, family, ar, kind, files: Object.fromEntries(weights.map((w, i) => [w, urls[i]])), license }));
export const FONT_BY_ID = new Map(FONT_LIST.map((f) => [f.id, f]));

/** The page's own three fonts (always there) and the catalogue's. */
export const BUILTIN_FONTS = ["readex", "naskh", "kufi"] as const;
export const isFont = (s: unknown): s is string => typeof s === "string" && ((BUILTIN_FONTS as readonly string[]).includes(s) || FONT_BY_ID.has(s));

/** The file closest to a weight (a font with only a regular weight serves all). */
export function fontFile(f: FontFamily, weight: number) {
  const ws = Object.keys(f.files).map(Number);
  const w = ws.reduce((best, x) => (Math.abs(x - weight) < Math.abs(best - weight) ? x : best), ws[0]);
  return { weight: w, url: f.files[w]! };
}
