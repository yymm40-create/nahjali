# عاداتي الخارقة: كتيب العادات بالشخصية الكرتونية

المستخدم يرفع صورته، فتتحول لشخصية كرتونية ثلاثية الأبعاد، وتنحط الشخصية تلقائيًا في كتيب عادات يومية، ويحمّله PDF جاهز للطباعة. المواصفات الكاملة في `SPEC.md` (موجود في مجلد التنزيلات).

## التشغيل لأول مرة

### ١. Supabase
1. أنشئ مشروع جديد من [supabase.com](https://supabase.com).
2. افتح **SQL Editor**، والصق محتوى `supabase/migrations/0001_init.sql`، واضغط **Run**. هذا ينشئ الجداول، وصلاحيات RLS، وحاويات التخزين الخاصة.
3. **Project Settings → API** وانسخ منها:
   - `Project URL` ← `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` / `publishable` key ← `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` / `secret` key ← `SUPABASE_SERVICE_ROLE_KEY` (**سري**، لا تشاركه)
4. **تسجيل الدخول بجوجل:**
   - من [Google Cloud Console](https://console.cloud.google.com) ← APIs & Services ← Credentials ← Create OAuth client ID (نوعه Web application).
   - في Authorized redirect URIs حط: `https://<رمز-مشروعك>.supabase.co/auth/v1/callback`.
   - ارجع لـ Supabase ← **Authentication → Providers → Google**، فعّله والصق الـ Client ID والـ Secret.
   - **Authentication → URL Configuration**: خلّ Site URL هو `http://localhost:3000`، وأضف `http://localhost:3000/auth/callback` في Redirect URLs. لما ترفع الموقع أضف رابطه الحقيقي بنفس الطريقة.

### ٢. OpenAI
- من [platform.openai.com/api-keys](https://platform.openai.com/api-keys) أنشئ مفتاح ← `OPENAI_API_KEY` (**سري**).
- نماذج الصور تحتاج غالبًا توثيق المنظمة (Organization verification) من إعدادات الحساب، وتحتاج رصيد مدفوع.

### ٣. Moyasar (مؤجل)
- في المرحلة الحالية فيه زر "دفع تجريبي" بداله. يشتغل بس في بيئة التطوير، ويتحكم فيه `DEV_PAYMENT_ENABLED` في `config/pricing.ts`.
- المفاتيح لاحقًا من لوحة Moyasar ← Settings ← API Keys.

### ٤. التشغيل
```bash
cp .env.example .env.local   # وعبّي القيم
npm install
npm run dev                  # افتح http://localhost:3000
```

## الملفات اللي تعدّلها بنفسك
| الملف | وش فيه |
|---|---|
| `config/prompts.ts` | الستايل وأوامر توليد الشخصية والوضعيات، والنموذج والجودة |
| `config/pricing.ts` | السعر، وعدد المحاولات، وحد الطلبات، والدفع التجريبي، وتقدير التكلفة |
| `design/habits-v1/pages.html` | تصميم صفحات الكتيب (نصوص، ألوان، أماكن الشخصية) |

بعد تعديل التصميم شغّل:
```bash
npm run render-template -- habits-v1
```
يطلّع صور الصفحات بدقة 300 DPI، وملف `template.json`، وصور المعاينة للموقع.

**قالب جديد:** انسخ مجلد `design/habits-v1` باسم جديد، وعدّل فيه، وشغّل الأمر بالاسم الجديد. يظهر تلقائيًا في الموقع بدون أي تعديل في الكود.

## اختبار بدون مفاتيح
```bash
npx tsx scripts/test-compose.mts
```
يركّب كتيب تجريبي بأشكال بدل صور الذكاء الاصطناعي، ويحفظه في `tmp/test-booklet.pdf`.

## كيف يمشي الطلب
`pending_payment` ← `paid` ← `generating_character` ← `awaiting_approval` ← `generating_poses` ← `composing` ← `ready` (أو `failed`)

- كل صورة تتولد في طلب مستقل. صفحة `/progress` تطلب الوضعيات وحدة وحدة، وبعدها تطلب تركيب الـ PDF.
- كل خطوة مقفولة في قاعدة البيانات، فلو المستخدم فتح الصفحة في تبويبين ما تتكرر عملية التوليد.
- لو تعطل طلب في النص (مثلًا انتهى وقته)، يرجع يشتغل تلقائيًا بعد ٦ دقائق.
