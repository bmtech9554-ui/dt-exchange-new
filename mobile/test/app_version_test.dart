import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:dt_exchange/core/api/app_version.dart';
import 'package:dt_exchange/core/api/api_client.dart';
import 'package:dt_exchange/features/manual/android_update.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

void main() {
  test('API version and update comparison use the same build identity', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    expect(
      container.read(apiClientProvider).options.headers['x-dt-version-code'],
      appVersionCode.toString(),
    );
    expect(updateRequired({
      'available': true,
      'minimumVersionCode': appVersionCode,
      'latestVersionCode': appVersionCode,
    }, appVersionCode), false);
  });

  test('development fallback matches pubspec; release requires explicit version', () {
    const supplied = bool.hasEnvironment('APP_VERSION_CODE');
    if (!supplied) {
      final pubspec = File('pubspec.yaml').readAsStringSync();
      final number = RegExp(r'version:\s*\S+\+(\d+)').firstMatch(pubspec)![1]!;
      expect(appVersionCode, int.parse(number));
      expect(() => validateAppVersion(release: true), throwsStateError);
    } else if (appVersionCode > 0) {
      expect(() => validateAppVersion(release: true), returnsNormally);
    } else {
      expect(() => validateAppVersion(release: true), throwsStateError);
    }
  });
}
