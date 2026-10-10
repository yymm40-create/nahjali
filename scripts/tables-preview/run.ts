// A sample «كتيب الجداول الذكي» drawn without pictures (and with stand-in characters): node via esbuild. Writes a PDF.
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { composeBooklet } from "@/lib/compose";
import { bookletTemplate } from "@/lib/tables-booklet/layout";
import { cleanSpec } from "@config/tables-booklet";

const out = process.argv[2] ?? "/tmp/tables.pdf";
const withPhoto = process.argv[3] === "photo";
const spec = cleanSpec({
  title: "كتيب عاداتي",
  message: "يا بطل، كل نجمة تلوّنها خطوة لقدّام. نحن فخورين فيك دائمًا!",
  theme: process.argv[4] ?? "sky",
  photo: withPhoto,
  style: "pixar",
  tables: [
    { title: "مهامي اليومية", goal: "هدفي: ٥ من ٧ لكل عادة", rows: ["صلاة الفجر", "صلاة الظهرين", "صلاة العشاءين", "قراءة القرآن", "تفريش الأسنان", "ترتيب السرير", "النوم المبكر", "المذاكرة"], columns: "week", mark: "star", copies: 2, pose: "praying" },
    { title: "تحدي القراءة", goal: "صفحة كل يوم", rows: ["قرأت صفحة", "لخصت الفكرة", "شاركت أهلي"], columns: "days10", mark: "check", copies: 1, pose: null },
    { title: "مشاعري", goal: "", rows: ["الصباح", "الظهر", "المساء"], columns: "week", mark: "smile", copies: 1, pose: "happy" },
    { title: "نقاط الرياضة", goal: "اكتب الدقائق", rows: ["مشي", "سباحة", "دراجة", "تمارين"], columns: "weeks4", mark: "number", copies: 1, pose: "studying" },
  ],
  rewards: ["٣٠ نجمة = نزهة للحديقة", "٥٠ نجمة = لعبة جديدة", "أسبوع كامل = عشاء مع العائلة"],
  certificate: true,
})!;
const who = { kind: "child" as const, gender: "male" as const, age: 8, name: "علي" };
const tpl = bookletTemplate(spec);
// stand-in characters: a coloured figure per pose
const poses: Record<string, Buffer> = {};
for (const p of tpl.poses) poses[p] = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="800"><rect x="100" y="250" width="200" height="500" rx="80" fill="#e76f51"/><circle cx="200" cy="160" r="120" fill="#f4a261"/></svg>`)).png().toBuffer();
const pdf = await composeBooklet(tpl, { style: "pixar", childName: who.name, parentMessage: spec.message, poses });
writeFileSync(out, pdf);
console.log(`${tpl.pages.length} pages → ${out}`);
