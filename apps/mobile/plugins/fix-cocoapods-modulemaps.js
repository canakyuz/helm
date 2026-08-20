/**
 * CocoaPods sets MODULEMAP_FILE to Headers/Public/<Pod>/<Pod>.modulemap but often
 * only generates files under Target Support Files/<Pod>/.
 * Swift pods use -import-underlying-module and fail without these symlinks.
 */
const fs = require("fs");
const path = require("path");

function umbrellaHeaderForModulemap(modulemapPath) {
  const text = fs.readFileSync(modulemapPath, "utf8");
  const match = text.match(/umbrella header "([^"]+)"/);
  return match ? match[1] : null;
}

function discoverPodsWithModulemaps(podsRoot) {
  const supportRoot = path.join(podsRoot, "Target Support Files");
  if (!fs.existsSync(supportRoot)) return [];

  const pods = [];
  for (const name of fs.readdirSync(supportRoot)) {
    const dir = path.join(supportRoot, name);
    if (!fs.statSync(dir).isDirectory()) continue;
    const map = path.join(dir, `${name}.modulemap`);
    if (fs.existsSync(map)) pods.push(name);
  }
  return pods.sort();
}

function linkPodPublicHeaders(podsRoot, podName) {
  const supportDir = path.join(podsRoot, "Target Support Files", podName);
  const modulemapPath = path.join(supportDir, `${podName}.modulemap`);
  if (!fs.existsSync(modulemapPath)) return false;

  const files = [`${podName}.modulemap`];
  const umbrella = umbrellaHeaderForModulemap(modulemapPath);
  if (umbrella) files.push(umbrella);

  const publicDir = path.join(podsRoot, "Headers", "Public", podName);
  fs.mkdirSync(publicDir, { recursive: true });

  let linked = 0;
  for (const file of files) {
    const src = path.join(supportDir, file);
    if (!fs.existsSync(src)) continue;
    const dst = path.join(publicDir, file);
    if (fs.existsSync(dst)) fs.rmSync(dst, { force: true });
    fs.symlinkSync(src, dst);
    linked += 1;
  }

  if (linked > 0) {
    console.log(`[pods] linked ${podName} public headers (${linked} files)`);
  }
  return linked > 0;
}

function fixCocoaPodsModulemaps(projectRoot) {
  const podsRoot = path.join(projectRoot, "ios", "Pods");
  if (!fs.existsSync(podsRoot)) {
    console.warn("[pods] ios/Pods not found - run pod install first");
    return 0;
  }

  const pods = discoverPodsWithModulemaps(podsRoot);
  let ok = 0;
  for (const podName of pods) {
    if (linkPodPublicHeaders(podsRoot, podName)) ok += 1;
  }
  console.log(`[pods] modulemap fix: ${ok}/${pods.length} pods`);
  return ok;
}

function runAllPodFixes(projectRoot) {
  fixCocoaPodsModulemaps(projectRoot);
  const { fixReactCodegenHeaders } = require("./fix-react-codegen-headers");
  fixReactCodegenHeaders(projectRoot);
}

if (require.main === module) {
  runAllPodFixes(path.join(__dirname, ".."));
}

module.exports = {
  fixCocoaPodsModulemaps,
  discoverPodsWithModulemaps,
  runAllPodFixes,
};
