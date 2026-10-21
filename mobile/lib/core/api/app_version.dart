/// Keep the development fallback aligned with pubspec.yaml.
/// Signed release scripts must supply APP_VERSION_CODE explicitly.
const appVersionCode = int.fromEnvironment(
  'APP_VERSION_CODE',
  defaultValue: 8018,
);

void validateAppVersion({required bool release}) {
  const supplied = bool.hasEnvironment('APP_VERSION_CODE');
  const raw = String.fromEnvironment('APP_VERSION_CODE');
  if (appVersionCode <= 0 ||
      (supplied && int.tryParse(raw) != appVersionCode) ||
      (release && !supplied)) {
    throw StateError('Release builds require a positive APP_VERSION_CODE');
  }
}
