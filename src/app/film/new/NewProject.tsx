"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/fetch";
import ProjectFields, { type FieldValues } from "../ProjectFields";

/** The first screen of a film: title + the user's own story. Saved as soon as it is created. */
export default function NewProject() {
  const router = useRouter();
  const [values, setValues] = useState<FieldValues>({ title: "", story: "", fixedFacts: "", targetDurationSec: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    setBusy(true);
    setError("");
    try {
      const { id } = await postJson<{ id: string }>("/api/film/projects", values);
      router.push(`/film/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="display text-4xl">مشروع فيلم جديد</h1>
        <p className="font-bold text-muted">اكتب فكرتك بكلماتك ولو بأسطر قليلة. السيناريست بيبدأ منها، وما يغيّر قصتك بدون ما يسألك.</p>
      </header>
      <ProjectFields values={values} onChange={setValues} />
      {error && <p className="error-box">{error}</p>}
      <button className="btn btn-primary w-full text-xl" onClick={create} disabled={busy || !values.title.trim()}>
        {busy ? "نجهّز المشروع…" : "أنشئ المشروع"}
      </button>
    </div>
  );
}
