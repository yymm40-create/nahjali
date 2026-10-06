// The programs' download links: the latest builds, by fixed names (.github/workflows/desktop.yml and mobile.yml), so a
// new build reaches the links without changing the site.
const RELEASES = "https://github.com/yymm40-create/nahjali/releases";

export const DOWNLOADS = {
  mac: `${RELEASES}/latest/download/JAWAD-AI-mac.dmg`,
  /** how to open it the first time (the Mac asks once, the program isn't signed by Apple yet) */
  macGuide: "/downloads/jawad-ai-mac-guide.pdf",
  windows: `${RELEASES}/latest/download/JAWAD-AI-Setup.exe`,
  android: `${RELEASES}/download/android-latest/NahjAli.apk`,
  /** the App Store page, once the app is published there (null: «قريبًا») */
  ios: null as string | null,
  /** Google Play, once published (null: the .apk above) */
  play: null as string | null,
};

/** The desktop program's newest version: an older one shows «نسخة جديدة» inside it (DesktopUpdate). */
export const DESKTOP_LATEST = "1.2.0";
