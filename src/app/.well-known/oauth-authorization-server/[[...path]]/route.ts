import { authorizationServer, json, originOf, preflight } from "@/lib/mcp/meta";

/** «الجواد في كلاود وشات جي بي تي»: where a connector signs the person in and gets its tokens. */
export const GET = (req: Request) => json(authorizationServer(originOf(req)));
export const OPTIONS = preflight;
