// Writes the device copy of the picked style (see src/lib/mahdi/look-pick.ts). When the account kept the pick, the
// copy is not needed and is removed.

import type { MahdiTheme } from "@config/mahdi";
import { PICK_COOKIE, PICK_MAX_AGE, writePickValue } from "../look-pick";

export function rememberPick(user: string, pick: MahdiTheme, accountTheme: MahdiTheme) {
  if (typeof document === "undefined") return;
  try {
    if (pick === accountTheme) document.cookie = `${PICK_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    else document.cookie = `${PICK_COOKIE}=${encodeURIComponent(writePickValue({ user, pick, saw: accountTheme }))}; Path=/; Max-Age=${PICK_MAX_AGE}; SameSite=Lax`;
  } catch {
    /* cookies blocked: the account's own look is used */
  }
}
