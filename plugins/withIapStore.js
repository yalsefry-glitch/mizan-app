const { withAppBuildGradle } = require("@expo/config-plugins");
module.exports = function withIapStore(config) {
  return withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    if (contents.includes('missingDimensionStrategy "store"')) {
      return config;
    }
    const defaultConfigRegex = /defaultConfig\s*\{/;
    if (defaultConfigRegex.test(contents)) {
      config.modResults.contents = contents.replace(
        defaultConfigRegex,
        'defaultConfig {\n        missingDimensionStrategy "store", "play"'
      );
    } else {
      config.modResults.contents = contents + '\nandroid {\n    defaultConfig {\n        missingDimensionStrategy "store", "play"\n    }\n}\n';
    }
    return config;
  });
};
