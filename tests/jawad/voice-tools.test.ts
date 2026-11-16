import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { ALL_FORMATS, BufferSource, Input } from "mediabunny";
import { evaluate, priceTable } from "@/lib/jawad/engine";
import { centiFor, coinsOf, directorOffered, generatorById, priceKindOf } from "@config/jawad/generators";
import {
  billedSeconds,
  CONSENT_KEY,
  DUB_ID,
  DUB_LANGS,
  dubForm,
  isVoiceTool,
  LIPSYNC_ID,
  LIPSYNC_MODELS,
  lipsyncRequest,
  VOICE_CHANGE_ID,
  VOICE_TOOL_IDS,
  VOICE_TOOL_MAX_MS,
  VOICE_TOOL_TRACK,
  VOICE_TOOL_USD,
} from "@config/jawad/voice-tools";
import { FEATURES } from "@config/feature-use";
import { soundOfVideo, videoWithSound } from "@/lib/jawad/server/voice-tools";
import type { GeneratorDef, RefMeta } from "@config/jawad/types";

// «أدوات الصوت» in «الاستوديو الإبداعي» («صوت»): «دبلجة», «غيّر الصوت» and «حرّك الشفايف».

const video = (ms: number, id = "v"): RefMeta => ({ id, kind: "video", role: "reference", name: id, mime: "video/mp4", bytes: 1_000_000, width: 720, height: 1280, durationMs: ms, fps: 30, status: "ready" });
const audio = (ms: number, id = "a"): RefMeta => ({ id, kind: "audio", role: "reference", name: id, mime: "audio/mpeg", bytes: 100_000, width: null, height: null, durationMs: ms, fps: null, status: "ready" });
const photo = (id = "p"): RefMeta => ({ id, kind: "image", role: "reference", name: id, mime: "image/png", bytes: 100_000, width: 1024, height: 1024, durationMs: null, fps: null, status: "ready" });
const run = (def: GeneratorDef, settings: Record<string, unknown>, refs: RefMeta[], table = priceTable(def, undefined), strict = false) =>
  evaluate(def, { settings: settings as never, prompt: "", instructions: "", refStyle: "references", refs, strict }, table);
const dub = generatorById(DUB_ID)!;
const changer = generatorById(VOICE_CHANGE_ID)!;
const lips = generatorById(LIPSYNC_ID)!;
const OK = { [CONSENT_KEY]: true };

describe("the three tools are sound generators", () => {
  it("are registered in the «صوت» section, through the same jobs, never offered the Super Director", () => {
    expect(VOICE_TOOL_IDS.map((id) => generatorById(id)?.name)).toEqual(["دبلجة", "غيّر الصوت", "حرّك الشفايف"]);
    for (const id of VOICE_TOOL_IDS) {
      const g = generatorById(id)!;
      expect(isVoiceTool(id)).toBe(true);
      expect(g.output).toBe("audio");
      expect(g.defaultSection).toBe("audio");
      expect(directorOffered(g)).toBe(false);
      expect(priceKindOf(g)).toBe("other");
      expect(g.sources.length).toBeGreaterThan(0);
    }
    expect(dub.provider.id).toBe("elevenlabs");
    expect(changer.provider.id).toBe("elevenlabs");
    expect(lips.provider.id).toBe("fal");
    // a dub and a lip sync are followed after sending; the voice changer answers at once
    expect([dub.api.tracking, changer.api.tracking, lips.api.tracking]).toEqual(["async", "sync", "async"]);
    expect(isVoiceTool("elevenlabs-eleven-v4")).toBe(false);
  });

  it("each has its own tracking id in the studio section", () => {
    for (const id of VOICE_TOOL_IDS) expect(FEATURES.find((f) => f.id === VOICE_TOOL_TRACK[id])?.section).toBe("studio");
  });
});

