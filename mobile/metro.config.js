// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Fix: @noble/hashes and other packages that use package.json "exports"
// but have subpaths not listed (e.g. ./crypto.js). Metro needs to fall back
// to filesystem resolution for these.
config.resolver = {
  ...config.resolver,
  // Allow Metro to resolve files not in "exports" map via filesystem fallback
  unstable_enablePackageExports: false,
};

module.exports = withNativeWind(config, { input: './global.css' });
