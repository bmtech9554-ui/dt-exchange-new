import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dt_exchange/core/api/api_client.dart';
import 'package:dt_exchange/features/manual/manual_pages.dart';
import 'package:dt_exchange/preview/preview_controller.dart';
import 'manual_ui_test.dart' show ManualFixture;
import 'phase3_api_test.dart' show MemoryStore;
import 'test_support.dart';

void main() {
  setUpAll(loadPreviewFonts);
  for (final width in [320.0, 390.0]) {
    testWidgets(
      'unchanged deposit widgets show non-payable beta and form at $width',
      (t) async {
        t.view.physicalSize = Size(width, 844);
        t.view.devicePixelRatio = 1;
        addTearDown(t.view.resetPhysicalSize);
        addTearDown(t.view.resetDevicePixelRatio);
        final dio = Dio()..httpClientAdapter = ManualFixture();
        final container = ProviderContainer(
          overrides: [
            apiSessionProvider.overrideWithValue(
              ApiSession(dio, MemoryStore())..accessToken = 'synthetic',
            ),
            previewModeProvider.overrideWithValue(false),
          ],
        );
        await t.pumpWidget(
          UncontrolledProviderScope(
            container: container,
            child: MaterialApp(
              home: ManualDepositPage(
                configuration: const {
                  'manualDepositReview': true,
                  'manualPayout': true,
                  'network': 'TRC20',
                  'address': 'DT-SYNTHETIC-NONPAYABLE',
                  'sandbox': true,
                  'depositsEnabled': true,
                  'minimumDeposit': '100',
                  'dailyDepositLimit': '20000',
                  'depositFeeUsdt': '0',
                  'monthlyLimitEnabled': false,
                  'monthlyDepositLimit': null,
                },
              ),
            ),
          ),
        );
        await t.pumpAndSettle();
        expect(
          find.text('Sandbox configuration. Do not send real USDT.'),
          findsOneWidget,
        );
        expect(find.text('DT-SYNTHETIC-NONPAYABLE'), findsOneWidget);
        expect(
          find.text('Sandbox only. This is not a payable blockchain address.'),
          findsOneWidget,
        );
        for (final key in [
          'deposit-amount-card',
          'deposit-hash-card',
          'deposit-proof-card',
        ]) {
          await t.scrollUntilVisible(
            find.byKey(Key(key)),
            180,
            scrollable: find.byType(Scrollable).first,
          );
          expect(find.byKey(Key(key)), findsOneWidget);
          expect(t.takeException(), isNull);
        }
        await t.pumpWidget(const SizedBox());
        container.dispose();
      },
    );
  }
}
