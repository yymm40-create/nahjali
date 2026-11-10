// The project left open in «حيدرة كت»: the projects page offers it as «كمّل» at the top (it never opens it by itself,
// which kept sending the person back when they came to start a new one); «اطلع من المشروع» forgets it. This device only.

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
