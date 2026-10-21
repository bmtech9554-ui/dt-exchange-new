import 'dart:io';
import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dt_exchange/app/app.dart';
import 'package:dt_exchange/app/router.dart';
import 'package:dt_exchange/core/api/api_client.dart';
import 'package:dt_exchange/core/presentation/kit.dart';
import 'package:dt_exchange/features/manual/manual_pages.dart';
import 'package:dt_exchange/preview/preview_controller.dart';
import 'deposit_ux_test.dart' show ProofAdapter, tapUx, shot;
import 'phase3_api_test.dart' show MemoryStore;
import 'test_support.dart';

void main() {
  setUpAll(loadPreviewFonts);

  testWidgets('Create account is a secondary button and opens registration', (
    t,
  ) async {
    final key = GlobalKey();
    final c = await pumpPreview(
      t,
      route: '/login',
      signedIn: false,
      boundary: key,
      size: const Size(390, 1000),
    );
    addTearDown(() => closePreview(t, c));
    final button = find.byWidgetPredicate(
      (w) => w is DtButton && w.label == 'Create account',
    );
    await t.ensureVisible(button);
    await t.pumpAndSettle();
    expect(t.widget<DtButton>(button).style, DtButtonStyle.secondary);
    expect(t.getSize(button).height, greaterThanOrEqualTo(48));
    expect(t.getSize(button).width, greaterThan(300));
    await shot(t, key, 'Refresh_Login');
    await t.tap(button);
    await t.pumpAndSettle();
    expect(find.text('A fresh start.'), findsOneWidget);
  });

  testWidgets(
    'preview deposit estimates exactly and submits without API or credit',
    (t) async {
      t.view.physicalSize = const Size(390, 1000);
      t.view.devicePixelRatio = 1;
      final requests = <RequestOptions>[];
      final dio = Dio()..httpClientAdapter = ProofAdapter();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (o, h) {
            requests.add(o);
            h.next(o);
          },
        ),
      );
      final c = ProviderContainer(
        overrides: [
          previewModeProvider.overrideWithValue(true),
          initialRouteProvider.overrideWithValue('/deposit'),
          apiSessionProvider.overrideWithValue(ApiSession(dio, MemoryStore())),
          depositProofPickerProvider.overrideWithValue(() async {
            final bytes = File(
              'test/assets/usdt-proof-preview.png',
            ).readAsBytesSync();
            return PlatformFile(
              name: 'deposit-proof.png',
              size: bytes.length,
              bytes: bytes,
            );
          }),
        ],
      );
      c.read(previewProvider.notifier).login();
      final balance = c.read(previewProvider).balance;
      final key = GlobalKey();
      addTearDown(() async {
        await closePreview(t, c);
        dio.close();
      });
      await t.pumpWidget(
        UncontrolledProviderScope(
          container: c,
          child: RepaintBoundary(key: key, child: const DtExchangeApp()),
        ),
      );
      await t.pumpAndSettle();
      expect(find.byType(PreviewQr), findsOneWidget);
      await revealText(t, 'Deposit amount');
      final amount = find.byKey(const Key('deposit-amount'));
      await t.ensureVisible(amount);
      await t.enterText(amount, '100');
      await t.pumpAndSettle();
      expect(find.text('≈ ₹10,300.00 INR'), findsOneWidget);
      await shot(t, key, 'Refresh_Deposit_Estimate');
      c.read(previewProvider.notifier).refreshRate();
      await t.pumpAndSettle();
      expect(find.text('≈ ₹10,300.00 INR'), findsOneWidget);
      await t.enterText(amount, '0.000001');
      await t.pumpAndSettle();
      expect(find.text('≈ ₹0.00 INR'), findsOneWidget);
      await t.enterText(amount, '1');
      await t.pumpAndSettle();
      expect(find.text('≈ ₹103.00 INR'), findsOneWidget);
      await t.enterText(amount, '1.25');
      await t.pumpAndSettle();
      expect(find.text('≈ ₹128.75 INR'), findsOneWidget);
      await t.enterText(amount, '');
      await t.pumpAndSettle();
      expect(find.textContaining('≈ ₹'), findsNothing);
      await t.enterText(amount, '100');
      await t.enterText(amount, '100abc');
      expect(t.widget<TextFormField>(amount).controller!.text, '100');
      final hash = find.byKey(const Key('deposit-txid'));
      await t.ensureVisible(hash);
      await t.enterText(hash, '  ${'a' * 64}  ');
      await tapUx(t, 'Upload Screenshot');
      expect(find.text('deposit-proof.png'), findsOneWidget);
      await tapUx(t, 'Submit Deposit Request');
      expect(find.text('Preview request recorded'), findsOneWidget);
      expect(requests, isEmpty);
      expect(c.read(previewProvider).balance, balance);
      expect(t.takeException(), isNull);
    },
  );

  testWidgets('sample graph sweeps again and pauses for reduced motion', (
    t,
  ) async {
    Widget graph(bool reduced) => MaterialApp(
      home: MediaQuery(
        data: MediaQueryData(disableAnimations: reduced),
        child: const Scaffold(body: RateSparkline(preview: true)),
      ),
    );
    RateSparklinePainter painter() => t
        .widgetList<CustomPaint>(find.byType(CustomPaint))
        .map((w) => w.painter)
        .whereType<RateSparklinePainter>()
        .single;
    await t.pumpWidget(graph(false));
    await t.pumpAndSettle();
    expect(painter().progress, 1);
    await t.pump(const Duration(seconds: 4));
    await t.pump(const Duration(milliseconds: 600));
    expect(painter().sweep!.value, allOf(greaterThan(0), lessThan(1)));
    await t.pumpWidget(graph(true));
    await t.pumpAndSettle();
    await t.pump(const Duration(seconds: 6));
    expect(painter().sweep!.value, 0);
    expect(t.binding.hasScheduledFrame, false);
    await t.pumpWidget(const SizedBox());
  });

  testWidgets(
    'graph freezes entrance and ambient motion in background, resumes safely',
    (t) async {
      RateSparklinePainter painter() => t
          .widgetList<CustomPaint>(find.byType(CustomPaint))
          .map((w) => w.painter)
          .whereType<RateSparklinePainter>()
          .single;
      await t.pumpWidget(
        const MaterialApp(home: Scaffold(body: RateSparkline(preview: true))),
      );
      await t.pump(const Duration(milliseconds: 350));
      final entrance = painter().progress;
      expect(entrance, allOf(greaterThan(0), lessThan(1)));
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await t.pump(const Duration(seconds: 10));
      expect(painter().progress, entrance);
      expect(t.binding.hasScheduledFrame, false);
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await t.pump();
      await t.pump(const Duration(milliseconds: 200));
      expect(painter().progress, greaterThan(entrance));
      await t.pump(const Duration(seconds: 2));
      await t.pump(const Duration(milliseconds: 300));
      final stablePainter = painter();
      final phase = stablePainter.sweep!.value;
      expect(phase, allOf(greaterThan(0), lessThan(1)));
      // Ambient frames retain the original full-chart painter and cached layer.
      await t.pump(const Duration(milliseconds: 100));
      expect(identical(painter(), stablePainter), true);
      final pausedPhase = painter().sweep!.value;
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await t.pump(const Duration(seconds: 12));
      expect(painter().sweep!.value, pausedPhase);
      expect(t.binding.hasScheduledFrame, false);
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await t.pump();
      await t.pump(const Duration(milliseconds: 600));
      expect(painter().sweep!.value, allOf(greaterThan(0), lessThan(1)));
      await t.pumpWidget(const SizedBox());
    },
  );

  for (final config in [(320.0, 1.6), (412.0, 1.0), (720.0, 1.6)]) {
    testWidgets('Home premium rate card at ${config.$1} / ${config.$2}', (
      t,
    ) async {
      final c = await pumpPreview(
        t,
        size: Size(config.$1, 1000),
        scale: config.$2,
      );
      addTearDown(() => closePreview(t, c));
      await t.pumpAndSettle();
      expect(find.byKey(const Key('home-rate-card')), findsOneWidget);
      expect(find.text('₹103.00'), findsNWidgets(2));
      expect(find.textContaining('Preview Rate'), findsOneWidget);
      expect(find.text('PREVIEW'), findsWidgets);
      expect(find.byType(RateSparkline), findsOneWidget);
      expect(find.byType(NavigationDestination), findsNWidgets(4));
      await t.ensureVisible(find.byTooltip('Refresh rate'));
      await t.tap(find.byTooltip('Refresh rate'));
      await t.pumpAndSettle();
      expect(find.text('₹103.00'), findsNWidgets(2));
      expect(t.takeException(), isNull);
    });
  }
}
