/**
 * Harden ExtensionStorage: App Group file mirror + synchronize + Bool result.
 */
const fs = require("fs");
const path = require("path");

const SET_STRING_BODY = `Function("setString") { (key: String, value: String, group: String?) -> Bool in
            guard let group else { return false }
            guard let userDefaults = UserDefaults(suiteName: group) else { return false }
            userDefaults.set(value, forKey: key)
            userDefaults.synchronize()
            if key == "helm_widget_payload",
               let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) {
                let url = base.appendingPathComponent("helm_widget_payload.json")
                do {
                    try value.write(to: url, atomically: true, encoding: .utf8)
                    return true
                } catch {
                    return false
                }
            }
            return userDefaults.string(forKey: key) == value
        }`;

const IOS_DEPLOYMENT = "16.4";

function patchExtensionStoragePodspec(projectRoot) {
  const target = path.join(
    projectRoot,
    "node_modules",
    "@bacons",
    "apple-targets",
    "ios",
    "ExtensionStorage.podspec",
  );
  if (!fs.existsSync(target)) return;

  let source = fs.readFileSync(target, "utf8");
  let next = source.replace(
    /s\.platform\s*=\s*:ios,\s*['"][\d.]+['"]/,
    `s.platform       = :ios, '${IOS_DEPLOYMENT}'`,
  );
  next = next.replace(
    /s\.platforms\s*=\s*\{[^}]*:ios\s*=>\s*['"][\d.]+['"][^}]*\}/,
    `s.platforms      = { :ios => '${IOS_DEPLOYMENT}' }`,
  );
  if (next !== source) {
    fs.writeFileSync(target, next);
    console.log(`[widget-file] ExtensionStorage.podspec → iOS ${IOS_DEPLOYMENT}`);
  }
}

function patchExtensionStorageModule(projectRoot) {
  const target = path.join(
    projectRoot,
    "node_modules",
    "@bacons",
    "apple-targets",
    "ios",
    "ExtensionStorageModule.swift",
  );

  if (!fs.existsSync(target)) {
    console.warn("[widget-file] ExtensionStorageModule.swift not found, skip");
    return;
  }

  let source = fs.readFileSync(target, "utf8");
  const start = source.indexOf('Function("setString")');
  const end = source.indexOf('Function("get")');
  if (start === -1 || end === -1 || end <= start) {
    console.warn("[widget-file] setString block not found, skip");
    return;
  }

  const next = source.slice(0, start) + SET_STRING_BODY + "\n\n        " + source.slice(end);
  if (next === source) return;

  fs.writeFileSync(target, next);
  console.log("[widget-file] patched ExtensionStorageModule.swift (Bool + file mirror)");
}

function patchExtensionStorage(projectRoot) {
  patchExtensionStoragePodspec(projectRoot);
  patchExtensionStorageModule(projectRoot);
}

if (require.main === module) {
  patchExtensionStorage(path.join(__dirname, ".."));
}

module.exports = {
  patchExtensionStorage,
  patchExtensionStorageModule,
  patchExtensionStoragePodspec,
};
