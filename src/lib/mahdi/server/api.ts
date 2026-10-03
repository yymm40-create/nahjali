// SERVER ONLY. Helpers for «لأجل المهدي» API routes.
import { NextResponse } from "next/server";
import { UserError } from "@/lib/api";
import { t } from "../i18n";
import { getApiSession, type MahdiSession } from "./session";
import type { Profile } from "../types";
import type { User } from "@supabase/supabase-js";

export { UserError };

/** Wraps a route handler: Arabic messages for expected errors, a generic message for everything else. */
export function mahdiRoute<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof UserError) return NextResponse.json({ error: err.message }, { status: err.status });
      const mapped = fromDbError(err);
      if (mapped) return NextResponse.json({ error: mapped.message }, { status: mapped.status });
      console.error("[mahdi]", err);
      return NextResponse.json({ error: t.errors.generic }, { status: 500 });
    }
  };
}

/** Postgres errors that mean "bad input" or "not yours" become clear Arabic messages. */
export function fromDbError(err: unknown): UserError | null {
  const code = (err as { code?: string } | null)?.code;
  switch (code) {
    case "23503": // foreign key: the project/habit does not exist for this user
    case "42501": // row level security
    case "PGRST116": // no row
      return new UserError(t.errors.notFound, 404);
    case "23514": // check constraint
    case "22P02": // invalid input syntax
    case "22003": // numeric out of range
    case "22007": // invalid date
    case "22008":
      return new UserError(t.errors.invalid, 400);
    case "22023":
      return new UserError(t.errors.futureDate, 400);
    default:
      return null;
  }
}

/** Throws the database error as a user error when it is one, or as-is otherwise. */
export function check<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw fromDbError(res.error) ?? res.error;
  return res.data;
}

export async function requireUser(req: Request): Promise<MahdiSession & { user: User }> {
  const s = await getApiSession(req);
  if (!s.user) throw new UserError(t.errors.unauthenticated, 401);
  return s as MahdiSession & { user: User };
}

export async function requireProfile(req: Request): Promise<MahdiSession & { user: User; profile: Profile }> {
  const s = await requireUser(req);
  if (!s.profile) throw new UserError(t.errors.noProfile, 403);
  return s as MahdiSession & { user: User; profile: Profile };
}

/** Parses a JSON body (max 64 KB by default). */
export async function readJson(req: Request, maxBytes = 64 * 1024): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > maxBytes) throw new UserError(t.errors.invalid, 413);
  try {
    const body = JSON.parse(text || "{}");
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new UserError(t.errors.invalid, 400);
  }
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireId(id: unknown): string {
  if (typeof id !== "string" || !UUID_RE.test(id)) throw new UserError(t.errors.notFound, 404);
  return id;
}
