// «صوت الجواد» — which voices may be SOLD and which may not. By the owner's decision the generator offers BOTH kinds
// (commercial and non-commercial), each marked in its own name, and this must never be taken away: the choice and its
// consequences are the owner's (voice-engine/habibi/README.md). Pure.
//
// Habibi-TTS (hf://SWivid/Habibi-TTS): the specialised models for MSA, EGY, IRQ, ALG and MAR are Apache-2.0 (commercial);
// the unified model and the Saudi and Emirati ones are CC-BY-NC-SA-4.0 (non-commercial: SADA and Mixat data).
// Chatterbox Multilingual (Resemble AI) is MIT (commercial).

/** The Habibi dialects whose model is commercial (Apache-2.0). */
export const HABIBI_COMMERCIAL = ["MSA", "EGY", "IRQ", "ALG", "MAR"] as const;

export const isHabibiCommercial = (dialect: unknown): boolean => (HABIBI_COMMERCIAL as readonly string[]).includes(String(dialect));

/** The model a Habibi request asks for: the Apache specialised one for a commercial dialect, else the unified one (non-commercial). */
export const habibiModelFor = (dialect: unknown): "Specialized" | "Unified" => (isHabibiCommercial(dialect) ? "Specialized" : "Unified");

export const LICENCE_MARK = { commercial: "🟢 تجاري", noncommercial: "🟠 غير تجاري" } as const;
