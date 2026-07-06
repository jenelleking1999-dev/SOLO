const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * The RECORD_AUDIO permission (added for voice input) makes Google Play treat
 * `android.hardware.microphone` as a REQUIRED feature by default, which filters
 * out devices without a microphone. Voice is optional in this app, so we declare
 * the microphone (and audio output) as NOT required to keep those devices
 * supported.
 */
const OPTIONAL_FEATURES = [
  'android.hardware.microphone',
  'android.hardware.audio.output',
];

module.exports = function withOptionalMicrophone(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    if (!Array.isArray(manifest['uses-feature'])) {
      manifest['uses-feature'] = [];
    }

    for (const name of OPTIONAL_FEATURES) {
      const existing = manifest['uses-feature'].find(
        (f) => f && f.$ && f.$['android:name'] === name
      );
      if (existing) {
        existing.$['android:required'] = 'false';
      } else {
        manifest['uses-feature'].push({
          $: { 'android:name': name, 'android:required': 'false' },
        });
      }
    }

    return cfg;
  });
};
