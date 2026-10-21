import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dt_exchange/core/api/api_client.dart';
import 'package:dt_exchange/core/design/theme.dart';
import 'package:dt_exchange/core/presentation/kit.dart';
import 'package:dt_exchange/features/manual/manual_pages.dart';
import 'package:dt_exchange/preview/preview_controller.dart';
import 'manual_ui_test.dart' show ManualFixture, config;
import 'phase3_api_test.dart' show MemoryStore;
import 'test_support.dart';

const captureUx = bool.fromEnvironment('DT_UX_CAPTURE');

class ProofAdapter extends ManualFixture {
  final writes = <RequestOptions>[];
  @override
  Future<ResponseBody> fetch(
    RequestOptions o,
    Stream<Uint8List>? stream,
    Future<void>? cancel,
  ) async {
    if (o.method == 'POST' &&
        ['/manual/files', '/manual/deposits'].contains(o.path)) {
      writes.add(o);
      return ResponseBody.fromString(
        jsonEncode({
          'id': o.path == '/manual/files' ? 'proof-123' : 'deposit-test',
          'status': 'PROOF_SUBMITTED',
        }),
        200,
        headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType],
        },
      );
    }
    return super.fetch(o, stream, cancel);
  }
}

Future<void> shot(WidgetTester t, GlobalKey key, String name) async {
  if (!captureUx) return;
  await t.runAsync(() async {
    final image =
        await (key.currentContext!.findRenderObject()! as RenderRepaintBoundary)
            .toImage(pixelRatio: 2);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();
    final f = File('../docs/ui-ux-update/previews/$name.png');
    f.parent.createSync(recursive: true);
    f.writeAsBytesSync(bytes!.buffer.asUint8List());
  });
}

Future<void> tapUx(WidgetTester t, String text) async {
  await t.pumpAndSettle();
  final buttons = find.descendant(
    of: find.byType(DtButton),
    matching: find.text(text),
  );
  final target = buttons.evaluate().isNotEmpty
      ? buttons.last
      : find.text(text).last;
  await t.ensureVisible(target);
  await t.pumpAndSettle();
  await t.tap(target);
  await t.pumpAndSettle();
}