describe("prices come from the file's real length (before anything runs)", () => {
  it("bills whole seconds, rounded up, at least one", () => {
    expect(billedSeconds(90_000)).toBe(90);
    expect(billedSeconds(90_001)).toBe(91);
    expect(billedSeconds(200)).toBe(1);
    expect(billedSeconds(null)).toBe(1);
  });

  it("«دبلجة»: per second of the video or the recording, from ElevenLabs' minute", () => {
    const table = priceTable(dub, undefined);
    expect(table.sec).toBe(centiFor(VOICE_TOOL_USD.dubPerMin / 60));
    const e = run(dub, {}, [video(90_400)]);
    expect(e.issues).toEqual([]);
    expect(e.price.ok && e.price.lines).toEqual([{ label: "دبلجة · 91 ث", centi: 91 * table.sec! }]);
    expect(e.price.ok && e.price.coins).toBe(coinsOf(91 * table.sec!, "other"));
    expect(e.price.ok && e.price.usdCeiling).toBeCloseTo((91 * 0.5) / 60, 6);
    // a recording is priced the same way; a longer file costs more
    const short = run(dub, {}, [audio(30_000)]);
    const long = run(dub, {}, [audio(300_000)]);
    expect(short.price.ok && long.price.ok && long.price.coins > short.price.coins).toBe(true);
  });

  it("«غيّر الصوت»: per second, from ElevenLabs' $0.12 a minute", () => {
    const table = priceTable(changer, undefined);
    expect(table.sec).toBe(centiFor(0.12 / 60));
    const e = run(changer, OK, [audio(61_200)]);
    expect(e.issues).toEqual([]);
    expect(e.price.ok && e.price.lines[0].centi).toBe(62 * table.sec!);
  });

  it("«حرّك الشفايف»: a face video by the longer of the two lengths, at the chosen quality", () => {
    const table = priceTable(lips, undefined);
    const e = run(lips, { ...OK, engine: "veed" }, [video(10_000), audio(12_300)]);
    expect(e.mode.id).toBe("lipsync_video");
    expect(e.issues).toEqual([]);
    expect(e.price.ok && e.price.lines[0].centi).toBe(13 * table["veed:sec"]!);
    const pro = run(lips, { ...OK, engine: "sync2pro" }, [video(10_000), audio(12_300)]);
    expect(pro.price.ok && pro.price.lines[0].centi).toBe(13 * table["sync2pro:sec"]!);
    expect(table["veed:sec"]! < table["sync2:sec"]! && table["sync2:sec"]! < table["sync2pro:sec"]!).toBe(true);
  });

  it("«حرّك الشفايف» with a photo: by the sound's length", () => {
    const table = priceTable(lips, undefined);
    const e = run(lips, { ...OK, photoEngine: "omnihuman" }, [photo(), audio(8_200)]);
    expect(e.mode.id).toBe("lipsync_photo");
    expect(e.issues).toEqual([]);
    expect(e.price.ok && e.price.lines[0].centi).toBe(9 * table["omnihuman:sec"]!);
    expect(e.price.ok && e.price.usdCeiling).toBeCloseTo(9 * VOICE_TOOL_USD.talking.omnihuman, 6);
  });

  it("follows the owner's price table, and stops when a line has no price", () => {
    const e = run(dub, {}, [video(10_000)], { sec: 1000 });
    expect(e.price.ok && e.price.lines[0].centi).toBe(10_000);
    const none = run(dub, {}, [video(10_000)], { sec: null });
    expect(none.price.ok).toBe(false);
    expect(none.issues.some((i) => i.field === "price")).toBe(true);
  });

  it("asks for the file before quoting", () => {
    for (const g of [dub, changer, lips]) {
      const e = run(g, OK, []);
      expect(e.price.ok).toBe(false);
      expect(e.issues.length).toBeGreaterThan(0);
    }
  });
});

describe("the tools' rules", () => {
  it("«دبلجة» / «غيّر الصوت»: one video or one recording, never a picture, never both", () => {
    for (const g of [dub, changer]) {
      expect(run(g, OK, [photo()]).refProblems.p).toBeTruthy();
      expect(run(g, OK, [video(5_000), audio(5_000)]).issues.some((i) => i.field === "refs")).toBe(true);
    }
  });

  it("refuse files past their longest length", () => {
    expect(run(dub, {}, [video(VOICE_TOOL_MAX_MS.dub)]).refProblems.v).toBeUndefined();
    expect(run(dub, {}, [video(VOICE_TOOL_MAX_MS.dub + 1_000)]).refProblems.v).toMatch(/أطول/);
    expect(run(changer, OK, [audio(VOICE_TOOL_MAX_MS.voiceChange + 1_000)]).refProblems.a).toMatch(/أطول/);
    expect(run(lips, OK, [video(VOICE_TOOL_MAX_MS.lipsync + 1_000), audio(5_000)]).refProblems.v).toMatch(/أطول/);
    // a picture with the sound past the talking photo's limit
    expect(run(lips, OK, [photo(), audio(VOICE_TOOL_MAX_MS.talking + 1_000)]).issues.some((i) => i.field === "refs")).toBe(true);
  });

  it("«حرّك الشفايف» needs the face and the sound, and offers each mode's own qualities", () => {
    expect(run(lips, OK, [video(5_000)]).issues.some((i) => i.field === "refs")).toBe(true);
    const v = run(lips, OK, [video(5_000), audio(5_000)]);
    expect(v.options.find((o) => o.key === "photoEngine")?.hidden).toBe(true);
    expect(v.options.find((o) => o.key === "engine")?.hidden).toBeFalsy();
    const p = run(lips, OK, [photo(), audio(5_000)]);
    expect(p.options.find((o) => o.key === "engine")?.hidden).toBe(true);
    // a video next to the photo does not belong to the photo mode
    expect(run(lips, OK, [photo(), video(5_000, "v"), audio(5_000)]).refProblems.v).toBeTruthy();
  });

  it("«دبلجة»: Arabic, English and a short list, speakers automatic by default, the background kept", () => {
    expect(DUB_LANGS.slice(0, 2).map((l) => l.code)).toEqual(["ar", "en"]);
    expect(dubForm({})).toEqual({ target_lang: "en", num_speakers: "0", drop_background_audio: "false", watermark: "false" });
    expect(dubForm({ lang: "ar", speakers: "2", keepBackground: false })).toEqual({ target_lang: "ar", num_speakers: "2", drop_background_audio: "true", watermark: "false" });
    // an unknown language is never sent
    expect(dubForm({ lang: "xx" }).target_lang).toBe("en");
    expect(run(dub, { lang: "xx" }, [video(5_000)], undefined, true).issues.some((i) => i.field === "lang")).toBe(true);
  });

  it("«حرّك الشفايف» asks each provider in its own words", () => {
    expect(lipsyncRequest({ settings: { engine: "veed" }, photo: false, videoUrl: "V", audioUrl: "A", videoMs: 5000, audioMs: 4000 })).toEqual({ model: LIPSYNC_MODELS.veed, input: { video_url: "V", audio_url: "A" } });
    expect(lipsyncRequest({ settings: { engine: "sync2" }, photo: false, videoUrl: "V", audioUrl: "A", videoMs: 5000, audioMs: 4000 }).input).toMatchObject({ model: "lipsync-2", sync_mode: "cut_off" });
    // a sound longer than the video: the video goes back and forth, no word is cut
    expect(lipsyncRequest({ settings: { engine: "sync2pro" }, photo: false, videoUrl: "V", audioUrl: "A", videoMs: 3000, audioMs: 6000 }).input).toMatchObject({ model: "lipsync-2-pro", sync_mode: "bounce" });
    expect(lipsyncRequest({ settings: { photoEngine: "omnihuman" }, photo: true, imageUrl: "I", audioUrl: "A" })).toEqual({ model: LIPSYNC_MODELS.omnihuman, input: { image_url: "I", audio_url: "A", resolution: "720p" } });
    expect(lipsyncRequest({ settings: {}, photo: true, imageUrl: "I", audioUrl: "A" }).model).toBe(LIPSYNC_MODELS.kling);
  });
});

