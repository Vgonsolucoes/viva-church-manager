const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname, {
  isCSSEnabled: false,
});

config.resolver.sourceExts = Array.from(
  new Set([...config.resolver.sourceExts, "ts", "tsx", "cjs"]),
);

module.exports = config;
