import 'package:dt_exchange/features/wallet/wallet_pages.dart'
    show DepositAddressCard;
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dt_exchange/core/api/api_client.dart';
import 'package:dt_exchange/core/design/theme.dart';
import 'package:dt_exchange/core/presentation/kit.dart';
import 'package:dt_exchange/features/manual/manual_pages.dart';
import 'package:dt_exchange/features/manual/android_update.dart';
import 'package:dt_exchange/features/transactions/transaction_pages.dart';
import 'package:dt_exchange/features/sell/sell_pages.dart';
import 'package:dt_exchange/preview/preview_controller.dart';
import 'package:dt_exchange/public_test/test_mode.dart';
import 'phase3_api_test.dart' show MemoryStore;
import 'phase4_api_test.dart' show ChainAdapter;
import 'test_support.dart';

const capture = bool.fromEnvironment('DT_MANUAL_CAPTURE');
final config = {
  'manualDepositReview': true,
  'manualPayout': true,
  'network': 'TRC20',
  'address': 'DT-MOCK-TRON-${'a' * 40}',
  'sandbox': true,
  'requiredConfirmations': 20,
};

class ManualFixture extends ChainAdapter {
  String review = 'UNDER_REVIEW';
  @override
  Map<String, dynamic> get order => {
    ...super.order,
    'status': 'COMPLETED',
    'fundingSource': 'wallet',
    'payoutsEnabled': true,
    'payout': {
      'status': 'SUCCESS',
      'manual': true,
      'receiptId': 'receipt-test',
      'utr': 'PREVIEW-REFERENCE',
      'paidAt': '2026-09-21T10:00:00Z',
      'completedAt': '2026-09-21T10:00:00Z',
      'sandbox': true,
    },
  };
  @override
  Future<ResponseBody> fetch(
    RequestOptions o,
    Stream<Uint8List>? stream,
    Future<void>? cancel,
  ) async {
    dynamic d;
    if (o.path == '/manual/configuration') {
      d = config;
    } else if (o.path == '/manual/deposits') {
      d = [];
    } else if (o.path.startsWith('/manual/deposits/')) {
      d = {
        'id': 'deposit-test',
        'submitted_amount': '100',
        'status': review,
        'tx_hash': 'a' * 64,
        'reason': review == 'CREDITED'
            ? 'Verified test deposit credited.'
            : 'Blockchain verification is in progress.',
        'timeline': [
          {
            'to_status': 'PROOF_SUBMITTED',
            'created_at': '2026-09-21 09:00 UTC',
          },
          {'to_status': review, 'created_at': '2026-09-21 09:05 UTC'},
        ],
      };
    } else if (o.path.startsWith('/manual/files/')) {
      d = {
        'mime': 'image/png',
        'base64': base64Encode(
          File('test/assets/manual-receipt-preview.png').readAsBytesSync(),
        ),
      };
    } else if (o.path == '/app/version/android') {
      d = {
        'available': true,
        'latestVersionCode': 8003,
        'minimumVersionCode': 8001,
        'mandatory': false,
        'releaseNotes': 'Deposit proof review and secure payment receipts.',
        'downloadUrl': 'https://official.example/download',
      };
    } else {
      return super.fetch(o, stream, cancel);
    }
    return ResponseBody.fromString(
      jsonEncode(d),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }
}

void main() {
  setUpAll(loadPreviewFonts);
  testWidgets('manual Sell loads the current ledger balance before quoting', (
    t,
  ) async {
    final session = ApiSession(
      Dio()..httpClientAdapter = ManualFixture(),
      MemoryStore(),
    )..accessToken = 'synthetic';
    final c = ProviderContainer(
      overrides: [
        apiSessionProvider.overrideWithValue(session),
        previewModeProvider.overrideWithValue(false),
        manualConfigurationProvider.overrideWith((ref) async => config),
      ],
    );
    addTearDown(c.dispose);
    await t.pumpWidget(
      UncontrolledProviderScope(
        container: c,
        child: MaterialApp(
          theme: dtLightTheme,
          home: const SellAmountPage(initial: '100'),
        ),
      ),
    );
    await t.pumpAndSettle();
    expect(find.text('Available: 725 USDT'), findsOneWidget);
    expect(find.text('MAX'), findsOneWidget);
    expect(c.read(previewProvider).balance, BigInt.from(725000000));
    expect(t.takeException(), isNull);
    await t.pumpWidget(const SizedBox());
  });
  for (final status in ['UNDER_REVIEW', 'CREDITED']) {
    testWidgets('deposit $status synchronizes only authoritative credit', (
      t,
    ) async {
      final fixture = ManualFixture()..review = status;
      final session = ApiSession(
        Dio()..httpClientAdapter = fixture,
        MemoryStore(),
      )..accessToken = 'synthetic';
      final c = ProviderContainer(
        overrides: [
          apiSessionProvider.overrideWithValue(session),
          previewModeProvider.overrideWithValue(false),
        ],
      );
      addTearDown(c.dispose);
      expect(c.read(previewProvider).balance, BigInt.zero);
      await t.pumpWidget(
        UncontrolledProviderScope(
          container: c,
          child: MaterialApp(
            theme: dtLightTheme,
            home: const ManualDepositDetail(id: 'deposit-test'),
          ),
        ),
      );
      await t.pumpAndSettle();
      // The server wallet fixture is 725, deliberately different from
      // the submitted 100: never derive credit from the deposit amount.
      expect(
        c.read(previewProvider).balance,
        status == 'CREDITED' ? BigInt.from(725000000) : BigInt.zero,
      );
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
    });
  }
  for (final capped in [false, true]) {
    testWidgets('remote deposit fee and monthly cap $capped are truthful', (
      t,
    ) async {
      final dio = Dio()..httpClientAdapter = ManualFixture();
      final c = ProviderContainer(
        overrides: [
          apiSessionProvider.overrideWithValue(
            ApiSession(dio, MemoryStore())..accessToken = 'synthetic',
          ),
          previewModeProvider.overrideWithValue(true),
        ],
      );
      c.read(previewProvider.notifier).login();
      await t.pumpWidget(
        UncontrolledProviderScope(
          container: c,
          child: MaterialApp(
            theme: ThemeData(),
            home: ManualDepositPage(
              configuration: {
                ...config,
                'minimumDeposit': '100',
                'dailyDepositLimit': '20000',
                'monthlyLimitEnabled': capped,
                'monthlyDepositLimit': capped ? '60000' : null,
                'depositFeeUsdt': '1.25',
              },
            ),
          ),
        ),
      );
      await t.pumpAndSettle();
      await t.scrollUntilVisible(
        find.text('Deposit platform fee: 1.25 USDT'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('Deposit platform fee: 1.25 USDT'), findsOneWidget);
      expect(
        find.text('Monthly deposit limit: 60000 USDT'),
        capped ? findsOneWidget : findsNothing,
      );
      expect(find.text('No monthly deposit cap.'), findsNothing);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      c.dispose();
    });
  }
  for (final width in [390.0, 320.0]) {
    for (final name in [
      'Deposit_USDT',
      'Submit_Deposit_Proof',
      'Deposit_Under_Review',
      'Deposit_Approved',
      'Sell_USDT',
      'Transaction_Completed',
      'View_Receipt',
      'Update_Available_Dialog',
    ]) {
      testWidgets('manual $width $name preserves responsive components', (
        t,
      ) async {
        t.view.physicalSize = Size(width, 900);
        t.view.devicePixelRatio = 1;
        final fixture = ManualFixture()
          ..review = name == 'Deposit_Approved' ? 'CREDITED' : 'UNDER_REVIEW';
        final dio = Dio()..httpClientAdapter = fixture;
        final session = ApiSession(dio, MemoryStore())
          ..accessToken = 'test-token';
        final c = ProviderContainer(
          overrides: [
            apiSessionProvider.overrideWithValue(session),
            previewModeProvider.overrideWithValue(true),
            manualConfigurationProvider.overrideWith((ref) async => config),
          ],
        );
        c.read(previewProvider.notifier).login();
        final key = GlobalKey();
        final Widget screen = switch (name) {
          'Deposit_USDT' => ManualDepositPage(configuration: config),
          'Submit_Deposit_Proof' => const SubmitDepositPage(),
          'Deposit_Under_Review' ||
          'Deposit_Approved' => const ManualDepositDetail(id: 'deposit-test'),
          'Sell_USDT' => const SellAmountPage(),
          'Transaction_Completed' => const ApiOrderPage(id: 'order-test'),
          'View_Receipt' => const AppPage(
            title: 'Payment Receipt',
            children: [PrivateReceiptButton(id: 'receipt-test')],
          ),
          _ => const AndroidUpdateGate(
            child: AppPage(title: 'Home', children: []),
          ),
        };
        await t.pumpWidget(
          UncontrolledProviderScope(
            container: c,
            child: RepaintBoundary(
              key: key,
              child: MaterialApp(
                debugShowCheckedModeBanner: false,
                theme: dtLightTheme,
                home: screen,
              ),
            ),
          ),
        );
        await t.pumpAndSettle();
        if (name == 'Deposit_USDT') {
          expect(find.textContaining('Send only USDT using'), findsNothing);
          expect(
            find.textContaining('Deposits are currently paused'),
            findsNothing,
          );
          expect(find.textContaining('Minimum deposit:'), findsNothing);
          expect(find.textContaining('Daily deposit limit:'), findsNothing);
          expect(find.text('No monthly deposit cap.'), findsNothing);
          if (publicTestMode) {
            expect(find.byType(DepositAddressCard), findsNothing);
            expect(
              find.text(
                'Demo deposits use a generated reference. There is no receiving wallet. Do not send USDT.',
              ),
              findsOneWidget,
            );
          } else {
            final address = t.getRect(find.byType(DepositAddressCard));
            final amount = t.getRect(
              find.byKey(const Key('deposit-amount-card')),
            );
            expect(amount.top - address.bottom, closeTo(24, .1));
          }
        }
        if (name == 'View_Receipt') {
          await t.tap(find.text('View Payment Proof'));
          await t.pumpAndSettle();
          expect(find.byType(InteractiveViewer), findsOneWidget);
          expect(
            t
                .widget<InteractiveViewer>(find.byType(InteractiveViewer))
                .maxScale,
            5,
          );
          expect(find.text('Download Payment Proof'), findsOneWidget);
        }
        expect(t.takeException(), isNull);
        if (name == 'Deposit_Approved') {
          expect(find.text('Deposit Approved'), findsOneWidget);
          expect(
            t.getSize(find.byType(SuccessMark)).width,
            lessThanOrEqualTo(88),
          );
        }
        if (name == 'Submit_Deposit_Proof') {
          expect(find.text('Transaction hash / TxID'), findsOneWidget);
        }
        if (capture && width == 390) {
          await t.runAsync(() async {
            final image =
                await (key.currentContext!.findRenderObject()!
                        as RenderRepaintBoundary)
                    .toImage(pixelRatio: 2);
            final bytes = await image.toByteData(
              format: ui.ImageByteFormat.png,
            );
            image.dispose();
            final f = File('../docs/manual/previews/$name.png');
            f.parent.createSync(recursive: true);
            f.writeAsBytesSync(bytes!.buffer.asUint8List());
          });
        }
        await t.pumpWidget(const SizedBox());
        c.dispose();
        dio.close();
        t.view.resetPhysicalSize();
        t.view.resetDevicePixelRatio();
        await t.pump();
      });
    }
  }
}
