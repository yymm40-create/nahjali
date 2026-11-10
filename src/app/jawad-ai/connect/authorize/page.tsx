import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { jawadLogin, jawadSession } from "@/lib/jawad/server/access";
import { verify, type RequestNote } from "@/lib/mcp/tokens";
import { MCP_TOOLS_SUMMARY } from "@/lib/mcp/summary";
import { LivingBg } from "../Scene";
import "../connect.css";

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
      <div className="cn" dir="rtl">
        <LivingBg />
        <div className="cn-in cn-solo">
          <section className="cn-card cn-glass cn-rise">
            <h1 className="cn-h1" style={{ fontSize: 30, marginTop: 0 }}>
              انتهى <span className="cn-grad">طلب الربط</span>
            </h1>
            <p className="cn-lead">ارجع لكلاود أو شات جي بي تي واضغط «ربط» مرة ثانية.</p>
          </section>
        </div>
      </div>
    );
  }
  const { user } = await jawadSession();
  if (!user) redirect(jawadLogin(`/jawad-ai/connect/authorize?r=${r}`));
  const host = new URL(req.uri).host;
  return (
    <div className="cn" dir="rtl">
      <LivingBg />
      <div className="cn-in cn-solo">
        <form method="post" action="/api/mcp/oauth/approve" className="cn-card cn-glass cn-rise space-y-4">
          <input type="hidden" name="r" value={r} />
          <h1 className="cn-h1" style={{ fontSize: "clamp(26px,6vw,34px)", marginTop: 0 }}>
            «{req.name}» يبي يستخدم <span className="cn-grad">حسابك في الجواد</span>
          </h1>
          <p className="cn-note" style={{ marginTop: 0 }}>
            حسابك: <bdi dir="ltr">{user.email}</bdi> · يرجع لـ <bdi dir="ltr">{host}</bdi>
          </p>
          <div className="cn-grid">
            {MCP_TOOLS_SUMMARY.map((t, i) => (
              <div key={t} className="cn-tile cn-rise" style={{ ["--d" as string]: i + 1 }}>
                <span aria-hidden>✓</span>
                {t}
              </div>
            ))}
          </div>
          <p className="cn-note">كل توليد يُخصم من رصيدك بنفس أسعار الموقع، ويسألك عن السعر قبل الخصم. تقدر تفصل الربط وقت ما تبي من صفحة «الجواد في كلاود وشات جي بي تي».</p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" name="decision" value="allow" className="cn-btn">
              اسمح
            </button>
            <button type="submit" name="decision" value="deny" className="cn-btn-soft">
              لا
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
