# «صوت الجواد» — محرك حبيبي على خادمك

محرك الصوت العربي الخاص بالموقع: نموذج **Habibi-TTS** (جامعة شنغهاي جياو تونغ، يناير 2026، مبني على F5-TTS) يتكلم العربية بلهجاتها من بصمة صوت قصيرة. يعمل على كرت GPU سحابي يستيقظ عند الطلب وينام بعده.

## الملفات
- `handler.py` — واجهة Hugging Face Inference Endpoints (`EndpointHandler`): تستقبل `ref_audio_url` و`ref_text` و`gen_text` و`dialect` وترجع WAV بـ base64.
- `requirements.txt` — الحزم.

## النشر (مرة واحدة، نحو ١٠ دقائق)
1. أنشئ مستودع نموذج على Hugging Face (خاص)، وارفع فيه `handler.py` و`requirements.txt`.
2. من [Inference Endpoints](https://ui.endpoints.huggingface.co): **New endpoint** ← اختر المستودع ← Task: **Custom** ← الكرت: **NVIDIA L4** (أو A10G) ← **Scale to zero** بعد ١٥ دقيقة ← Protected.
3. أول طلب بعد النوم يأخذ دقيقة أو دقيقتين (تحميل النماذج من `SWivid/Habibi-TTS`).
4. في Vercel أضف:
   - `HABIBI_URL` = عنوان النقطة (ينتهي بـ `/`)
   - `HABIBI_TOKEN` = توكن Hugging Face (قراءة)
   - اختياري: `HABIBI_DEFAULT_MODEL=Specialized` و`HABIBI_DEFAULT_DIALECT=MSA` (كل النماذج المستخدمة حينها Apache 2.0).

بدون `HABIBI_URL` يتكلم الموقع بمحرك Chatterbox عبر fal (نفس `FAL_KEY`)، وتبقى البصمات نفسها صالحة.

## الرخص (قرارها للمالك)
| النموذج | الرخصة |
|---|---|
| الفصحى MSA · مصري EGY · عراقي IRQ · جزائري ALG · مغربي MAR | Apache 2.0 — تجاري |
| الموحّد Unified · سعودي SAU · إماراتي UAE | CC-BY-NC-SA-4.0 — غير تجاري (بيانات SADA وMixat) |
| الكود | MIT |

## الاختبار محليًا (يحتاج GPU)
```bash
pip install -r requirements.txt
python - <<'EOF'
from handler import EndpointHandler
h = EndpointHandler()
r = h({"inputs": {"ref_audio_url": "https://…/ref.wav", "ref_text": "النص المقروء في التسجيل", "gen_text": "مرحبًا، هذا صوتي بعد البصمة.", "dialect": "MSA"}})
open("out.wav", "wb").write(__import__("base64").b64decode(r["audio_base64"]))
EOF
```

## التكلفة التقريبية
L4 بنحو دولار للساعة وهو يعمل فقط. دقيقة كلام تأخذ نحو ١٥–٢٥ ثانية من الكرت، أي نحو نصف سنت للدقيقة، غير دقيقة الاستيقاظ.

مراجع: [الورقة](https://arxiv.org/abs/2601.13802) · [النماذج](https://huggingface.co/SWivid/Habibi-TTS) · [الكود](https://github.com/SWivid/Habibi-TTS)
