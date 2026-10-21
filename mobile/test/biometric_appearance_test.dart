import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dt_exchange/core/storage/session_store.dart';
import 'package:dt_exchange/core/storage/device_authenticator.dart';
import 'package:dt_exchange/core/design/appearance.dart';
import 'package:dt_exchange/core/design/theme.dart';
import 'package:dt_exchange/core/api/api_client.dart';
import 'package:dio/dio.dart';
import 'dart:typed_data';

class SessionAdapter implements HttpClientAdapter {
  int calls = 0;
  bool expired = false;
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    calls++;
    return ResponseBody.fromString(
      expired
          ? '{}'
          : '{"accessToken":"test-access","refreshToken":"test-refresh"}',
      expired ? 401 : 200,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

class FakeBiometrics implements DeviceAuthenticator {
  bool supported = true, accepted = true;
  int prompts = 0;
  @override
  Future<bool> get available async => supported;
  @override
  Future<bool> unlock({required String reason}) async {
    prompts++;
    return accepted;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  test(
    'biometric enable requires enrolled hardware and OS success, then persists across restart',
    () async {
      final os = FakeBiometrics(),
          store = SessionStore(
            const FlutterSecureStorage(),
            authenticator: FakeBiometrics(),
          );
      final protected = SessionStore(
        const FlutterSecureStorage(),
        authenticator: os,
      );
      os.supported = false;
      await expectLater(protected.setBiometric(true), throwsStateError);
      expect(await protected.biometricEnabled(), false);
      os.supported = true;
      os.accepted = false;
      await expectLater(protected.setBiometric(true), throwsStateError);
      expect(await protected.biometricEnabled(), false);
      os.accepted = true;
      await protected.setBiometric(true);
      expect(await store.biometricEnabled(), true);
      os.accepted = false;
      expect(await protected.unlockSession(), false);
      os.accepted = true;
      expect(await protected.unlockSession(), true);
      await protected.setBiometric(false);
      os.accepted = false;
      final before = os.prompts;
      expect(await protected.unlockSession(), true);
      expect(os.prompts, before);
    },
  );
  test(
    'session logout clears token but preserves independent appearance and biometric preference',
    () async {
      final store = SessionStore(
        const FlutterSecureStorage(),
        authenticator: FakeBiometrics(),
      );
      await store.writeRefreshToken('test-only-token');
      await store.setBiometric(true);
      await store.savePreference('appearance', 'dark');
      await store.clear();
      expect(await store.readRefreshToken(), null);
      expect(await store.biometricEnabled(), true);
      expect(await store.preference('appearance'), 'dark');
    },
  );
  test(
    'cancelled biometrics block session refresh; successful unlock rotates once; expired session returns to normal authentication',
    () async {
      final os = FakeBiometrics(),
          store = SessionStore(
            const FlutterSecureStorage(),
            authenticator: FakeBiometrics(),
          );
      await store.writeRefreshToken('test-refresh');
      await store.setBiometric(true);
      final guarded = SessionStore(
            const FlutterSecureStorage(),
            authenticator: os,
          ),
          adapter = SessionAdapter(),
          dio = Dio(BaseOptions(baseUrl: 'https://api.example.invalid'));
      dio.httpClientAdapter = adapter;
      final session = ApiSession(dio, guarded);
      os.accepted = false;
      await expectLater(session.refresh(), throwsStateError);
      expect(adapter.calls, 0);
      expect(session.accessToken, null);
      os.accepted = true;
      await session.refresh();
      expect(adapter.calls, 1);
      final prompts = os.prompts;
      await session.refresh();
      expect(os.prompts, prompts);
      adapter.expired = true;
      await expectLater(session.refresh(), throwsA(isA<DioException>()));
      expect(session.accessToken, null);
      expect(await guarded.readRefreshToken(), null);
      await session.accept({
        'accessToken': 'normal-login-access',
        'refreshToken': 'normal-login-refresh',
      });
      expect(session.accessToken, 'normal-login-access');
      dio.close();
    },
  );
  test(
    'Light Dark and System persist and restore; corrupt preference safely uses System',
    () async {
      final store = SessionStore(
        const FlutterSecureStorage(),
        authenticator: FakeBiometrics(),
      );
      for (final mode in ThemeMode.values) {
        final container = ProviderContainer(
          overrides: [sessionStoreProvider.overrideWithValue(store)],
        );
        await container.read(appearanceProvider.future);
        await container.read(appearanceProvider.notifier).select(mode);
        container.dispose();
        final restarted = ProviderContainer(
          overrides: [sessionStoreProvider.overrideWithValue(store)],
        );
        expect(await restarted.read(appearanceProvider.future), mode);
        restarted.dispose();
      }
      await store.savePreference('appearance', 'invalid');
      final container = ProviderContainer(
        overrides: [sessionStoreProvider.overrideWithValue(store)],
      );
      expect(await container.read(appearanceProvider.future), ThemeMode.system);
      container.dispose();
    },
  );
  testWidgets(
    'appearance control fits narrow large-text layout and dark colors remain distinct',
    (tester) async {
      tester.view.physicalSize = const Size(320, 780);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            theme: dtDarkTheme,
            home: MediaQuery(
              data: const MediaQueryData(textScaler: TextScaler.linear(1.5)),
              child: const Scaffold(
                body: Padding(
                  padding: EdgeInsets.all(16),
                  child: AppearancePicker(),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('System Default'), findsOneWidget);
      expect(tester.takeException(), null);
      final theme = Theme.of(tester.element(find.byType(AppearancePicker)));
      expect(theme.brightness, Brightness.dark);
      expect(theme.colorScheme.onSurface, isNot(theme.colorScheme.surface));
    },
  );
}
