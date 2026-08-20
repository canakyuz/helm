/**
 * When using prebuilt React-Core, ReactCodegen may not see Fabric C++ headers.
 * Prefer ios.buildReactNativeFromSource=true in Podfile.properties.json (official fix).
 * This script only patches xcconfigs when prebuilt mode is active.
 */
const fs = require("fs");
const path = require("path");

const MARKER_LINE = "// helm-react-codegen-fabric-headers";
const VFS_FLAG = "-ivfsoverlay $(PODS_ROOT)/React-Core-prebuilt/React-VFS.yaml";

function readPodfileProperties(projectRoot) {
  const file = path.join(projectRoot, "ios", "Podfile.properties.json");
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function fabricHeaderPaths(projectRoot) {
  const rnRoot = path.join(projectRoot, "node_modules", "react-native");
  return [
    path.join(rnRoot, "ReactCommon"),
    path.join(
      rnRoot,
      "ReactCommon/react/renderer/components/view/platform/cxx",
    ),
  ];
}

function usesPrebuiltCore(projectRoot) {
  const props = readPodfileProperties(projectRoot);
  return props["ios.buildReactNativeFromSource"] !== "true";
}

function patchXcconfig(xcconfigPath, headerPaths) {
  if (!fs.existsSync(xcconfigPath)) return false;

  let text = fs.readFileSync(xcconfigPath, "utf8");
  if (text.includes(MARKER_LINE)) return false;
  if (!text.includes(VFS_FLAG)) return false;

  for (const dir of headerPaths) {
    const quoted = `"${dir}"`;
    if (!text.includes(dir)) {
      text = text.replace(
        /^HEADER_SEARCH_PATHS = (.+)$/m,
        (_, paths) => `HEADER_SEARCH_PATHS = ${paths} ${quoted}`,
      );
    }
  }

  text = `${MARKER_LINE}\n${text}`;
  fs.writeFileSync(xcconfigPath, text);
  return true;
}

function fixReactCodegenHeaders(projectRoot) {
  if (!usesPrebuiltCore(projectRoot)) {
    console.log("[pods] ReactCodegen: skipped (ios.buildReactNativeFromSource=true)");
    return false;
  }

  const headerPaths = fabricHeaderPaths(projectRoot);
  if (!fs.existsSync(headerPaths[0])) {
    console.warn("[pods] react-native/ReactCommon not found - skip ReactCodegen header fix");
    return false;
  }

  const supportDir = path.join(
    projectRoot,
    "ios",
    "Pods",
    "Target Support Files",
    "ReactCodegen",
  );
  const names = ["ReactCodegen.debug.xcconfig", "ReactCodegen.release.xcconfig"];
  let patched = 0;

  for (const name of names) {
    if (patchXcconfig(path.join(supportDir, name), headerPaths)) patched += 1;
  }

  if (patched > 0) {
    console.log(`[pods] ReactCodegen: added Fabric HEADER_SEARCH_PATHS (${patched} xcconfig)`);
  } else {
    console.log("[pods] ReactCodegen: already patched or prebuilt xcconfig missing");
  }
  return patched > 0;
}

if (require.main === module) {
  fixReactCodegenHeaders(path.join(__dirname, ".."));
}

module.exports = { fixReactCodegenHeaders, usesPrebuiltCore };
