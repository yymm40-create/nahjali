import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { jawadLogin, jawadSession } from "@/lib/jawad/server/access";
import { LivingBg } from "../Scene";
import UploadFiles from "./UploadFiles";
import "../connect.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ارفع ملفاتك", robots: { index: false } };

/** «الجواد في كلاود وشات جي بي تي» · files from the person's device for a connector (Claude can't pass a chat's files to it). */
export default async function ConnectUpload() {
  const { user } = await jawadSession();
  if (!user) redirect(jawadLogin("/jawad-ai/connect/upload"));
  return (
    <div className="cn" dir="rtl">
      <LivingBg />
      <div className="cn-in cn-solo">
        <h1 className="cn-h1 cn-rise">
          ارفع <span className="cn-grad">ملفاتك</span>
        </h1>
        <p className="cn-lead cn-rise" style={{ ["--d" as string]: 1 }}>
          صور PNG أو JPG أو WEBP، فيديو MP4 أو MOV، صوت MP3 أو WAV، أو PDF، حتى ٢٠٠ ميجا للملف. توصل لكلاود وشات جي بي تي على طول، وتلقاها بعد في كل أقسام الجواد.
        </p>
        <section className="cn-card cn-glass cn-rise" style={{ ["--d" as string]: 2 }}>
          <UploadFiles />
        </section>
      </div>
    </div>
  );
}
