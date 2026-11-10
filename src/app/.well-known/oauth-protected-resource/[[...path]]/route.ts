import { json, originOf, preflight, protectedResource } from "@/lib/mcp/meta";

/** «الجواد في كلاود وشات جي بي تي»: who protects the connector (also at …/oauth-protected-resource/api/mcp). */
export const GET = (req: Request) => json(protectedResource(originOf(req)));
export const OPTIONS = preflight;
