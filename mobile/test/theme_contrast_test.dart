import 'dart:io';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:dt_exchange/core/design/appearance.dart';
import 'package:dt_exchange/core/design/theme.dart';
import 'package:dt_exchange/core/presentation/kit.dart';
import 'package:dt_exchange/features/wallet/wallet_pages.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'test_support.dart';

double contrast(Color ink, Color surface) {
  final a = ink.computeLuminance(), b = surface.computeLuminance();
  return (math.max(a, b) + .05) / (math.min(a, b) + .05);
}

Color textInk(WidgetTester t, Finder finder) {
  final text = t.widget<Text>(finder);
  return text.style?.color ??
      DefaultTextStyle.of(t.element(finder)).style.color!;
}

Future<void> capture(WidgetTester t, GlobalKey key, String name) async {
  await t.runAsync(() async {
    final image =
        await (key.currentContext!.findRenderObject() as RenderRepaintBoundary)
            .toImage();
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    final directory = Directory('../.tools/master-visuals');
    await directory.create(recursive: true);
    await File(
      '${directory.path}/$name.png',
    ).writeAsBytes(bytes!.buffer.asUint8List());
    image.dispose();
  });
}

void main() {
  setUpAll(loadPreviewFonts);
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  for (final mode in [ThemeMode.light, ThemeMode.dark]) {
    testWidgets('$mode Home text, shortcuts and navigation remain legible', (
      t,
    ) async {
      t.platformDispatcher.accessibilityFeaturesTestValue =
          FakeAccessibilityFeatures(disableAnimations: true);
      addTearDown(t.platformDispatcher.clearAccessibilityFeaturesTestValue);
      final boundary = GlobalKey();
      final c = await pumpPreview(
        t,
        size: const Size(390, 1000),
        boundary: boundary,
      );
      await c.read(appearanceProvider.notifier).select(mode);
      await t.pump();
      await t.pump(const Duration(milliseconds: 400));
      // Allow inherited text/icon transitions triggered by the theme frame.
      await t.pump(const Duration(milliseconds: 400));
      final dark = mode == ThemeMode.dark;
      final mint = dark ? DtColors.darkMint : DtColors.softMint;
      final surface = dark ? DtColors.darkSurface : DtColors.white;
      for (final label in ['USDT / INR', 'PREVIEW', '+0.24%', '+₹0.25 (24h)']) {
        expect(
          contrast(textInk(t, find.text(label)), mint),
          greaterThanOrEqualTo(4.5),
          reason: label,
        );
      }
      expect(
        contrast(textInk(t, find.text('Your USDT balance')), mint),
        greaterThanOrEqualTo(4.5),
      );
      for (final data in [
        Icons.south_west_rounded,
        Icons.account_balance_outlined,
        Icons.headset_mic_outlined,
      ]) {
        final icon = t.widget<Icon>(find.byIcon(data).first);
        expect(
          contrast(icon.color!, surface),
          greaterThanOrEqualTo(3),
          reason: '$data',
        );
      }
      final navIcon = find.byIcon(Icons.home_rounded);
      final ink = IconTheme.of(t.element(navIcon)).color!;
      expect(contrast(ink, mint), greaterThanOrEqualTo(3));
      // Bright action artwork intentionally retains its dark foreground.
      expect(textInk(t, find.text('Deposit USDT')), DtColors.navy);
      expect(t.takeException(), isNull);
      await capture(t, boundary, dark ? 'home-dark-corrected' : 'home-light');
      await closePreview(t, c);
    });

    testWidgets('$mode detail values, address and QR keep readable contrast', (
      t,
    ) async {
      final theme = mode == ThemeMode.dark ? dtDarkTheme : dtLightTheme;
      final boundary = GlobalKey();
      const address = 'TReyJ2Amq4GhmrwdCuVwLPtpQCk1SUhBmn';
      await t.pumpWidget(
        MaterialApp(
          theme: theme,
          home: RepaintBoundary(
            key: boundary,
            child: Scaffold(
              body: SingleChildScrollView(
                child: Column(
                  children: const [
                    DetailRow('Language', 'English'),
                    DepositAddressCard(
                      address: address,
                      sandbox: false,
                      preview: false,
                      compact: true,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
      await t.pump(const Duration(seconds: 1));
      expect(
        contrast(textInk(t, find.text('English')), theme.colorScheme.surface),
        greaterThanOrEqualTo(4.5),
      );
      final addressText = t.widget<SelectableText>(find.byType(SelectableText));
      expect(addressText.data, address);
      expect(
        contrast(addressText.style!.color!, theme.colorScheme.surface),
        greaterThanOrEqualTo(4.5),
      );
      final qr = t.widget<QrImageView>(find.byType(QrImageView));
      expect(qr.backgroundColor, Colors.white);
      expect(
        contrast(qr.eyeStyle.color!, qr.backgroundColor),
        greaterThanOrEqualTo(7),
      );
      expect(
        contrast(qr.dataModuleStyle.color!, qr.backgroundColor),
        greaterThanOrEqualTo(7),
      );
      expect(t.takeException(), isNull);
      await capture(
        t,
        boundary,
        mode == ThemeMode.dark ? 'address-dark-corrected' : 'address-light',
      );
    });
  }
}
