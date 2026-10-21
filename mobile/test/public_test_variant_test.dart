import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:dt_exchange/app/app.dart';
import 'package:dt_exchange/app/router.dart';
import 'package:dt_exchange/core/api/api_client.dart';
import 'package:dt_exchange/features/manual/maintenance_gate.dart';
import 'package:dt_exchange/preview/preview_controller.dart';
import 'package:dt_exchange/public_test/test_auth_page.dart';
import 'package:dt_exchange/public_test/test_mode.dart';

class IsolatedAdapter implements HttpClientAdapter {
  final calls = <Uri>[];
  @override
  void close({bool force = false}) {}
  @override
  Future<ResponseBody> fetch(
    RequestOptions o,
    Stream<Uint8List>? body,
    Future<void>? cancel,
  ) async {
    calls.add(o.uri);
    return ResponseBody.fromString(
      '{}',
      200,
      headers: {
        'content-type': ['application/json'],
      },
    );
  }
}

void main() {
  if (!publicTestMode) return;
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  test(
    'compiled test variant enforces isolated API and disables redirects',
    () async {
      final scope = ProviderContainer();
      addTearDown(scope.dispose);
      final dio = scope.read(apiClientProvider);
      final adapter = IsolatedAdapter();
      dio.httpClientAdapter = adapter;
      expect(dio.options.followRedirects, false);
      await dio.get('/test/status');
      expect(adapter.calls.single.toString(), '$publicTestApi/test/status');
      await expectLater(
        dio.get('https://api.dtexchange.app/api/v1/wallet'),
        throwsA(isA<DioException>()),
      );
      expect(adapter.calls.length, 1);
    },
  );
  for (final width in [320.0, 390.0, 768.0]) {
    testWidgets('test banner and registration fit width $width', (
      tester,
    ) async {
      tester.view.physicalSize = Size(width, 800);
      tester.view.devicePixelRatio = 1;
      tester.platformDispatcher.textScaleFactorTestValue = 1.4;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      final router = GoRouter(
        routes: [
          GoRoute(
            path: '/',
            builder: (_, _) => const PublicTestAuthPage(register: true),
          ),
        ],
      );
      addTearDown(router.dispose);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            routerProvider.overrideWithValue(router),
            previewModeProvider.overrideWithValue(true),
            publicConfigurationProvider.overrideWith(
              (_) async => {
                'maintenance': {'app': false, 'api': false},
              },
            ),
          ],
          child: const DtExchangeApp(),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text(publicTestLabel), findsOneWidget);
      expect(find.text('Demo username'), findsOneWidget);
      expect(find.text('Demo password'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    });
  }
}
