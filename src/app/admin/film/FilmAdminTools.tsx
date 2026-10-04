"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/fetch";

/** Invite list for the film branch. */
export default function FilmAdminTools({ invited }: { invited: string[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function send(body: Record<string, unknown>, done: string) {
    setError("");
    setMsg("");
    try {
      await postJson("/api/admin/film", body);
      setMsg(done);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">المدعوين لفرع الفيلم ({invited.length})</h2>
        <p className="text-sm font-bold text-muted">أنت مسموح لك دائمًا. أضف إيميل Google للي تبي يجرّب.</p>
        <div className="flex gap-2">
          <input className="field flex-1" dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@gmail.com" />
          <button
            className="btn btn-primary px-5"
            disabled={!email.trim()}
            onClick={async () => {
              await send({ action: "invite", email }, "انضاف ✅");
              setEmail("");
            }}
          >
            أضف
          </button>
        </div>
        <ul className="space-y-2">
          {invited.map((e) => (
            <li key={e} className="flex items-center justify-between rounded-2xl bg-surface-2 px-3 py-2 font-bold">
              <span dir="ltr">{e}</span>
              <button className="text-sm text-muted underline" onClick={() => send({ action: "remove", email: e }, "انحذف")}>
                إزالة
              </button>
            </li>
          ))}
        </ul>
      </section>

      {msg && <p className="card p-3 text-center font-extrabold">{msg}</p>}
      {error && <p className="error-box">{error}</p>}
    </>
  );
}
