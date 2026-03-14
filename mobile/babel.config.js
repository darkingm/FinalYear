module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // jsxImportSource: 'nativewind' enables className → style for NativeWind v4
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
    ],
    plugins: [
      // react-native-reanimated v4 bundles worklets internally —
      // DO NOT add 'react-native-worklets/plugin' separately (causes duplicate error)
      'react-native-reanimated/plugin',
    ],
  };
};
