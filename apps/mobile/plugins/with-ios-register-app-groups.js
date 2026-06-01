const { withXcodeProject } = require("@expo/config-plugins");

const APP_GROUP_KEY = "com.apple.security.application-groups";

/**
 * Main app target needs REGISTER_APP_GROUPS=YES when using App Groups
 * (widget extension gets this from @bacons/apple-targets; main app does not).
 */
function withIosRegisterAppGroups(config) {
  const groups = config.ios?.entitlements?.[APP_GROUP_KEY];
  if (!Array.isArray(groups) || groups.length === 0) {
    return config;
  }

  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const bundleId = config.ios?.bundleIdentifier;
    const configurations = project.pbxXCBuildConfigurationSection();

    for (const key of Object.keys(configurations)) {
      const entry = configurations[key];
      if (!entry?.buildSettings) continue;
      const id = entry.buildSettings.PRODUCT_BUNDLE_IDENTIFIER;
      if (id === bundleId || id === `"${bundleId}"`) {
        entry.buildSettings.REGISTER_APP_GROUPS = "YES";
      }
    }

    return config;
  });
}

module.exports = withIosRegisterAppGroups;
