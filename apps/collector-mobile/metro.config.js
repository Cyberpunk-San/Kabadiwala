// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// expo-sqlite's web worker imports a .wasm file. The app uses AsyncStorage on web
// instead (see src/database/sqlite.ts), but Metro still has to resolve the import.
config.resolver.assetExts.push("wasm");

module.exports = config;
