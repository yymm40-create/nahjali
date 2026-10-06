// The project left open in «حيدرة كت»: going to another section and pressing «حيدرة كت» again opens it straight
// back (not the projects page); «اطلع من المشروع» forgets it. Kept on this device only.

const KEY = "editor-open-project";

export function rememberOpen(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // private mode: «حيدرة كت» just opens on the projects page
  }
}

export function forgetOpen() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export function openProject(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
