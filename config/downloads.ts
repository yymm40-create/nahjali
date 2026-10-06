// The programs' download links: the latest builds, by fixed names (.github/workflows/desktop.yml and mobile.yml), so a
// new build reaches the links without changing the site.
const RELEASES = "https://github.com/yymm40-create/nahjali/releases";

export const DOWNLOADS = {
  mac: `${RELEASES}/latest/download/Haidara-Cut-mac.dmg`,
  windows: `${RELEASES}/latest/download/Haidara-Cut-Setup.exe`,
  android: `${RELEASES}/download/android-latest/NahjAli.apk`,
  /** the App Store page, once the app is published there (null: «قريبًا») */
  ios: null as string | null,
  /** Google Play, once published (null: the .apk above) */
  play: null as string | null,
};
