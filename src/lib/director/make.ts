import { UserError } from "@/lib/api";
import { unlimitedFor } from "@/lib/access";
import { DESK_GENERATOR, DeskError, deskCheck, deskImage, deskVideo, type DeskWho } from "@/lib/content/jawad";
import { outputLinks } from "@/lib/kharq/make";
import { generatorById } from "@config/jawad/generators";
import { findDirectorMedia, getDirectorChat, replaceDirectorMedia, saveDirectorChat, type DirectorMedia } from "./chats";

interface Overrides {
  generatorId?: unknown;
  aspect?: unknown;
  quality?: unknown;
  resolution?: unknown;
  seconds?: unknown;
  withSound?: unknown;
}

const reasonOf = (error: unknown) => error instanceof DeskError ? error.reason : error instanceof UserError ? error.message : "تعذّر التوليد الآن؛ جرّب مرة ثانية.";

function configured(media: DirectorMedia, value: Overrides): DirectorMedia {
  if (media.jobId) return media;
  const requestedGenerator = typeof value.generatorId === "string" ? value.generatorId : media.generatorId;
  const def = generatorById(requestedGenerator);
  const generatorId = def?.output === media.kind ? def.id : DESK_GENERATOR[media.kind];
  const resolution = typeof value.resolution === "string" ? value.resolution : media.resolution;
  return {
    ...media,
    generatorId,
    aspect: typeof value.aspect === "string" ? value.aspect : media.aspect,
    quality: typeof value.quality === "string" ? value.quality : media.quality,
    resolution,
    seconds: media.kind === "video" ? Math.max(4, Math.min(15, Math.round(Number(value.seconds ?? media.seconds) || 5))) : 0,
    withSound: media.kind === "video" ? value.withSound !== false : false,
  };
}

export async function confirmDirectorMedia(input: { userId: string; chatId: string; mediaId: string; email: string | null; origin: string; settings?: Overrides }) {
  const chat = await getDirectorChat(input.userId, input.chatId);
  if (!chat) throw new UserError("ما لقينا هذي المحادثة.", 404);
  const found = findDirectorMedia(chat, input.mediaId);
  if (!found) throw new UserError("ما لقينا هذا التوليد.", 404);
  if (found.media.jobId) throw new UserError("هذا التوليد بدأ من قبل.", 409);
  const base = configured(found.media, input.settings ?? {});
  const who: DeskWho = { id: input.userId, email: input.email, owner: await unlimitedFor(input.email), origin: input.origin };
  const request = {
    key: `director-${input.chatId.replace(/-/g, "").slice(0, 16)}-${base.id.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24)}`,
    kind: base.kind,
    generatorId: base.generatorId,
    prompt: base.prompt,
    aspect: base.aspect,
    quality: base.quality,
    resolution: base.resolution,
    ...(base.kind === "video" ? { seconds: base.seconds, withSound: base.withSound } : {}),
  };
  let media: DirectorMedia;
  try {
    if (base.kind === "image") {
      const { out, receipt } = await deskImage(who, request);
      media = { ...base, generatorId: receipt.generatorId, jobId: receipt.jobId, state: "done", fileId: out.outputId, coins: receipt.free ? 0 : receipt.coins, status: undefined, error: undefined };
    } else {
      const receipt = await deskVideo(who, request);
      media = { ...base, generatorId: receipt.generatorId, jobId: receipt.jobId, state: "running", status: "بدأ التوليد", coins: receipt.free ? 0 : receipt.coins, error: undefined };
    }
  } catch (error) {
    media = { ...base, state: "failed", error: reasonOf(error) };
    await saveDirectorChat(input.userId, chat.id, replaceDirectorMedia(chat.messages, found.turn, media)).catch(() => null);
    throw new UserError(media.error ?? "تعذّر التوليد.", 502);
  }
  await saveDirectorChat(input.userId, chat.id, replaceDirectorMedia(chat.messages, found.turn, media));
  const link = media.fileId ? (await outputLinks(input.userId, [media.fileId])).get(media.fileId) ?? null : null;
  return { media, link };
}

export async function followDirectorMedia(userId: string, chatId: string, mediaId: string) {
  const chat = await getDirectorChat(userId, chatId);
  if (!chat) throw new UserError("ما لقينا هذي المحادثة.", 404);
  const found = findDirectorMedia(chat, mediaId);
  if (!found) throw new UserError("ما لقينا هذا التوليد.", 404);
  if (!found.media.jobId || found.media.state === "done" || found.media.state === "failed") {
    const link = found.media.fileId ? (await outputLinks(userId, [found.media.fileId])).get(found.media.fileId) ?? null : null;
    return { media: found.media, link };
  }
  const state = await deskCheck(userId, found.media.jobId);
  const media: DirectorMedia = state.state === "done"
    ? { ...found.media, state: "done", fileId: state.out.outputId, status: undefined }
    : state.state === "failed"
      ? { ...found.media, state: "failed", error: state.error.reason }
      : { ...found.media, state: "running", status: state.status || "قيد التوليد" };
  await saveDirectorChat(userId, chat.id, replaceDirectorMedia(chat.messages, found.turn, media)).catch(() => null);
  const link = media.fileId ? (await outputLinks(userId, [media.fileId])).get(media.fileId) ?? null : null;
  return { media, link };
}
