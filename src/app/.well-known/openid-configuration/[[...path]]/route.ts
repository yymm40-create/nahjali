import { authorizationServer, json, originOf, preflight } from "@/lib/mcp/meta";

/** The same as oauth-authorization-server: some connector clients look here first. */
export const GET = (req: Request) => json(authorizationServer(originOf(req)));
export const OPTIONS = preflight;