describe("permission: the voice or face is theirs, or they have its owner's permission", () => {
  it("«غيّر الصوت» and «حرّك الشفايف» are blocked until the line is turned on (off by default)", () => {
    for (const [g, refs] of [[changer, [audio(5_000)]], [lips, [video(5_000), audio(5_000)]], [lips, [photo(), audio(5_000)]]] as const) {
      expect(g.options.find((o) => o.key === CONSENT_KEY)?.default).toBe(false);
      const off = run(g, {}, [...refs]);
      expect(off.issues.some((i) => i.field === CONSENT_KEY)).toBe(true);
      expect(run(g, { [CONSENT_KEY]: false }, [...refs]).issues.some((i) => i.field === CONSENT_KEY)).toBe(true);
      expect(run(g, OK, [...refs]).issues.some((i) => i.field === CONSENT_KEY)).toBe(false);
    }
  });

  it("the voice changer offers only voices of ElevenLabs or of the person's library", () => {
    const voice = changer.options.find((o) => o.key === "voice");
    expect(voice?.kind === "choice" && voice.picker).toBe("voice");
    expect(voice?.kind === "choice" && voice.accepts?.test("p:JBFqnCBsd6RMkjVDRZzb")).toBe(true);
    // the site's own engine voices (u:) and anything else are not accepted
    expect(voice?.kind === "choice" && voice.accepts?.test("u:00000000-0000-0000-0000-000000000000")).toBe(false);
  });
});

describe("a video's sound, out and back in, without re-encoding", () => {
  const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name));
  const tracks = async (bytes: Buffer) => {
    const input = new Input({ source: new BufferSource(bytes), formats: ALL_FORMATS });
    return { video: (await input.getPrimaryVideoTrack())?.codec ?? null, audio: (await input.getPrimaryAudioTrack())?.codec ?? null, seconds: await input.computeDuration() };
  };

  it("takes a video's sound track out as it is, and finds none in a silent video", async () => {
    const sound = await soundOfVideo(fixture("voice-tools-clip.mp4"));
    expect(sound).not.toBeNull();
    const t = await tracks(sound!);
    expect(t).toMatchObject({ video: null, audio: "aac" });
    expect(t.seconds).toBeGreaterThan(0.9);
    expect(await soundOfVideo(fixture("voice-tools-silent.mp4"))).toBeNull();
  });

  it("puts a new sound on the same video", async () => {
    const out = await videoWithSound(fixture("voice-tools-clip.mp4"), fixture("voice-tools-sound.mp3"));
    const t = await tracks(out);
    expect(t.video).toBe("avc");
    expect(t.audio).toBe("mp3");
    // the picture is copied as it is (its own packets)
    const before = await tracks(fixture("voice-tools-clip.mp4"));
    expect(t.seconds).toBeGreaterThanOrEqual(before.seconds - 0.05);
  });
});
