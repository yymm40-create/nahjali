// The film maker's Seedance versions ⇄ JAWAD AI's video generators (used when a film video goes to the video section
// and back). «Seedance وجه واقعي» stays itself both ways.

import { REALFACE_ID } from "@config/jawad/realface";

/** The film's video model → the video section's generator. */
const GENERATOR_OF: Record<string, string> = { "seedance-2.0": "byteplus-seedance-2-0", "seedance-2.5": "byteplus-seedance-2-5", "seedance-real-face": REALFACE_ID, "wan-3.0": "wan-3-0" };
export const generatorOfFilmModel = (model: string) => GENERATOR_OF[model] ?? GENERATOR_OF["seedance-2.5"];
export const filmModelOfGenerator = (id: string) => Object.keys(GENERATOR_OF).find((m) => GENERATOR_OF[m] === id) ?? "seedance-2.5";
