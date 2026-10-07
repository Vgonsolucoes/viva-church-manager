const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Monorepo: sempre resolver modulos a partir do app,
// evitando copias duplicadas da raiz (ex.: react do projeto web).
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];

module.exports = config;
