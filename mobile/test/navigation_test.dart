import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dt_exchange/app/app.dart';
import 'package:dt_exchange/app/router.dart';
import 'package:dt_exchange/preview/preview_controller.dart';
import 'package:dt_exchange/preview/fixtures.dart';
import 'package:dt_exchange/core/presentation/kit.dart' show PreviewQr;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'test_support.dart';
import 'package:dio/dio.dart';
import 'package:dt_exchange/core/api/api_client.dart';
import 'phase3_api_test.dart' show FixtureAdapter;

void main() {
  setUpAll(loadPreviewFonts);
  testWidgets('normal build never exposes financial mock balances', (t) async {
    await t.pumpWidget(
      ProviderScope(
        overrides: [
          initialRouteProvider.overrideWithValue('/login'),
          apiClientProvider.overrideWithValue(Dio()..httpClientAdapter = FixtureAdapter()),
        ],
        child: const DtExchangeApp(),
      ),
    );
    await t.pumpAndSettle();
    expect(find.byType(NavigationBar), findsNothing);
    expect(find.text('Welcome back'), findsOneWidget);
    expect(find.text('Explore the preview'), findsNothing);
    expect(find.textContaining('1,248'), findsNothing);
    await t.pumpWidget(const SizedBox());
  });
  testWidgets(
    'four destinations and the restricted Profile menu remain connected',
    (t) async {
      final c = await pumpPreview(t);
      addTearDown(() => closePreview(t, c));
      expect(find.byType(NavigationDestination), findsNWidgets(4));
      final labels = t
          .widgetList<NavigationDestination>(find.byType(NavigationDestination))
          .map((d) => d.label)
          .toList();
      expect(labels, ['Home', 'Wallet', 'History', 'Profile']);
      for (final target in ['Wallet', 'History', 'Profile']) {
        await t.tap(
          find.descendant(
            of: find.byType(NavigationBar),
            matching: find.text(target),
          ),
        );
        await t.pumpAndSettle();
      }
      for (final title in [
        'User details',
        'Bank Accounts',
        'Referral Program',
        'Settings',
        'Logout',
      ]) {
        await revealText(t, title);
        expect(find.text(title), findsOneWidget);
      }
      for (final forbidden in [
        'Crypto Card',
        'KYC Verification',
        'PAN Verification',
        'Identity Verification',
        'Selfie Verification',
        'Security',
      ]) {
        expect(find.text(forbidden), findsNothing);
      }
      await tapText(t, 'Bank Accounts');
      expect(find.text('Bank accounts'), findsOneWidget);
      expect(find.textContaining('•••• •••• 8421'), findsOneWidget);
    },
  );
  testWidgets(
    'OTP rejects wrong code then navigates directly Home without identity approval',
    (t) async {
      final c = await pumpPreview(
        t,
        route: '/otp?purpose=register&contact=9000000001',
        signedIn: false,
        setup: (x) =>
            x.register('Preview User', 'user@example.com', '9000000001'),
      );
      addTearDown(() => closePreview(t, c));
      await t.enterText(find.byType(TextField), '111111');
      await tapText(t, 'Verify & continue');
      expect(find.text('Use the preview code 123456.'), findsOneWidget);
      await t.enterText(find.byType(TextField), '123456');
      await tapText(t, 'Verify & continue');
      await t.pump(const Duration(milliseconds: 600));
      await t.pump(const Duration(milliseconds: 700));
      await t.pumpAndSettle();
      expect(find.text('Activate your account'), findsNothing);
      expect(c.read(previewProvider).verified, false);
      expect(find.text('Deposit USDT'), findsOneWidget);
    },
  );
  testWidgets(
    'send acknowledgement does not confirm or credit an on-chain order',
    (t) async {
      final c = await pumpPreview(t, route: '/sell/amount');
      addTearDown(() => closePreview(t, c));
      await tapText(t, 'Send USDT');
      await tapText(t, 'Continue');
      expect(find.text('Confirm sell'), findsOneWidget);
      await tapText(t, 'Confirm Sell');
      await t.pumpAndSettle();
      final id = c.read(previewProvider).activeOrderId!;
      final balance = c.read(previewProvider).balance;
      expect(find.text('Send USDT'), findsOneWidget);
      expect(find.byType(QrImageView), findsOneWidget);
      await tapText(t, 'I Have Sent the USDT');
      expect(find.text('Track your exchange'), findsOneWidget);
      expect(c.read(previewProvider.notifier).findTransaction(id)!.stage, 0);
      expect(c.read(previewProvider).balance, balance);
      await tapText(t, 'Simulate blockchain & payout');
      for (var i = 0; i < 7; i++) {
        await t.pump(const Duration(seconds: 1));
      }
      await t.pumpAndSettle();
      expect(find.text('Transaction successful'), findsOneWidget);
      expect(
        c
            .read(previewProvider)
            .transactions
            .where((x) => x.id == '$id-PAYOUT')
            .length,
        1,
      );
    },
  );
  testWidgets('QR payload equals copied non-payment preview address', (
    t,
  ) async {
    String? copied;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async {
          if (call.method == 'Clipboard.setData') {
            copied = (call.arguments as Map)['text'] as String;
          }
          return null;
        });
    addTearDown(
      () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, null),
    );
    final c = await pumpPreview(t, route: '/deposit');
    addTearDown(() => closePreview(t, c));
    final qr = t.widget<PreviewQr>(find.byType(PreviewQr));
    expect(qr.data, previewDepositAddress);
    await tapText(t, 'Copy address');
    expect(copied, previewDepositAddress);
    expect(find.text('Copied'), findsOneWidget);
  });
  testWidgets(
    'financial routes do not require identity activation and history filters work',
    (t) async {
      final c = await pumpPreview(
        t,
        route: '/sell/amount',
        setup: (x) =>
            x.register('Sample User', 'sample@example.com', '9000000001'),
      );
      addTearDown(() => closePreview(t, c));
      expect(find.text('Activate your account'), findsNothing);
      expect(c.read(previewProvider).verified, false);
      c.read(routerProvider).go('/history?filter=deposits');
      await t.pumpAndSettle();
      expect(find.text('USDT Deposit'), findsNWidgets(2));
      expect(find.text('USDT Sell'), findsNothing);
      await tapText(t, 'All');
      expect(find.text('USDT Sell'), findsOneWidget);
    },
  );
  testWidgets('support form creates a local ticket and read-all clears badge', (
    t,
  ) async {
    final c = await pumpPreview(t, route: '/support/new');
    addTearDown(() => closePreview(t, c));
    await t.enterText(
      find.widgetWithText(TextFormField, 'Subject'),
      'Sample payout query',
    );
    await t.enterText(
      find.widgetWithText(TextFormField, 'How can we help?'),
      'Please explain this preview payout status.',
    );
    await tapText(t, 'Save preview ticket');
    await t.pump(const Duration(milliseconds: 600));
    await t.pumpAndSettle();
    expect(c.read(previewProvider).tickets.length, 1);
    expect(find.text('Your preview ticket is saved.'), findsOneWidget);
    c.read(routerProvider).go('/notifications');
    await t.pumpAndSettle();
    await t.tap(find.byTooltip('Mark all as read'));
    await t.pumpAndSettle();
    expect(c.read(previewProvider).unread, 0);
  });
  testWidgets('logout clears local state and restores login', (t) async {
    final c = await pumpPreview(t, route: '/profile');
    addTearDown(() => closePreview(t, c));
    await tapText(t, 'Logout');
    await t.tap(find.widgetWithText(TextButton, 'Logout'));
    await t.pumpAndSettle();
    expect(c.read(previewProvider).signedIn, false);
    expect(find.text('Welcome back'), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
  });
}
