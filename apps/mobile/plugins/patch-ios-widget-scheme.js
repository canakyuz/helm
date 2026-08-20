/**
 * Ensures `helm` Xcode scheme builds HelmWidgetExtension (WidgetKit won't register otherwise).
 * Run after `expo prebuild -p ios`.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PBX = path.join(ROOT, "ios/helm.xcodeproj/project.pbxproj");
const SCHEME = path.join(
  ROOT,
  "ios/helm.xcodeproj/xcshareddata/xcschemes/helm.xcscheme",
);

function findWidgetTargetId(pbx) {
  const match = pbx.match(/\t\t(\S+) \/\* HelmWidgetExtension \*\/ = \{\n\t\t\tisa = PBXNativeTarget;/);
  return match?.[1] ?? null;
}

function patchScheme(schemeXml, targetId) {
  if (schemeXml.includes("HelmWidgetExtension")) return schemeXml;

  const entry = `         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "YES"
            buildForAnalyzing = "YES">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "${targetId}"
               BuildableName = "HelmWidgetExtension.appex"
               BlueprintName = "HelmWidgetExtension"
               ReferencedContainer = "container:helm.xcodeproj">
            </BuildableReference>
         </BuildActionEntry>
`;

  return schemeXml.replace(
    "</BuildActionEntries>",
    `${entry}      </BuildActionEntries>`,
  );
}

function main() {
  if (!fs.existsSync(PBX) || !fs.existsSync(SCHEME)) {
    console.warn("[widget-scheme] ios project not found - skip");
    return;
  }

  const targetId = findWidgetTargetId(fs.readFileSync(PBX, "utf8"));
  if (!targetId) {
    console.error("[widget-scheme] HelmWidgetExtension target id not found in pbxproj");
    process.exit(1);
  }

  const before = fs.readFileSync(SCHEME, "utf8");
  const after = patchScheme(before, targetId);
  if (before !== after) {
    fs.writeFileSync(SCHEME, after);
    console.log("[widget-scheme] Added HelmWidgetExtension to helm scheme build action");
  } else {
    console.log("[widget-scheme] helm scheme already includes HelmWidgetExtension");
  }
}

main();
