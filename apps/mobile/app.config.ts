import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Helm",
  slug: "helm-mobile",
  scheme: "helmmobile",
  version: "0.1.3",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.canakyuz.helmmobile",
    // Required by @bacons/apple-targets on EAS (not only local .env).
    appleTeamId: process.env.EXPO_APPLE_TEAM_ID ?? "AZPJSKX9C9",
    buildNumber: "12",
    icon: {
      // HELM iOS asset set (1024×1024): Default / Dark / Clear Light (tinted home screen)
      light: "./assets/icon.png",
      dark: "./assets/icon-dark.png",
      tinted: "./assets/icon-tinted.png",
    },
    entitlements: {
      "com.apple.security.application-groups": [
        "group.com.canakyuz.helmmobile.shared",
      ],
      // Push notifications. TestFlight (preview profile) ships a release build →
      // production APNs. A development dev-client build would need "development".
      "aps-environment": "production",
    },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSLocationWhenInUseUsageDescription:
        "Helm does not use your location. This description is required because a linked library references location APIs.",
    },
  },
  android: {
    package: "com.canakyuz.helmmobile",
    adaptiveIcon: {
      foregroundImage: "./assets/icon.png",
      backgroundColor: "#000000",
    },
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-splash-screen",
      {
        image: "./assets/splash-icon.png",
        imageWidth: 220,
        resizeMode: "contain",
        backgroundColor: "#000000",
        dark: {
          image: "./assets/splash-icon.png",
          backgroundColor: "#000000",
        },
      },
    ],
    "expo-status-bar",
    "expo-sqlite",
    "expo-image",
    "expo-notifications",
    "@bacons/apple-targets",
    "./plugins/with-helm-ios-entitlements.js",
    "./plugins/with-ios-register-app-groups.js",
    "./plugins/with-fix-cocoapods-modulemaps.js",
    "./plugins/with-ios-podfile-properties.js",
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: "50633212-d796-4d08-8059-e79d5e986a6b",
    },
  },
  updates: {
    url: "https://u.expo.dev/50633212-d796-4d08-8059-e79d5e986a6b",
  },
  runtimeVersion: {
    policy: "appVersion",
  },
});
