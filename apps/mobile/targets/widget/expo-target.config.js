/** @type {import("@bacons/apple-targets/app.plugin").ConfigFunction} */
module.exports = (config) => ({
  type: "widget",
  name: "HelmWidgetExtension",
  displayName: "helm",
  bundleIdentifier: ".helmwidgetextension",
  deploymentTarget: "16.4",
  entitlements: {
    "com.apple.security.application-groups": [
      `group.${config.ios.bundleIdentifier}.shared`,
    ],
  },
  frameworks: ["WidgetKit", "SwiftUI"],
});
