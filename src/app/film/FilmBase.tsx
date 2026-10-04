"use client";

import { createContext, useContext } from "react";

/**
 * Where the film maker's pages live: "/film" on the main site, "/jawad-ai/film" inside «الجواد الذكي!».
 * Same projects, stages, approvals and data; only the links between pages follow the place it is opened from.
 */
const FilmBaseContext = createContext("/film");

export const useFilmBase = () => useContext(FilmBaseContext);

export function FilmBaseProvider({ base, children }: { base: string; children: React.ReactNode }) {
  return <FilmBaseContext.Provider value={base}>{children}</FilmBaseContext.Provider>;
}
