import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dt_exchange/core/storage/session_store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test(
    'demo update never imports or deletes production session and preferences',
    () async {
      FlutterSecureStorage.setMockInitialValues({
        'dt.refresh.v1': 'production-token-fixture',
        'dt.biometric.v1': 'true',
        'dt.device.v1': 'production-device-fixture',
        'dt.preference.theme': 'dark',
      });
      const storage = FlutterSecureStorage();
      const demo = SessionStore(storage, namespace: 'dt.simulation.v1');
      expect(await demo.readRefreshToken(), isNull);
      expect(await demo.biometricEnabled(), false);
      expect(await demo.preference('theme'), isNull);
      expect(await demo.deviceId(), isNot('production-device-fixture'));
      await demo.writeRefreshToken('demo-token-fixture');
      await demo.clear();
      expect(
        await storage.read(key: 'dt.refresh.v1'),
        'production-token-fixture',
      );
      expect(await storage.read(key: 'dt.biometric.v1'), 'true');
      expect(
        await storage.read(key: 'dt.device.v1'),
        'production-device-fixture',
      );
      expect(await storage.read(key: 'dt.preference.theme'), 'dark');
    },
  );
}
