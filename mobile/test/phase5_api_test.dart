import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dt_exchange/app/app.dart';
import 'package:dt_exchange/app/router.dart';
import 'package:dt_exchange/core/api/api_client.dart';
import 'package:dt_exchange/preview/preview_controller.dart';
import 'phase3_api_test.dart' show FixtureAdapter, MemoryStore;
import 'test_support.dart';

class ChainAdapter extends FixtureAdapter {
  String orderStatus = 'PAYOUT_PROCESSING';
  int orderPosts = 0, orderReads = 0;
  Map<String, dynamic> get order => {
    'orderId': 'order-api-4',
    'orderNumber': 'DT-20260920-0042',
    'quoteId': 'quote-api-1234',
    'status': orderStatus,
    'amountUsdt': '100.000000000000000000',
    'exchangeRate': '92.45000000',
    'feeInrMinor': '4623',
    'finalInrMinor': '919877',
    'depositAddress': 'DT-MOCK-TRON-${'a' * 40}',
    'network': 'TRC20',
    'bankAccountId': 'bank-api-1234',
    'fundingSource': 'onchain',
    'sandbox': true,
    'payoutExecuted': false,
    'payoutsEnabled': true,
    'payout': {
      'id': 'payout-api-5',
      'status': orderStatus == 'COMPLETED' ? 'SUCCESS' : 'PROCESSING',
      'utr': orderStatus == 'COMPLETED' ? 'SANDBOX-UTR-002451' : null,
      'payoutReference': 'SANDBOX-PAY-0042',
      'completedAt': orderStatus == 'COMPLETED' ? '2026-09-20T12:04:30Z' : null,
      'sandbox': true,
    },
    'confirmations': 20,
    'requiredConfirmations': 20,
    'txHash': 'b' * 64,
    'createdAt': '2026-09-20T12:00:00Z',
    'updatedAt': '2026-09-20T12:02:00Z',
    'expiresAt': DateTime.now()
        .add(const Duration(minutes: 30))
        .toIso8601String(),
    'timeline': [],
  };
  @override
  Future<ResponseBody> fetch(
    RequestOptions o,
    Stream<Uint8List>? stream,
    Future<void>? cancel,
  ) async {
    dynamic data;
    if (o.path == '/sell/orders') {
      orderPosts++;
      orderStatus = 'AWAITING_DEPOSIT';
      data = order;
    } else if (o.path.startsWith('/sell/orders/')) {
      orderReads++;
      data = order;
    } else if (o.path == '/wallet') {
      data = {
        'availableUsdt': '725.000000000000000000',
        'reservedUsdt': '0',
        'pendingInr': '9198.77',
        'source': 'ledger',
        'sandbox': true,
      };
    } else if (o.path == '/wallet/deposit-address') {
      data = {
        'address': 'DT-MOCK-TRON-${'c' * 40}',
        'sandbox': true,
        'network': 'TRC20',
        'requiredConfirmations': 20,
      };
    } else if (o.path.startsWith('/history?')) {
      data = {
        'items': [
          {
            'id': 'order-api-4',
            'type': 'sell',
            'amount_usdt': '100.000000000000000000',
            'inr_minor': '919877',
            'status': 'completed',
            'created_at': '2026-09-20T12:00:00Z',
          },
          {
            'id': 'payout-api-5',
            'type': 'payouts',
            'amount_usdt': null,
            'inr_minor': '919877',
            'status': 'success',
            'created_at': '2026-09-20T12:04:30Z',
          },
          {
            'id': 'deposit-api-4',
            'type': 'deposits',
            'amount_usdt': '825.000000000000000000',
            'inr_minor': null,
            'status': 'credited',
            'created_at': '2026-09-20T11:59:00Z',
          },
        ],
        'page': 1,
        'hasMore': false,
        'total': 2,
      };
    } else if (o.path.startsWith('/history/')) {
      data = {
        'bank': {
          'bankName': 'HDFC Bank',
          'accountNumber': 'XXXXXX4321',
          'ifsc': 'HDFC0001234',
        },
        'type': 'payouts',
        'order_id': 'DT-20260920-0042',
        'amount_inr_minor': '919877',
        'utr': 'SANDBOX-UTR-002451',
        'payout_reference': 'SANDBOX-PAY-0042',
        'completed_at': '2026-09-20T12:04:30Z',
        'sandbox': true,
        'id': 'payout-api-5',
        'status': 'SUCCESS',
        'amount_usdt': '825.000000000000000000',
        'created_at': '2026-09-20T11:59:00Z',
        'tx_hash': 'b' * 64,
        'confirmations': 20,
        'required_confirmations': 20,
      };
    } else {
      return super.fetch(o, stream, cancel);
    }
    if (o.path.contains('type=deposits')) {
      data['items'] = (data['items'] as List)
          .where((x) => x['type'] == 'deposits')
          .toList();
    }
    calls.add(o);
    return ResponseBody.fromString(
      jsonEncode(data),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }
}

void main() {
  setUpAll(loadPreviewFonts);
  for (final config in [
    ('iphone', const Size(390, 844), 1.0),
    ('android', const Size(412, 915), 1.0),
    ('small', const Size(320, 700), 1.3),
    ('landscape', const Size(844, 390), 1.0),
  ]) {
    for (final item in [
      ('01_processing', '/sell/track/order-api-4', 'PAYOUT_PROCESSING'),
      ('02_completed', '/sell/track/order-api-4', 'COMPLETED'),
      ('03_details', '/history/payout-api-5', 'COMPLETED'),
      ('04_history', '/history', 'COMPLETED'),
    ]) {
      testWidgets(
        'Phase 5 ${config.$1} ${item.$1} provider status and responsive layout',
        (t) async {
          final adapter = ChainAdapter()..orderStatus = item.$3;
          final dio = Dio(BaseOptions(baseUrl: 'https://test.invalid'))
            ..httpClientAdapter = adapter;
          final c = ProviderContainer(
            overrides: [
              apiSessionProvider.overrideWithValue(
                ApiSession(dio, MemoryStore())..accessToken = 'access',
              ),
              initialRouteProvider.overrideWithValue(item.$2),
            ],
          );
          await t.runAsync(() async {
            await c.read(previewProvider.notifier).loadAccount();
          });
          t.view.physicalSize = config.$2;
          t.view.devicePixelRatio = 1;
          t.platformDispatcher.textScaleFactorTestValue = config.$3;
          final key = GlobalKey();
          await t.pumpWidget(
            UncontrolledProviderScope(
              container: c,
              child: RepaintBoundary(key: key, child: const DtExchangeApp()),
            ),
          );
          await t.pump();
          await t.runAsync(
            () => Future<void>.delayed(const Duration(milliseconds: 150)),
          );
          await t.pump(const Duration(seconds: 1));
          await t.pump(const Duration(milliseconds: 750));
          expect(t.takeException(), isNull);
          expect(find.text('Simulate blockchain & payout'), findsNothing);
          if (item.$1 == '01_processing') {
            expect(find.text('INR Payout Processing'), findsWidgets);
            expect(find.text('SANDBOX-UTR-002451'), findsNothing);
          }
          if (item.$1 == '02_completed') {
            expect(find.text('Transaction Successful'), findsWidgets);
            if (config.$1 == 'iphone' || config.$1 == 'android') {
              expect(find.text('SANDBOX-UTR-002451'), findsOneWidget);
            }
          }
          if (const bool.fromEnvironment('DT_CAPTURE') && config.$1 == 'iphone') {
            await t.runAsync(() async {
              final boundary =
                  key.currentContext!.findRenderObject()!
                      as RenderRepaintBoundary;
              final picture = await boundary.toImage(pixelRatio: 2);
              final bytes = await picture.toByteData(
                format: ui.ImageByteFormat.png,
              );
              picture.dispose();
              final file = File('../docs/phase5/previews/${item.$1}.png');
              file.parent.createSync(recursive: true);
              file.writeAsBytesSync(bytes!.buffer.asUint8List());
            });
          }
          final vertical = t
              .stateList<ScrollableState>(find.byType(Scrollable))
              .where((s) => s.axisDirection == AxisDirection.down)
              .firstOrNull;
          if (vertical != null) {
            for (
              var n = 0;
              n < 30 &&
                  vertical.position.pixels < vertical.position.maxScrollExtent;
              n++
            ) {
              vertical.position.jumpTo(
                (vertical.position.pixels + 250).clamp(
                  0,
                  vertical.position.maxScrollExtent,
                ),
              );
              await t.pump(const Duration(milliseconds: 40));
              expect(t.takeException(), isNull);
            }
          }
          await t.pumpWidget(const SizedBox.shrink());
          await t.pump();
          c.dispose();
          t.view.resetPhysicalSize();
          t.view.resetDevicePixelRatio();
          t.platformDispatcher.clearTextScaleFactorTestValue();
        },
      );
    }
  }
}
