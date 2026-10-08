// Every editing command «حيدرة» may send, as Claude reads it (shared by the assistant and the diagnosis, which fixes
// the timeline itself with the same commands). The list mirrors lib/editor/commands.ts.

import { GRADE_COMMANDS } from "./assistant-guide";
import { FX_LIST } from "./effects";

export const COMMANDS_GUIDE = `COMMANDS: put each command in "commands" as a JSON object string. Available:
- {"type":"add_clip","assetId":ID,"at":MS?,"trackId":ID or "new"?} – put library media on the timeline (pictures/videos go to the main track, inserted at "at" or at the end; sound to a free sound track at "at", default 0; "new" = a new track of its kind, e.g. a picture over the video).
- {"type":"extract_audio","clipId":ID} – take a video clip's sound out onto a sound track, in sync (the video goes quiet); then that sound can be cut, faded or moved alone.
- {"type":"add_track","kind":"video"|"audio"|"text"}
- {"type":"lift_fix","clipId":ID} – «التعديل الذكي»: lift a video piece straight up onto the red track (role "fix"), same place, to be made again. To mark seconds A–B of a video: split at A and B, then lift the middle piece ("$N" ids work). Then {"type":"update_clip","clipId":ID,"patch":{"fix":{"note":TEXT,"mode":"parts"|"whole"}}} writes what to fix in it (parts = only that piece is made again, whole = the whole video). The person sends them from «اكتب التعديلات وأرسلها»; what is made lands on the green track (role "fixed") by itself.
- {"type":"add_text","at":MS,"body":TEXT,"duration":MS?} – a title or text over the video.
- {"type":"move_clip","clipId":ID,"trackId":ID or "new","start":MS}
- {"type":"trim_clip","clipId":ID,"edge":"start"|"end","to":MS} – move one edge of a clip to timeline time "to".
- {"type":"split","at":MS,"clipIds":[IDs]?}
- {"type":"delete","clipIds":[IDs],"ripple":BOOL} – ripple closes the gap.
- {"type":"remove_ranges","ranges":[[FROM,TO],...]} – cut timeline spans out of every track at once and close them. Use it for silences, unwanted parts and to shorten to a length; it keeps picture and sound in sync and needs no clip ids.
- {"type":"duplicate","clipId":ID}
- {"type":"update_clip","clipId":ID,"patch":{...}} – patch fields: volume 0–2, speed 0.25–3, fit "cover"|"contain", transform {x,y (0–1 centre), scale, rotate, opacity}, text {body,size (0.02–0.2 of height),color "#rrggbb",box "#rrggbbaa"|null,weight 400|700|900,font "readex"|"naskh"|"kufi" or a font id (e.g. "cairo", "tajawal", "almarai", "alexandria", "changa", "el-messiri", "lalezar", "rakkas", "lemonada", "marhey", "reem-kufi", "aref-ruqaa", "amiri", "jomhuria", "noto-nastaliq-urdu"),highlight "#rrggbb"|null}, color {preset "none"|"vivid"|"warm"|"cool"|"bw"|"vintage"|"cinema"|"fade",brightness,contrast,saturation (1 = unchanged),warmth -1..1} or null, transition {kind: one of the 100 transition ids, ms 100–4000} or null (into the next clip on the same track; they must touch), fadeIn/fadeOut MS (sound), shape "rect"|"rounded"|"circle", fx [{id, amount 0–1}] (pictures/videos only, up to 3 effects on the clip itself; the whole list replaces the old one; [] = none; ids: ${FX_LIST.map((f) => f.id).join(", ")}), own BOOL (texts only: true = this caption keeps its own look, apart from its track), anim {in, out: "fade"|"settle" (from 0.94 with a fade, no bounce: the default for texts, numbers and cards)|"pop" (bounces: only when asked)|"punch"|"blur"|"rise"|"fromRight"|"fromLeft"|"drop"|"spin"|"flip"|"glitch"|"shake"|"wipe"|"whip"|"flash" (texts also "words" word by word, "kashida" Arabic stretch; pictures also "kenburns" as "in" = slow push over the whole clip) or null, inMs, outMs 100–3000} or null (entrance and exit), sound {clean 0–1 (noise reduction), enhance BOOL (voice enhancer), effect "echo"|"reverb"|"stadium"|"cave"|"radio"|"phone"|"megaphone"|"underwater"|"robot"|null, mix 0–1 (how much of the effect), pitch −12…12 semitones (voice deeper/thinner, same length)} or null (media with sound only; good defaults for a talking voice: clean 0.8 + enhance), bg {mode "blur"|"color"|"remove",color,blur 1–100} or null (person cut from the background).
- {"type":"style_track","trackId":ID,"text":{...},"y":0–1?} – one look for every text/caption of a track (size, font, colour, box, highlight, weight; y = height on screen). Captions set apart ("own": true) keep their look.
- {"type":"transition_all","kind":ID|null,"ms":MS?,"trackId":ID?} – the same transition at every cut.
- {"type":"set_key","clipId":ID,"at":MS,"transform":{...}} – a motion point (keyframe); two or more make the clip move between them.
- {"type":"update_track","trackId":ID,"patch":{"muted"|"hidden"|"locked"|"duck":BOOL,"name":TEXT}} – duck: music goes quieter by itself under speech; name: what the track is called.
- {"type":"set_ratio","ratio":"9:16"|"16:9"|"1:1"|"4:5"}, {"type":"set_background","color":"#rrggbb"}, {"type":"set_magnetic","on":BOOL}
- {"type":"set_markers","markers":[MS],"mode":"add"|"replace"|"clear"}
${GRADE_COMMANDS}
A clip made by an earlier command in the same answer is "$N" (N = that command's position, from 1): e.g. add_clip as the 1st command, then {"type":"update_clip","clipId":"$1",...}.`;
