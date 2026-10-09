import { notFound, redirect } from "next/navigation";
import PhotoEditor from "@/components/jawad/photo/PhotoEditor";
import { jawadLogin, jawadSession } from "@/lib/jawad/server/access";
import { photoAllowed } from "@/lib/photo/access";
import { PHOTO } from "@config/photo";
import "../photo.css";

export const dynamic = "force-dynamic";
export const metadata = { title: PHOTO.name };

/** One project in the editor. */
export default async function PhotoProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await jawadSession();
  if (!user) redirect(jawadLogin(`${PHOTO.base}/${id}`));
  if (!(await photoAllowed(user.email))) notFound();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return <PhotoEditor projectId={id} persona={PHOTO.persona} />;
}
