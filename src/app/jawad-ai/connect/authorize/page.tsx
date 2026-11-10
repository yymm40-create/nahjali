import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { jawadLogin, jawadSession } from "@/lib/jawad/server/access";
import { verify, type RequestNote } from "@/lib/mcp/tokens";
import { MCP_TOOLS_SUMMARY } from "@/lib/mcp/summary";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ربط حسابك", robots: { index: false } };

/**
 * «الجواد في كلاود وشات جي بي تي» · the consent page: Claude or ChatGPT asks to use the person's JAWAD AI account.
 * Signed out → the sign-in page, then back here with the same request.
 */
export default async function ConnectAuthorize({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const { r } = await searchParams;
  const req = verify<RequestNote & Record<string, unknown>>("req", r);
  if (!req) {
    return (
      <section className="mx-auto max-w-xl p-4 py-10">
        <div className="card space-y-3 p-6">
          <h1 className="text-2xl font-extrabold">انتهى طلب الربط</h1>
          <p className="font-bold text-muted">ارجع لكلاود أو شات جي بي تي واضغط «ربط» مرة ثانية.</p>
        </div>
      </section>
    );
  }
  const { user } = await jawadSession();
  if (!user) redirect(jawadLogin(`/jawad-ai/connect/authorize?r=${r}`));
  const host = new URL(req.uri).host;
  return (
    <section className="mx-auto max-w-xl p-4 py-10">
      <form method="post" action="/api/mcp/oauth/approve" className="card space-y-5 p-6">
        <input type="hidden" name="r" value={r} />
        <h1 className="text-2xl font-extrabold">«{req.name}» يبي يستخدم حسابك في الجواد</h1>
        <p className="font-bold text-muted">
          حسابك: <bdi dir="ltr">{user.email}</bdi> · يرجع لـ <bdi dir="ltr">{host}</bdi>
        </p>
        <div className="space-y-2">
          <p className="font-extrabold">لو سمحت، يقدر:</p>
          <ul className="list-disc space-y-1 ps-6 font-bold">
            {MCP_TOOLS_SUMMARY.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p className="text-sm font-bold text-muted">كل توليد يُخصم من رصيدك بنفس أسعار الموقع، ويسألك عن السعر قبل الخصم. تقدر تفصل الربط وقت ما تبي من صفحة «ربط كلاود وشات جي بي تي».</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="submit" name="decision" value="allow" className="btn btn-primary">
            اسمح
          </button>
          <button type="submit" name="decision" value="deny" className="btn btn-ghost">
            لا
          </button>
        </div>
      </form>
    </section>
  );
}
