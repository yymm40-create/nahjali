"use client";

import { useState } from "react";
import { probeFile, putWithProgress } from "@/components/jawad/studio/upload";

interface Done {
  key: string;
  name: string;
  state: "up" | "ok" | "fail";
  progress: number;
  id?: string;
  error?: string;
}

const post = async <T,>(url: string, data: unknown) => {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), cache: "no-store" });
  return { ok: res.ok, body: (await res.json().catch(() => ({}))) as T & { error?: string } };
};

/** The files go to the person's JAWAD AI files (the studio's own upload: checked by the server), ready for Claude / ChatGPT. */
export default function UploadFiles() {
  const [items, setItems] = useState<Done[]>([]);
  const set = (key: string, patch: Partial<Done>) => setItems((l) => l.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  async function one(file: File, key: string) {
    try {
      const probe = await probeFile(file);
      const signed = await post<{ id: string; signedUrl: string }>("/api/jawad/uploads", { kind: probe.kind, mime: probe.mime, bytes: file.size, fileName: file.name });
      if (!signed.ok) throw new Error(signed.body.error ?? "تعذّر بدء الرفع.");
      await putWithProgress(signed.body.signedUrl, file, probe.mime, (p) => set(key, { progress: p }));
      const conf = await post<{ upload: { status: string; error: string | null } }>("/api/jawad/uploads/confirm", { id: signed.body.id });
      if (!conf.ok || conf.body.upload?.status !== "ready") throw new Error(conf.body.error ?? conf.body.upload?.error ?? "تعذّر فحص الملف.");
      set(key, { state: "ok", id: signed.body.id, progress: 1 });
    } catch (e) {
      set(key, { state: "fail", error: e instanceof Error ? e.message : "تعذّر الرفع." });
    }
  }

  return (
    <div className="space-y-4">
      <label className="btn btn-primary cursor-pointer">
        اختر الملفات
        <input
          type="file"
          multiple
          className="sr-only"
          accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,audio/mpeg,audio/wav,application/pdf"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []).slice(0, 20);
            e.target.value = "";
            const added = files.map((f, i) => ({ key: `${Date.now()}-${i}`, name: f.name, state: "up" as const, progress: 0 }));
            setItems((l) => [...added, ...l]);
            files.forEach((f, i) => void one(f, added[i].key));
          }}
        />
      </label>
      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((x) => (
            <li key={x.key} className="card space-y-1 p-3">
              <p className="font-extrabold break-all">{x.name}</p>
              {x.state === "up" && <p className="text-sm font-bold text-muted">يرتفع… {Math.round(x.progress * 100)}٪</p>}
              {x.state === "ok" && <p className="text-sm font-bold text-emerald-600">✅ جاهز</p>}
              {x.state === "fail" && <p className="text-sm font-bold text-red-500">{x.error}</p>}
            </li>
          ))}
        </ul>
      )}
      {items.some((x) => x.state === "ok") && <p className="font-extrabold">ارجع للمحادثة في كلاود أو شات جي بي تي وقول: «رفعت الملفات».</p>}
    </div>
  );
}
