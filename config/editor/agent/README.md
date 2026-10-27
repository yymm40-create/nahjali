# حيدرا ماكس كوكيل Claude (Managed Agent)

كل ملفات هذا المجلد **مولّدة** من كود المختبر (`src/lib/editor/scene/agent-spec.ts`) بالأمر:

```
npx vite-node -c vitest.config.mts scripts/export-haidara-agent.mts
```

| الملف | وش فيه |
|---|---|
| `haidara.powers.json` | **كل قوى حيدرة في مختبر الموشن** كـJSON: الأوضاع، قوالب إجاباته، الميزان (١٢ معيار)، عقد المشهد والكيت والصوت، المحظورات، الصيغ الفيروسية، معرض الخيارات، المونتاج على فيديو الشخص، الكفر، مهارات المالك، الأمثلة |
| `haidara.agent.json` | جسم `POST /v1/agents` (الاسم، النموذج، التعليمات، الأدوات) |
| `skills/haidara-lab/` | مهارة المختبر (الكيت وملفاته المرجعية) وتُرفع مع مهارات المالك الأربع |

إنشاء الوكيل في حسابك (مرة وحدة):

```
ANTHROPIC_API_KEY=sk-ant-… npx vite-node -c vitest.config.mts scripts/create-haidara-agent.mts --with-environment
```

`--dry` يعرض وش بيُرسل بدون ما يرفع شي. لتعديل الوكيل لاحقًا: `--update agent_…` (نسخة جديدة من نفس الوكيل).
بعدها ضع `CLAUDE_AGENT_ID` و`CLAUDE_ENVIRONMENT_ID` في بيئة الموقع.

الأدوات المخصصة الثلاث (`lab_render` و`lab_picture` و`lab_deliver`) تنفّذها صفحة المختبر في متصفح الشخص عبر قناة أحداث الجلسة.
