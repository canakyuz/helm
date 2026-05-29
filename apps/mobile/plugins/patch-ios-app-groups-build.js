/**
 * Main app must have REGISTER_APP_GROUPS=YES to write App Group containers.
 */
const fs = require("fs");
const path = require("path");

function patchPbxproj(projectRoot, bundleId) {
  const pbx = path.join(projectRoot, "ios", "helm.xcodeproj", "project.pbxproj");
  if (!fs.existsSync(pbx)) {
    console.warn("[app-groups] ios/helm.xcodeproj not found, skip");
    return;
  }

  const marker = "REGISTER_APP_GROUPS = YES";
  const needle = `PRODUCT_BUNDLE_IDENTIFIER = ${bundleId};`;
  let source = fs.readFileSync(pbx, "utf8");
  const parts = source.split(needle);
  if (parts.length < 2) {
    console.warn("[app-groups] helm bundle id not in pbxproj");
    return;
  }

  let changed = false;
  const rebuilt = parts
    .map((block, i) => {
      if (i === 0) return block;
      if (block.includes(marker)) return block;
      changed = true;
      return `\n\t\t\t\t${marker};${block}`;
    })
    .join(needle);

  if (!changed) {
    console.log("[app-groups] helm target already has REGISTER_APP_GROUPS");
    return;
  }

  fs.writeFileSync(pbx, rebuilt);
  console.log("[app-groups] added REGISTER_APP_GROUPS to helm target");
}

if (require.main === module) {
  patchPbxproj(path.join(__dirname, ".."), "com.canakyuz.helmmobile");
}

module.exports = { patchPbxproj };
