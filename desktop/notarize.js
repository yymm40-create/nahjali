// After the Mac build is signed: sent to Apple to be notarized when the Apple Developer secrets are there (the
// program then opens on any Mac without a warning). Without them nothing happens here.
const { notarize } = require("@electron/notarize");

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir, packager } = context;
  if (electronPlatformName !== "darwin") return;
  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID, CSC_LINK } = process.env;
  if (!CSC_LINK || !APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    console.log("notarize: no Apple Developer secrets; skipped (the build is signed ad hoc)");
    return;
  }
  await notarize({
    appPath: `${appOutDir}/${packager.appInfo.productFilename}.app`,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
    teamId: APPLE_TEAM_ID,
  });
};
