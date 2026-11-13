/**
 * What counts as a native change, for the purposes of `runtimeVersion`.
 *
 * `app.json` sets `runtimeVersion.policy` to `fingerprint`, so an install only
 * accepts an OTA update published under a fingerprint identical to its own.
 * That is what makes it impossible to push a JS bundle that needs a native
 * module the installed APK does not have.
 *
 * The fingerprint hashes the resolved Expo config, and `version` is part of it,
 * so without this file every version bump would change the fingerprint even
 * though nothing native moved, and each release would cut off every install
 * before it from OTA updates.
 *
 * `ExpoConfigVersions` drops `version`, `android.versionCode` and
 * `ios.buildNumber` from the hash: exactly the fields that change on a release
 * and cannot affect the native build. A new config plugin, Expo module,
 * permission, icon or SDK bump still produces a new runtime version and still
 * correctly requires a fresh APK.
 *
 * @type {import('@expo/fingerprint').Config}
 */
module.exports = {
  sourceSkips: ['ExpoConfigVersions'],
};
