// «الجواد في كلاود وشات جي بي تي» (the MCP connector): the person a connector's request acts for. Server only.
//
// The site's routes find the signed-in person from the Supabase cookie (requireApiUser, jawadSession). A request from
// Claude or ChatGPT carries no cookie, only the connector's token: the MCP route checks the token, then runs the same
// route handlers inside `actAs(user, …)`, and those two helpers return this person instead of reading the cookie. So a
// connector does exactly what the person's own page does: same checks, same prices, same wallet.

import { AsyncLocalStorage } from "node:async_hooks";
import type { User } from "@supabase/supabase-js";

const store = new AsyncLocalStorage<User>();

/** The person a connector's request acts for, or null (an ordinary request: the cookie decides). */
export const actingUser = (): User | null => store.getStore() ?? null;

/** Runs `fn` as `user` (only the MCP route calls it, after checking the connector's token). */
export const actAs = <T>(user: User, fn: () => Promise<T>): Promise<T> => store.run(user, fn);
