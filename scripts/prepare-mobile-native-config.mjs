import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const channel = process.env.WAITERO_MOBILE_CHANNEL === 'dev' ? 'dev' : 'prod';
const appId = channel === 'dev' ? 'com.waitero.app.dev' : 'com.waitero.app';
const appName = channel === 'dev' ? 'waitero - dev' : 'waitero';

const androidBuildGradlePath = resolve('android/app/build.gradle');
const androidStringsPath = resolve('android/app/src/main/res/values/strings.xml');
const iosInfoPlistPath = resolve('ios/App/App/Info.plist');
const iosProjectPath = resolve('ios/App/App.xcodeproj/project.pbxproj');

const androidBuildGradle = readFileSync(androidBuildGradlePath, 'utf8')
  .replace(/applicationId\s+"[^"]+"/, `applicationId "${appId}"`);
writeFileSync(androidBuildGradlePath, androidBuildGradle, 'utf8');

const androidStrings = `<?xml version='1.0' encoding='utf-8'?>
<resources>
    <string name="app_name">${escapeXml(appName)}</string>
    <string name="title_activity_main">${escapeXml(appName)}</string>
    <string name="package_name">${escapeXml(appId)}</string>
    <string name="custom_url_scheme">${escapeXml(appId)}</string>
</resources>
`;
writeFileSync(androidStringsPath, androidStrings, 'utf8');

const iosInfoPlist = readFileSync(iosInfoPlistPath, 'utf8').replace(
  /<key>CFBundleDisplayName<\/key>\s*<string>[^<]*<\/string>/,
  `<key>CFBundleDisplayName</key>\n\t<string>${escapeXml(appName)}</string>`
);
writeFileSync(iosInfoPlistPath, iosInfoPlist, 'utf8');

const iosProject = readFileSync(iosProjectPath, 'utf8').replace(
  /PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g,
  `PRODUCT_BUNDLE_IDENTIFIER = ${appId};`
);
writeFileSync(iosProjectPath, iosProject, 'utf8');

console.log(`Prepared mobile native config for ${channel}: ${appName} (${appId})`);

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
