/**
 * Keep a single App Group in native entitlements (matches widget-sync.ts).
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const GROUP = "group.com.canakyuz.helmmobile.shared";

const FILES = [
  path.join(ROOT, "ios/helm/helm.entitlements"),
  path.join(ROOT, "targets/widget/generated.entitlements"),
];

function syncEntitlements(filePath) {
  if (!fs.existsSync(filePath)) return;

  let xml = fs.readFileSync(filePath, "utf8");
  xml = xml.replace(
    /<key>com\.apple\.security\.application-groups<\/key>\s*<array>[\s\S]*?<\/array>/,
    `<key>com.apple.security.application-groups</key>
\t<array>
\t\t<string>${GROUP}</string>
\t</array>`,
  );
  fs.writeFileSync(filePath, xml);
  console.log(`[app-group] synced ${path.relative(ROOT, filePath)}`);
}

function main() {
  for (const file of FILES) syncEntitlements(file);
}

main();
