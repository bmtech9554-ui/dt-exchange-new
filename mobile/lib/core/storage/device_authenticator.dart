import 'package:local_auth/local_auth.dart';

/// Device-only session gate. No biometric data leaves the OS.
abstract interface class DeviceAuthenticator {
  Future<bool> get available;
  Future<bool> unlock({required String reason});
}

class OsDeviceAuthenticator implements DeviceAuthenticator {
  const OsDeviceAuthenticator();
  @override
  Future<bool> get available async {
    try {
      final auth = LocalAuthentication();
      return await auth.isDeviceSupported() &&
          await auth.canCheckBiometrics &&
          (await auth.getAvailableBiometrics()).isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<bool> unlock({required String reason}) async {
    try {
      return await LocalAuthentication().authenticate(
        localizedReason: reason,
        biometricOnly: true,
        persistAcrossBackgrounding: false,
      );
    } catch (_) {
      return false;
    }
  }
}
