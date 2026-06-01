const { withEntitlementsPlist } = require("@expo/config-plugins");

const APP_GROUP = "group.com.canakyuz.helmmobile.shared";

/** Force App Group entitlements on every prebuild. */
function withHelmIosEntitlements(config) {
  return withEntitlementsPlist(config, (entitlements) => {
    entitlements["com.apple.security.application-groups"] = [APP_GROUP];
    return entitlements;
  });
}

module.exports = withHelmIosEntitlements;
