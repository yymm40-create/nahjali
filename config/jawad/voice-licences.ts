// «صوت الجواد» — which Habibi model each dialect asks for (the owner's decision: every dialect stays offered).
// The specialised models exist for these dialects; the others use the unified model. Pure.

export const HABIBI_SPECIALISED = ["MSA", "EGY", "IRQ", "ALG", "MAR"] as const;

export const habibiModelFor = (dialect: unknown): "Specialized" | "Unified" => ((HABIBI_SPECIALISED as readonly string[]).includes(String(dialect)) ? "Specialized" : "Unified");
