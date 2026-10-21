import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dt_exchange/app/app.dart';
import 'package:dt_exchange/app/router.dart';
import 'package:dt_exchange/core/api/api_client.dart';
import 'package:dt_exchange/core/storage/session_store.dart';
import 'package:dt_exchange/features/home/home_header.dart';
import 'package:dt_exchange/preview/preview_controller.dart';
import 'test_support.dart';

class MemoryStore extends SessionStore {
  @override Future<bool> unlockSession() async => true;
  MemoryStore() : super(const FlutterSecureStorage());
  String? token;
  @override
  Future<String?> readRefreshToken() async => token;
  @override
  Future<void> writeRefreshToken(String value) async {
    token = value;
  }

  @override
  Future<void> clear() async {
    token = null;
  }

  @override
  Future<String> deviceId() async => 'test-device-12345';
}

class FixtureAdapter implements HttpClientAdapter {
  int rotations = 0;
  bool expireAccess = false;
  final calls = <RequestOptions>[];
  @override
  void close({bool force = false}) {}
  @override
  Future<ResponseBody> fetch(
    RequestOptions o,
    Stream<Uint8List>? stream,
    Future<void>? cancel,
  ) async {
    calls.add(o);
    dynamic data;
    int status = 200;
    if (o.path == '/app/version/android') {
      data = {'available': false};
    } else if (o.path == '/auth/refresh') {
      rotations++;
      await Future<void>.delayed(const Duration(milliseconds: 5));
      data = {'accessToken': 'new-access', 'refreshToken': 'rotated-refresh'};
    } else if (expireAccess &&
        o.headers['Authorization'] == 'Bearer old-access') {
      status = 401;
      data = {
        'error': {'message': 'Expired'},
      };
    } else if (o.path == '/auth/login') {
      data = {'accessToken': 'new-access', 'refreshToken': 'refresh'};
    } else if (o.path == '/users/me') {
      data = {
        'id': 'user-api-1234',
        'fullName': 'Asha Nair',
        'email': 'asha@example.com',
        'mobile': '+919876543210',
        'accountStatus': 'ACTIVE',
        'verificationStatus': 'VERIFIED',
      };
    } else if (o.path == '/bank-accounts') {
      data = [
        {
          'id': 'bank-api-1234',
          'accountHolderName': 'Asha Nair',
          'accountNumber': 'XXXXXX9012',
          'ifsc': 'HDFC0001234',
          'bankName': 'HDFC Bank',
          'verificationStatus': 'VERIFIED',
          'isDefault': true,
        },
      ];
    } else if (o.path.startsWith('/history?')) {
      data = {'items': [], 'page': 1, 'hasMore': false, 'total': 0};
    } else if (o.path == '/wallet') {
      data = {
        'availableUsdt': '0',
        'reservedUsdt': '0',
        'pendingInr': '0',
        'source': 'ledger',
        'sandbox': true,
      };
    } else if (o.path == '/rates/usdt-inr') {
      data = {
        'exchangeRate': '92.45000000',
        'source': 'development_mock',
        'sandbox': true,
      };
    } else if (o.path == '/sell/quote') {
      data = {
        'quoteId': 'quote-api-1234',
        'amountUsdt': '100.000000000000000000',
        'exchangeRate': '92.45000000',
        'feeInrMinor': '4623',
        'finalInrMinor': '919877',
        'bankAccountId': 'bank-api-1234',
        'expiresAt': DateTime.now()
            .add(const Duration(seconds: 90))
            .toIso8601String(),
      };
    } else if (o.path == '/sessions') {
      data = [
        {
          'id': 'session-api',
          'deviceLabel': 'DT Exchange · iPhone',
          'lastSeenAt': '2026-09-20T12:00:00Z',
          'current': true,
        },
      ];
    } else {
      data = {'success': true};
    }
    return ResponseBody.fromString(
      jsonEncode(data),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }
}

void main() {
  setUpAll(loadPreviewFonts);
  test('concurrent 401 responses use one refresh rotation', () async {
    final adapter = FixtureAdapter()..expireAccess = true;
    final dio = Dio(BaseOptions(baseUrl: 'https://test.invalid'))
      ..httpClientAdapter = adapter;
    final store = MemoryStore()..token = 'old-refresh';
    final api = ApiSession(dio, store)..accessToken = 'old-access';
    final results = await Future.wait([
      api.request('/users/me'),
      api.request('/users/me'),
      api.request('/users/me'),
    ]);
    expect(adapter.rotations, 1);
    expect(results.every((e) => e['fullName'] == 'Asha Nair'), true);
    expect(store.token, 'rotated-refresh');
    dio.close();
  });
  test(
    'normal account state uses API profile, masked bank and exact server quote',
    () async {
      final adapter = FixtureAdapter();
      final dio = Dio(BaseOptions(baseUrl: 'https://test.invalid'))
        ..httpClientAdapter = adapter;
      final c = ProviderContainer(
        overrides: [
          apiSessionProvider.overrideWithValue(ApiSession(dio, MemoryStore())),
        ],
      );
      addTearDown(c.dispose);
      addTearDown(dio.close);
      final controller = c.read(previewProvider.notifier);
      await controller.loginApi('asha@example.com', 'example password');
      expect(c.read(previewProvider).name, 'Asha Nair');
      expect(c.read(previewProvider).balance, BigInt.zero);
      expect(c.read(previewProvider).transactions, isEmpty);
      expect(c.read(previewProvider).banks.single.number, 'XXXXXX9012');
      final quote = await controller.quoteApi('100', 'bank-api-1234');
      expect(quote.net, BigInt.from(919877));
      expect(quote.fee, BigInt.from(4623));
      expect(controller.confirmQuote, throwsStateError);
      final payload = adapter.calls.last.data as Map;
      expect(payload.keys.toSet(), {'amountUsdt', 'bankAccountId'});
      expect(adapter.calls.last.headers['Idempotency-Key'], isNotNull);
    },
  );
  for (final config in [
    ('iphone', const Size(390, 844), 1.0),
    ('android', const Size(412, 915), 1.0),
    ('small', const Size(320, 700), 1.3),
    ('landscape', const Size(844, 390), 1.0),
  ]) {
    for (final route in [
      '/login',
      '/home',
      '/profile',
      '/banks',
      '/sell/confirm',
      '/settings/devices',
    ]) {
      testWidgets('API presentation ${config.$1} $route keeps approved layout', (
        t,
      ) async {
        final adapter = FixtureAdapter();
        final dio = Dio(BaseOptions(baseUrl: 'https://test.invalid'))
          ..httpClientAdapter = adapter;
        final api = ApiSession(dio, MemoryStore())..accessToken = 'new-access';
        final c = ProviderContainer(
          overrides: [
            apiSessionProvider.overrideWithValue(api),
            initialRouteProvider.overrideWithValue(route),
          ],
        );
        await t.runAsync(() async {
          await c.read(previewProvider.notifier).loadAccount();
          if (route == '/sell/confirm') {
            await c
                .read(previewProvider.notifier)
                .quoteApi('100', 'bank-api-1234');
          }
        });
        t.view.physicalSize = config.$2;
        t.platformDispatcher.textScaleFactorTestValue = config.$3;
        t.view.devicePixelRatio = 1;
        final key = GlobalKey();
        await t.pumpWidget(
          UncontrolledProviderScope(
            container: c,
            child: RepaintBoundary(key: key, child: const DtExchangeApp()),
          ),
        );
        await t.pump(const Duration(seconds: 1));
        await t.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 100)),
        );
        await t.pump(const Duration(seconds: 1));
        // The enabled update gate mounts Home only after its response arrives.
        await t.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 200)));
        await t.pump(const Duration(seconds: 1));
        expect(t.takeException(), isNull);
        if (route == '/home') {
          expect(find.byType(HomeBrandHeader), findsOneWidget);
          expect(find.byKey(const Key('home-usdt-coin')), findsOneWidget);
          expect(find.textContaining('Good to see you'), findsNothing);
        }
        if (route == '/profile') {
          expect(find.text('Crypto Card'), findsNothing);
          expect(find.text('KYC Verification'), findsNothing);
        }
        if (config.$1 == 'iphone' && const bool.fromEnvironment('DT_CAPTURE')) {
          await t.runAsync(() async {
            final boundary =
                key.currentContext!.findRenderObject()!
                    as RenderRepaintBoundary;
            final picture = await boundary.toImage(pixelRatio: 2);
            final bytes = await picture.toByteData(
              format: ui.ImageByteFormat.png,
            );
            picture.dispose();
            final file = File(
              '../docs/phase3/previews/${route.substring(1).replaceAll('/', '_')}.png',
            );
            file.parent.createSync(recursive: true);
            file.writeAsBytesSync(bytes!.buffer.asUint8List());
          });
        }
        if (route == '/home') {
          await revealText(t, '₹9,198.77');
          expect(find.text('₹9,198.77'), findsOneWidget);
          expect(find.text('₹92.45000000 / USDT'), findsOneWidget);
        }
        await closePreview(t, c);
        dio.close();
      });
    }
  }
}
