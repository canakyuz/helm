// Monorepo Metro config — workspace/hoisted paketleri çöz + NativeWind koru.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Monorepo: root'u izle + her iki node_modules'ı çöz.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// GEREKLİ: mobil tailwind v3'ü root'un (web) v4'ü yerine çözer. expo-doctor
// bunu uyarır ama bu monorepo'da NativeWind çözünürlüğü için şart.
config.resolver.disableHierarchicalLookup = true;

module.exports = withNativeWind(config, { input: "./global.css" });
