import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaudeJson, claudeCost } from "@/lib/film/anthropic";
import { sajjadBrief } from "@/lib/film/sajjad";
import { managedAgentConfigured, managedAgentTurn, managedJson } from "@/lib/managed-agent";
import { isUuid } from "./uploads";

const db = () => createAdminClient();
const str = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["understanding", "error", "correction", "willDo"],
  properties: {
    understanding: { type: "string" },
    error: { type: "string" },
    correction: { type: "string" },
    willDo: { type: "array", items: { type: "string" } },
  },
} as const;

export interface SmartUnderstanding {
  understanding: string;
  error: string;
  correction: string;
  willDo: string[];
}

export interface SmartUnderstandingBody {
  jobId?: unknown;
  editorProjectId?: unknown;
  filmProjectId?: unknown;
  generation?: unknown;
  mode?: unknown;
  error?: unknown;
  correction?: unknown;
  settings?: unknown;
}

export async function smartEditProjects(userId: string) {
  const { data, error } = await db().from("film_projects").select("id,title,stage,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(30);
  if (error) throw new UserError("تعذّر تحميل مشاريع سجاد الآن.", 503);
  return (data ?? []).map((project) => ({ id: project.id as string, title: project.title as string, stage: project.stage as string, updatedAt: project.updated_at as string }));
}

export async function smartEditUnderstanding(user: { id: string; email?: string | null }, body: SmartUnderstandingBody) {
  const jobId = str(body.jobId, 80);
  if (!isUuid(jobId)) throw new UserError("المقطع غير صحيح.", 400);
  const { data: source } = await db().from("jawad_jobs").select("id,prompt,generator_id,settings,inputs").eq("id", jobId).eq("user_id", user.id).maybeSingle();
  if (!source) throw new UserError("ما لقينا التوليد الأصلي.", 404);

  let filmProjectId = isUuid(body.filmProjectId) ? String(body.filmProjectId) : null;
  const editorProjectId = isUuid(body.editorProjectId) ? String(body.editorProjectId) : null;
  if (editorProjectId) {
    const { data: editor } = await db().from("editor_projects").select("id,user_id,film_project_id").eq("id", editorProjectId).maybeSingle();
    if (!editor || editor.user_id !== user.id) throw new UserError("مشروع المونتاج غير متاح.", 404);
    filmProjectId = (editor.film_project_id as string | null) ?? filmProjectId;
  }
  if (filmProjectId) {
    const { data: film } = await db().from("film_projects").select("id,user_id").eq("id", filmProjectId).maybeSingle();
    if (!film || film.user_id !== user.id) throw new UserError("مشروع سجاد غير متاح.", 404);
  }

  const error = str(body.error, 4000);
  const correction = str(body.correction, 5000);
  if (!error || !correction) throw new UserError("اكتب الخطأ والتصحيح المطلوب كل واحد في خانته.", 400);
  const film = filmProjectId ? await sajjadBrief({ filmProjectId }) : null;
  const prompt = `أنت جواد حاضر داخل نافذة «التعديل الذكي» في حيدرة. لا تبدأ التوليد. افهم الطلب فقط ثم أعد ملخصًا عربيًا بسيطًا ودقيقًا كي يؤكده المستخدم أو يعدله. لا تخترع ما لا يظهر في البيانات.\n\nالتوليد الأصلي:\n- المولد: ${source.generator_id}\n- البرومبت: ${str(source.prompt, 9000)}\n- الإعدادات الأصلية: ${JSON.stringify(source.settings).slice(0, 4000)}\n- الجيل المختار: ${str(body.generation, 120) || "الحالي"}\n- نوع المعالجة: ${str(body.mode, 80) || "غير محدد"}\n- الإعدادات الجديدة: ${JSON.stringify(body.settings ?? {}).slice(0, 4000)}\n\nقسم المستخدم الأول — ما هو الخطأ:\n${error}\n\nقسم المستخدم الثاني — ما هو التصحيح المطلوب:\n${correction}${film ? `\n\nبيانات مشروع سجاد المرتبط (اقرأها مباشرة وحافظ على استمراريتها):\n${film}` : "\n\nلا يوجد مشروع سجاد مرتبط؛ لا تفترض قصة أو شخصيات خارج المقطع."}\n\nأعد JSON فقط مطابقًا لهذا المخطط:\n${JSON.stringify(SCHEMA)}`;

  if (managedAgentConfigured()) {
    try {
      const managed = await managedAgentTurn({
        userId: user.id,
        contextType: "smart_edit",
        contextKey: editorProjectId ?? filmProjectId ?? jobId,
        title: `جواد · تعديل ذكي · ${filmProjectId ? "مشروع سجاد" : jobId.slice(0, 8)}`,
        content: [{ type: "text", text: prompt }],
      });
      const answer = managedJson<SmartUnderstanding>(managed.text);
      return { ...answer, willDo: Array.isArray(answer.willDo) ? answer.willDo.map(String).slice(0, 6) : [], usd: managed.usd };
    } catch (managedError) {
      console.error("managed smart edit fallback", String(managedError).slice(0, 300));
    }
  }

  const fallback = await callClaudeJson<SmartUnderstanding>({
    system: "أنت جواد في التعديل الذكي. افهم الخطأ والتصحيح، ولا تولّد قبل تأكيد المستخدم.",
    turns: [{ role: "user", content: prompt }],
    schema: SCHEMA,
    maxTokens: 2500,
    effort: "medium",
  });
  return { ...fallback.data, willDo: fallback.data.willDo.slice(0, 6), usd: claudeCost(fallback.usage) };
}