void main() {
  setUpAll(loadPreviewFonts);
  test('TRON TxID validates 64 hexadecimal characters only', () {
    expect(validateDepositTxId('a' * 64), isNull);
    expect(validateDepositTxId(' AB${'0' * 62} '), isNull);
    for (final v in [
      '',
      'a' * 63,
      'a' * 65,
      'z' * 64,
      'https://tronscan.org/tx',
    ]) {
      expect(validateDepositTxId(v), isNotNull);
    }
  });
  test('deposit amount is positive exact token units', () {
    for (final v in ['1', '100.00', '0.000001']) {
      expect(validateDepositAmount(v), isNull);
    }
    for (final v in ['', '0', '-1', 'NaN', '1e3', '0.0000001']) {
      expect(validateDepositAmount(v), isNotNull);
    }
  });
  for (final reduced in [false, true]) {
    testWidgets('rate entrance settles and respects reduced motion $reduced', (
      t,
    ) async {
      await t.pumpWidget(
        MaterialApp(
          home: MediaQuery(
            data: MediaQueryData(disableAnimations: reduced),
            child: const Scaffold(body: RateSparkline(preview: true)),
          ),
        ),
      );
      RateSparklinePainter painter() => t
          .widgetList<CustomPaint>(find.byType(CustomPaint))
          .map((w) => w.painter)
          .whereType<RateSparklinePainter>()
          .single;
      expect(painter().progress, reduced ? 1 : 0);
      await t.pump(const Duration(milliseconds: 400));
      expect(painter().progress, reduced ? 1 : lessThan(1));
      await t.pumpAndSettle();
      expect(painter().progress, 1);
      expect(t.binding.hasScheduledFrame, false);
      await t.pumpWidget(const SizedBox());
    });
  }
  testWidgets('connected graph is decorative with no sample history', (
    t,
  ) async {
    await t.pumpWidget(
      const MaterialApp(home: Scaffold(body: RateSparkline())),
    );
    await t.pump(const Duration(seconds: 2));
    final p = t
        .widgetList<CustomPaint>(find.byType(CustomPaint))
        .map((w) => w.painter)
        .whereType<RateSparklinePainter>()
        .single;
    expect(p.preview, false);
    expect(
      find.bySemanticsLabel('Decorative rate line; price history unavailable'),
      findsOneWidget,
    );
    await t.pumpWidget(const SizedBox());
  });
  for (final sell in [false, true]) {
    testWidgets(
      'Home action ${sell ? 'Sell' : 'Deposit'} opens existing route',
      (t) async {
        final c = await pumpPreview(t);
        addTearDown(() => closePreview(t, c));
        final card = find.byWidgetPredicate(
          (w) => w is UsdtActionCard && w.sell == sell,
        );
        await t.ensureVisible(card);
        await t.tap(card);
        await t.pumpAndSettle();
        expect(find.text(sell ? 'Sell USDT' : 'Deposit USDT'), findsWidgets);
        expect(find.byType(UsdtTokenIcon), findsWidgets);
      },
    );
  }
  for (final width in [320.0, 390.0, 430.0, 720.0]) {
    for (final scale in [1.0, 1.6]) {
      testWidgets(
        'deposit proof responsive $width / $scale with secure submission',
        (t) async {
          t.view.physicalSize = Size(width, 900);
          t.view.devicePixelRatio = 1;
          t.platformDispatcher.textScaleFactorTestValue = scale;
          final adapter = ProofAdapter();
          final dio = Dio()..httpClientAdapter = adapter;
          final api = ApiSession(dio, MemoryStore())
            ..accessToken = 'test-token';
          final c = ProviderContainer(
            overrides: [
              apiSessionProvider.overrideWithValue(api),
              previewModeProvider.overrideWithValue(true),
              depositProofPickerProvider.overrideWithValue(
                () async => PlatformFile(
                  name: 'usdt-transfer.png',
                  size: File('test/assets/usdt-proof-preview.png').lengthSync(),
                  bytes: File(
                    'test/assets/usdt-proof-preview.png',
                  ).readAsBytesSync(),
                ),
              ),
            ],
          );
          c.read(previewProvider.notifier).login();
          final balance = c.read(previewProvider).balance;
          final key = GlobalKey();
          await t.pumpWidget(
            UncontrolledProviderScope(
              container: c,
              child: RepaintBoundary(
                key: key,
                child: MaterialApp(
                  theme: dtLightTheme,
                  debugShowCheckedModeBanner: false,
                  home: const SubmitDepositPage(),
                ),
              ),
            ),
          );
          await t.pumpAndSettle();
          for (final card in [
            'deposit-amount-card',
            'deposit-hash-card',
            'deposit-proof-card',
          ]) {
            expect(find.byKey(Key(card)), findsOneWidget);
          }
          final submitButton = find.byWidgetPredicate(
            (w) => w is DtButton && w.label == 'Submit Deposit Request',
          );
          expect(t.widget<DtButton>(submitButton).onPressed, isNull);
          if (width == 390 && scale == 1) {
            await shot(t, key, '04_TxID_Proof_Form');
          }
          await t.enterText(
            find.byKey(const Key('deposit-txid')),
            'not-a-hash',
          );
          await tapUx(t, 'Submit Deposit Request');
          expect(adapter.writes, isEmpty);
          await t.ensureVisible(find.byKey(const Key('deposit-txid')));
          await t.pumpAndSettle();
          expect(
            find.text('Enter the 64-character TRON transaction hash.'),
            findsOneWidget,
          );
          TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
              .setMockMethodCallHandler(SystemChannels.platform, (call) async {
                if (call.method == 'Clipboard.getData') {
                  return {'text': 'b' * 64};
                }
                return null;
              });
          await tapUx(t, 'Paste TxID');
          await tapUx(t, 'Clear');
          expect(
            t
                .widget<TextFormField>(find.byKey(const Key('deposit-txid')))
                .controller!
                .text,
            isEmpty,
          );
          await tapUx(t, 'Paste TxID');
          expect(
            t
                .widget<TextFormField>(find.byKey(const Key('deposit-txid')))
                .controller!
                .text,
            'b' * 64,
          );
          await t.enterText(find.byKey(const Key('deposit-amount')), '100.00');
          await tapUx(t, 'Upload Screenshot');
          expect(adapter.writes, isEmpty); // Selecting never uploads.
          expect(find.text('usdt-transfer.png'), findsOneWidget);
          expect(find.text('Proof selected'), findsOneWidget);
          expect(t.widget<DtButton>(submitButton).onPressed, isNotNull);
          await tapUx(t, 'Replace');
          expect(find.text('usdt-transfer.png'), findsOneWidget);
          final thumbnail = t.widget<Image>(find.byType(Image));
          await t.runAsync(
            () => precacheImage(thumbnail.image, t.element(find.byType(Image))),
          );
          await t.pumpAndSettle();
          expect(
            t
                .widgetList<RawImage>(find.byType(RawImage))
                .any((w) => w.image != null),
            true,
          );
          if (width == 390 && scale == 1) {
            t.view.physicalSize = Size(width, 1000);
            await t.pumpAndSettle();
            await t.ensureVisible(find.text('Upload Deposit Proof').first);
            await t.pumpAndSettle();
            await shot(t, key, '05_Proof_Selected');
          }
          await tapUx(t, 'Remove');
          expect(find.text('usdt-transfer.png'), findsNothing);
          expect(t.widget<DtButton>(submitButton).onPressed, isNull);
          await tapUx(t, 'Upload Screenshot');
          await tapUx(t, 'Submit Deposit Request');
          await t.pumpAndSettle();
          expect(
            adapter.writes.map((o) => o.path),
            ['/manual/files', '/manual/deposits'],
            reason: t
                .widgetList<Text>(find.byType(Text))
                .map((w) => w.data)
                .join(' | '),
          );
          expect(adapter.writes.last.data['txHash'], 'b' * 64);
          expect(adapter.writes.last.data['proofId'], 'proof-123');
          expect(find.text('Under Review'), findsOneWidget);
          await revealText(t, 'View Deposit Status');
          expect(find.text('View Deposit Status'), findsOneWidget);
          expect(
            c.read(previewProvider).balance,
            balance,
          ); // No optimistic credit.
          expect(t.takeException(), isNull);
          if (width == 390 && scale == 1) {
            await shot(t, key, '06_Deposit_Submitted');
          }
          await t.pumpWidget(const SizedBox());
          c.dispose();
          dio.close();
          t.view.resetPhysicalSize();
          t.view.resetDevicePixelRatio();
          t.platformDispatcher.clearTextScaleFactorTestValue();
          TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
              .setMockMethodCallHandler(SystemChannels.platform, null);
        },
      );
    }
  }
  for (final badFile in ['large', 'unsupported', 'empty']) {
    testWidgets('proof picker rejects $badFile before upload', (t) async {
      final adapter = ProofAdapter();
      final dio = Dio()..httpClientAdapter = adapter;
      final c = ProviderContainer(
        overrides: [
          previewModeProvider.overrideWithValue(true),
          apiSessionProvider.overrideWithValue(
            ApiSession(dio, MemoryStore())..accessToken = 'test',
          ),
          depositProofPickerProvider.overrideWithValue(
            () async => PlatformFile(
              name: badFile == 'unsupported' ? 'payload.exe' : 'proof.png',
              size: badFile == 'large'
                  ? 5242881
                  : badFile == 'empty'
                  ? 0
                  : 4,
              bytes: Uint8List(4),
            ),
          ),
        ],
      );
      await t.pumpWidget(
        UncontrolledProviderScope(
          container: c,
          child: MaterialApp(
            theme: dtLightTheme,
            home: const SubmitDepositPage(),
          ),
        ),
      );
      await t.pumpAndSettle();
      await tapUx(t, 'Upload Screenshot');
      expect(
        find.text('Choose a JPG, PNG or PDF file up to 5 MB.'),
        findsOneWidget,
      );
      expect(adapter.writes, isEmpty);
      await t.pumpWidget(const SizedBox());
      c.dispose();
      dio.close();
    });
  }
  testWidgets('deposit CTA remains scrollable above the keyboard', (t) async {
    t.view.physicalSize = const Size(320, 700);
    t.view.devicePixelRatio = 1;
    t.view.viewInsets = const FakeViewPadding(bottom: 280);
    final c = ProviderContainer(
      overrides: [previewModeProvider.overrideWithValue(true)],
    );
    await t.pumpWidget(
      UncontrolledProviderScope(
        container: c,
        child: MaterialApp(
          theme: dtLightTheme,
          home: const SubmitDepositPage(),
        ),
      ),
    );
    await t.pumpAndSettle();
    final button = find.descendant(
      of: find.byType(DtButton),
      matching: find.text('Submit Deposit Request'),
    );
    await t.ensureVisible(button);
    await t.pumpAndSettle();
    expect(t.getRect(button).bottom, lessThanOrEqualTo(420));
    expect(t.takeException(), isNull);
    await t.pumpWidget(const SizedBox());
    c.dispose();
    t.view.resetViewInsets();
    t.view.resetPhysicalSize();
    t.view.resetDevicePixelRatio();
  });
  for (final route in ['/home', '/sell/amount', '/history']) {
    testWidgets('updated screen preview $route', (t) async {
      final key = GlobalKey();
      final c = await pumpPreview(
        t,
        route: route,
        size: const Size(390, 1000),
        boundary: key,
      );
      addTearDown(() => closePreview(t, c));
      await t.pumpAndSettle();
      expect(t.takeException(), isNull);
      expect(find.byType(UsdtTokenIcon), findsWidgets);
      await shot(
        t,
        key,
        route == '/home'
            ? '01_Home'
            : route == '/history'
            ? '08_History'
            : '07_Sell_USDT',
      );
    });
  }
  testWidgets('manual deposit includes address and inline proof form', (
    t,
  ) async {
    t.view.physicalSize = const Size(390, 1000);
    t.view.devicePixelRatio = 1;
    final dio = Dio()..httpClientAdapter = ProofAdapter();
    final key = GlobalKey();
    final c = ProviderContainer(
      overrides: [
        previewModeProvider.overrideWithValue(true),
        apiSessionProvider.overrideWithValue(
          ApiSession(dio, MemoryStore())..accessToken = 'test',
        ),
      ],
    );
    await t.pumpWidget(
      UncontrolledProviderScope(
        container: c,
        child: RepaintBoundary(
          key: key,
          child: MaterialApp(
            theme: dtLightTheme,
            debugShowCheckedModeBanner: false,
            home: ManualDepositPage(configuration: config),
          ),
        ),
      ),
    );
    await t.pumpAndSettle();
    await shot(t, key, '03_Deposit_USDT');
    await revealText(t, 'Transaction Hash');
    expect(find.byKey(const Key('deposit-txid')), findsOneWidget);
    expect(t.takeException(), isNull);
    await t.pumpWidget(const SizedBox());
    c.dispose();
    dio.close();
    t.view.resetPhysicalSize();
    t.view.resetDevicePixelRatio();
  });
}
