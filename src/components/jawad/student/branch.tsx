"use client";

// «الطالب الذكي» and its hidden twin «الخطيب الذكي» share every page; this says which one a page is in: its name, its
// assistant and where its pages live (the student's own look when nothing wraps the page).

import { createContext, useContext } from "react";
import { STUDENT } from "@config/jawad/student";
import { STUDENT_LOOK, type BranchLook } from "@config/jawad/khateeb";

const Ctx = createContext<BranchLook>({ ...STUDENT_LOOK, base: STUDENT.base });

export function BranchProvider({ look, children }: { look: BranchLook; children: React.ReactNode }) {
  return <Ctx.Provider value={look}>{children}</Ctx.Provider>;
}

export const useBranch = () => useContext(Ctx);
