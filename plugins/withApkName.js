const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Renames the built APK from Gradle's generic "app-release.apk" to
 * "MedicineReminder-v<version>-<buildType>.apk", so the file you download
 * and save actually says what it is.
 */
module.exports = function withApkName(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') return config;

    const snippet = `
android {
    applicationVariants.all { variant ->
        variant.outputs.all { output ->
            outputFileName = "MedicineReminder-v\${variant.versionName}-\${variant.name}.apk"
        }
    }
`;

    if (!config.modResults.contents.includes('outputFileName')) {
      config.modResults.contents = config.modResults.contents.replace(/android\s*{/, snippet);
    }

    return config;
  });
};
