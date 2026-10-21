import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dt_exchange/core/api/api_client.dart';
import 'package:dt_exchange/core/storage/session_store.dart';
import 'package:dt_exchange/preview/preview_controller.dart';
import 'package:dt_exchange/preview/money.dart';

class RateStore extends SessionStore {
  @override Future<bool> unlockSession() async => true;
  RateStore() : super(const FlutterSecureStorage());
  @override
  Future<String?> readRefreshToken() async => null;
  @override
  Future<void> writeRefreshToken(String value) async {}
  @override
  Future<void> clear() async {}
}

class RateAdapter implements HttpClientAdapter {
  bool unavailable = false;
  final calls = <RequestOptions>[];
  @override
  void close({bool force = false}) {}
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? stream,
    Future<void>? cancelFuture,
  ) async {
    calls.add(options);
    return ResponseBody.fromString(
      jsonEncode(
        unavailable
            ? {
                'error': {'message': 'Service is not ready'},
              }
            : {
                'exchangeRate': '103.00000000',
                'source': 'MANUAL_ADMIN',
                'timestamp': DateTime.now().toUtc().toIso8601String(),
                'validUntil': DateTime.now()
                    .add(const Duration(seconds: 60))
                    .toUtc()
                    .toIso8601String(),
                'sandbox': false,
                'quotesConfigured': true,
                'minimumSell': '100.000000000000000000',
                'maximumSell': '5000.000000000000000000',
                'dailyLimit': '20000.000000000000000000',
                'monthlyLimit': '100000.000000000000000000',
              },
      ),
      unavailable ? 503 : 200,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }
}

void main() {
  test(
    'authenticated Home rate repository parses MANUAL_ADMIN response in integer paise',
    () async {
      final adapter = RateAdapter();
      final dio = Dio()..httpClientAdapter = adapter;
      final session = ApiSession(dio, RateStore())
        ..accessToken = 'synthetic-access';
      final container = ProviderContainer(
        overrides: [
          previewModeProvider.overrideWithValue(false),
          apiSessionProvider.overrideWithValue(session),
        ],
      );
      addTearDown(container.dispose);
      await container.read(previewProvider.notifier).refreshRateApi();
      expect(adapter.calls.single.path, '/rates/usdt-inr');
      expect(
        adapter.calls.single.headers['Authorization'],
        'Bearer synthetic-access',
      );
      expect(container.read(previewProvider).ratePaise, 10300);
      expect(
        container.read(previewProvider.notifier).rateSource,
        'MANUAL_ADMIN',
      );
      expect(container.read(previewProvider.notifier).sandboxRate, false);
      expect(
        PreviewMoney.gross(PreviewMoney.parseUsdt('100')!, 10300),
        BigInt.from(1030000),
      );
    },
  );
  test(
    'unavailable authenticated rate leaves fresh Home state unavailable, without preview fallback',
    () async {
      final adapter = RateAdapter()..unavailable = true;
      final dio = Dio()..httpClientAdapter = adapter;
      final session = ApiSession(dio, RateStore())
        ..accessToken = 'synthetic-access';
      final container = ProviderContainer(
        overrides: [
          previewModeProvider.overrideWithValue(false),
          apiSessionProvider.overrideWithValue(session),
        ],
      );
      addTearDown(container.dispose);
      await expectLater(
        container.read(previewProvider.notifier).refreshRateApi(),
        throwsA(isA<DioException>()),
      );
      expect(container.read(previewProvider).ratePaise, 0);
      adapter.unavailable = false;
      await container.read(previewProvider.notifier).refreshRateApi();
      expect(container.read(previewProvider).ratePaise, 10300);
      adapter.unavailable = true;
      await expectLater(
        container.read(previewProvider.notifier).refreshRateApi(),
        throwsA(isA<DioException>()),
      );
      expect(container.read(previewProvider).ratePaise, 0);
      adapter.unavailable = false;
      await container.read(previewProvider.notifier).refreshRateApi();
      expect(container.read(previewProvider).ratePaise, 10300);
    },
  );
}
