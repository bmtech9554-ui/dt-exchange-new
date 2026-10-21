import 'dart:math';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'device_authenticator.dart';
import '../../public_test/test_mode.dart';

final sessionStoreProvider = Provider<SessionStore>(
  (_) => const SessionStore(
    FlutterSecureStorage(
      aOptions: AndroidOptions(encryptedSharedPreferences: true),
      iOptions: IOSOptions(
        accessibility: KeychainAccessibility.first_unlock_this_device,
      ),
    ),
  ),
);

class SessionStore {
  const SessionStore(
    this._storage, {
    this.authenticator = const OsDeviceAuthenticator(),
    this.namespace = publicTestMode ? 'dt.simulation.v1' : 'dt',
  });
  final FlutterSecureStorage _storage;
  final DeviceAuthenticator authenticator;
  // An in-place demo update never reads, overwrites or transmits the existing
  // production refresh token, biometric preference, or device identifier.
  final String namespace;
  Future<bool> biometricEnabled() async =>
      await _storage.read(key: '$namespace.biometric.v1') == 'true';
  Future<void> setBiometric(bool enabled) async {
    if (enabled && !await authenticator.available) {
      throw StateError(
        'Biometrics are unavailable. Enroll a fingerprint or face in device settings.',
      );
    }
    if (enabled &&
        !await authenticator.unlock(
          reason: 'Enable DT Exchange biometric login',
        )) {
      throw StateError(
        'Biometric authentication was cancelled or unavailable.',
      );
    }
    await _storage.write(
      key: '$namespace.biometric.v1',
      value: enabled.toString(),
    );
  }

  Future<bool> unlockSession() async =>
      !await biometricEnabled() ||
      await authenticator.unlock(reason: 'Unlock your DT Exchange session');
  Future<String?> preference(String key) =>
      _storage.read(key: '$namespace.preference.$key');
  Future<void> savePreference(String key, String value) =>
      _storage.write(key: '$namespace.preference.$key', value: value);
  String get _refreshKey => '$namespace.refresh.v1';
  Future<String?> readRefreshToken() => _storage.read(key: _refreshKey);
  Future<void> writeRefreshToken(String value) =>
      _storage.write(key: _refreshKey, value: value);
  Future<String> deviceId() async {
    final existing = await _storage.read(key: '$namespace.device.v1');
    if (existing != null) return existing;
    final id = List.generate(
      24,
      (_) => Random.secure().nextInt(256).toRadixString(16).padLeft(2, '0'),
    ).join();
    await _storage.write(key: '$namespace.device.v1', value: id);
    return id;
  }

  Future<void> clear() => _storage.delete(key: _refreshKey);
}
