import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { jawadLogin, jawadSession } from "@/lib/jawad/server/access";
import UploadFiles from "./UploadFiles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ارفع ملفاتك", robots: { index: false } };

/** «الجواد في كلاود وشات جي بي تي» · files from the person's device for a connector (Claude can't pass a chat's files to it). */
export default async function ConnectUpload() {
  const { user } = await jawadSession();
  if (!user) redirect(jawadLogin("/jawad-ai/connect/upload"));
  return (
    <section className="mx-auto max-w-xl space-y-4 p-4 py-8">
      <h1 className="text-3xl font-extrabold">ارفع ملفاتك</h1>
      <p className="font-bold text-muted">صور PNG أو JPG أو WEBP، فيديو MP4 أو MOV، صوت MP3 أو WAV، أو PDF، حتى ٢٠٠ ميجا للملف. توصل لكلاود وشات جي بي تي على طول، وتلقاها بعد في كل أقسام الجواد.</p>
      <UploadFiles />
    </section>
  );
}
