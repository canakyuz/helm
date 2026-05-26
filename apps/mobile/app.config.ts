import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "helm",
  slug: "helm-mobile",
  scheme: "helmmobile",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.canakyuz.helmmobile",
    buildNumber: "2",
    icon: {
      light: "./assets/icon.png",
      dark: "./assets/icon-dark.png",
      tinted: "./assets/icon-tinted.png",
    },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
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
    "expo-maps",
    "expo-image",
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
