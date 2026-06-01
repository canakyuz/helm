const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("@expo/config-plugins");
const { patchExtensionStorage } = require("./patch-extension-storage-file");
const { patchPbxproj } = require("./patch-ios-app-groups-build");

const APP_GROUP = "group.com.canakyuz.helmmobile.shared";
const BUNDLE_ID = "com.canakyuz.helmmobile";

const MARKER_DEPLOYMENT = "# helm-minimum-ios-deployment";
const MIN_IOS = "16.4";

/**
 * ios/ is gitignored — EAS runs prebuild on the server.
 * Apply Podfile.properties + ExtensionStorage podspec + Podfile post_install here.
 */
function withIosPodfileProperties(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const iosRoot = cfg.modRequest.platformProjectRoot;

      patchExtensionStorage(projectRoot);

      const propsPath = path.join(iosRoot, "Podfile.properties.json");
      let props = {};
      if (fs.existsSync(propsPath)) {
        props = JSON.parse(fs.readFileSync(propsPath, "utf8"));
      }

      props["ios.buildReactNativeFromSource"] = "true";
      props["ios.deploymentTarget"] = MIN_IOS;

      fs.writeFileSync(propsPath, `${JSON.stringify(props, null, 2)}\n`);

      const podfilePath = path.join(iosRoot, "Podfile");
      patchPbxproj(projectRoot, BUNDLE_ID);

      for (const rel of [
        "ios/helm/helm.entitlements",
        "targets/widget/generated.entitlements",
      ]) {
        const entPath = path.join(projectRoot, rel);
        if (!fs.existsSync(entPath)) continue;
        let xml = fs.readFileSync(entPath, "utf8");
        if (xml.includes(APP_GROUP)) continue;
        xml = xml.replace(
          /<key>com\.apple\.security\.application-groups<\/key>\s*<array>[\s\S]*?<\/array>/,
          `<key>com.apple.security.application-groups</key>
\t<array>
\t\t<string>${APP_GROUP}</string>
\t</array>`,
        );
        fs.writeFileSync(entPath, xml);
      }

      if (fs.existsSync(podfilePath)) {
        let podfile = fs.readFileSync(podfilePath, "utf8");
        if (!podfile.includes(MARKER_DEPLOYMENT)) {
          const hook = `
    ${MARKER_DEPLOYMENT}
    minimum_ios = podfile_properties['ios.deploymentTarget'] || '${MIN_IOS}'
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |bc|
        current = bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        next if current.nil?
        if Gem::Version.new(current.to_s) < Gem::Version.new(minimum_ios)
          bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = minimum_ios
        end
      end
    end
`;
          podfile = podfile.replace(
            /post_install do \|installer\|/,
            `post_install do |installer|${hook}`,
          );
          fs.writeFileSync(podfilePath, podfile);
        }
      }

      return cfg;
    },
  ]);
}

module.exports = withIosPodfileProperties;
