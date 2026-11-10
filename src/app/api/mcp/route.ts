import { actAs } from "@/lib/mcp/acting";
import { RouteError } from "@/lib/mcp/call-route";
import { CORS, json, originOf, preflight } from "@/lib/mcp/meta";
import { verify, type TokenNote } from "@/lib/mcp/tokens";
import { TOOLS } from "@/lib/mcp/tools";
import { tokenUser } from "@/lib/mcp/user";

export const dynamic = "force-dynamic";
// a robot's turn or a few slides drawn take up to a few minutes, as on the site
export const maxDuration = 300;

/**
 * «الجواد في كلاود وشات جي بي تي» · the MCP server (Streamable HTTP, stateless: every POST is answered with JSON). The
 * person links their account once (OAuth, see /api/mcp/oauth); each tool then runs as them (src/lib/mcp/tools.ts).
 */
const VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const INSTRUCTIONS =
  "JAWAD AI (الجواد الذكي) is an Arabic creative platform. Answer the person in their language (usually Gulf Arabic). Everything that costs money is charged to the person's own JAWAD wallet at the site's prices: for studio_generate always get the price first and the person's approval before confirming. Where a tool returns open_on_site, the work continues on the site in the browser: give the person that link.";

interface Rpc {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

const unauthorized = (req: Request) =>
  new Response(JSON.stringify({ error: "invalid_token", error_description: "Connect your JAWAD AI account." }), {
    status: 401,
    headers: { ...CORS, "content-type": "application/json", "WWW-Authenticate": `Bearer resource_metadata="${originOf(req)}/.well-known/oauth-protected-resource/api/mcp"` },
  });

export const POST = async (req: Request) => {
  const auth = req.headers.get("authorization") ?? "";
  const token = verify<TokenNote & Record<string, unknown>>("access", auth.replace(/^Bearer\s+/i, ""));
  if (!token) return unauthorized(req);
  const user = await tokenUser(token.uid, token.iat);
  if (!user) return unauthorized(req);

  const body = (await req.json().catch(() => null)) as Rpc | Rpc[] | null;
  if (!body) return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  const origin = originOf(req);
  const one = async (m: Rpc) => {
    // notifications (no id) are acknowledged without an answer
    if (m.id === undefined || m.id === null) return null;
    const ok = (result: unknown) => ({ jsonrpc: "2.0", id: m.id, result });
    const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id: m.id, error: { code, message } });
    switch (m.method) {
      case "initialize": {
        const asked = String(m.params?.protocolVersion ?? "");
        return ok({
          protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "jawad-ai", title: "الجواد الذكي · JAWAD AI", version: "1.0.0", websiteUrl: `${origin}/jawad-ai` },
          instructions: INSTRUCTIONS,
        });
      }
      case "ping":
        return ok({});
      case "tools/list":
        return ok({ tools: TOOLS.map((t) => ({ name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema, ...(t.annotations ? { annotations: t.annotations } : {}), ...(t._meta ? { _meta: t._meta } : {}) })) });
      case "tools/call": {
        const tool = TOOLS.find((t) => t.name === m.params?.name);
        if (!tool) return fail(-32602, `Unknown tool: ${String(m.params?.name)}`);
        const args = (m.params?.arguments && typeof m.params.arguments === "object" ? m.params.arguments : {}) as Record<string, unknown>;
        try {
          const out = await actAs(user, () => tool.run(args, { user, origin, signal: req.signal }));
          return ok({ content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out });
        } catch (e) {
          // the section's own Arabic message (a closed section, a short wallet with what it needs, a wrong value…)
          const data = e instanceof RouteError ? e.data : {};
          const message = e instanceof Error ? e.message : "صار خطأ غير متوقع.";
          if (!(e instanceof RouteError)) console.error("mcp tool", tool.name, e);
          const extra = data.topup ? { top_up: `${origin}/jawad-ai/coins`, needed: data.topup } : data.issues ? { issues: data.issues } : {};
          return ok({ content: [{ type: "text", text: JSON.stringify({ error: message, ...extra }) }], isError: true });
        }
      }
      default:
        return fail(-32601, `Method not found: ${String(m.method)}`);
    }
  };
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map(one))).filter(Boolean);
    return out.length ? json(out) : new Response(null, { status: 202, headers: CORS });
  }
  const out = await one(body);
  return out ? json(out) : new Response(null, { status: 202, headers: CORS });
};

/** No server-sent stream: every answer comes back on its POST. */
export const GET = () => new Response(null, { status: 405, headers: { ...CORS, Allow: "POST" } });
export const DELETE = GET;
export const OPTIONS = preflight;
