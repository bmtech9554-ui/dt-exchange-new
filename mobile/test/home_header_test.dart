import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dt_exchange/core/presentation/kit.dart';
import 'package:dt_exchange/features/home/home_header.dart';
import 'test_support.dart';
import 'deposit_ux_test.dart' show shot;

void main() {
  setUpAll(loadPreviewFonts);

  testWidgets('supplied GIF preserves seven frames, timing and infinite loop', (
    t,
  ) async {
    await t.runAsync(() async {
      final codec = await ui.instantiateImageCodec(
        File(HomeBrandHeader.coinAsset).readAsBytesSync(),
      );
      expect(codec.frameCount, 7);
      expect(codec.repetitionCount, -1);
      for (var i = 0; i < codec.frameCount; i++) {
        final frame = await codec.getNextFrame();
        expect(frame.duration, const Duration(milliseconds: 120));
        expect(frame.image.width, 320);
        expect(frame.image.height, 320);
        frame.image.dispose();
      }
      codec.dispose();
    });
  });

  for (final width in [320.0, 360.0, 412.0, 480.0]) {
    testWidgets('Home header shows one coin and unchanged logo at $width', (
      t,
    ) async {
      // A static accessibility frame allows layout assertions and screenshots
      // while the codec test independently verifies the real looping animation.
      t.platformDispatcher.accessibilityFeaturesTestValue =
          FakeAccessibilityFeatures(disableAnimations: true);
      final key = GlobalKey();
      final c = await pumpPreview(t, size: Size(width, 800), boundary: key);
      addTearDown(() async {
        await closePreview(t, c);
        t.platformDispatcher.clearAccessibilityFeaturesTestValue();
      });
      final header = find.byType(HomeBrandHeader);
      final coin = find.descendant(of: header, matching: find.byType(Image));
      final logo = find.descendant(of: header, matching: find.byType(DtLogo));
      expect(coin, findsOneWidget);
      expect(logo, findsOneWidget);
      final image = t.widget<Image>(coin);
      expect((image.image as AssetImage).assetName, HomeBrandHeader.coinAsset);
      expect(image.gaplessPlayback, true);
      expect(image.fit, BoxFit.contain);
      expect(image.width, inInclusiveRange(42, 52));
      expect(image.width, image.height);
      expect(t.getRect(coin).left - t.getRect(logo).right, 12);
      expect(t.getCenter(coin).dy, t.getCenter(logo).dy);
      expect(t.widget<AppBar>(find.byType(AppBar)).toolbarHeight, 64);
      expect(find.text('DT Exchange'), findsNothing);
      expect(find.textContaining('Good to see you'), findsNothing);
      expect(find.byTooltip('Notifications').hitTestable(), findsOneWidget);
      expect(
        t.getRect(coin).right,
        lessThan(t.getRect(find.byTooltip('Notifications')).left),
      );
      for (var attempt = 0; attempt < 50; attempt++) {
        await t.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 20)),
        );
        await t.pump(const Duration(milliseconds: 20));
        if (t
                .widget<RawImage>(
                  find.descendant(of: coin, matching: find.byType(RawImage)),
                )
                .image !=
            null) {
          break;
        }
      }
      expect(
        t
            .widget<RawImage>(
              find.descendant(of: coin, matching: find.byType(RawImage)),
            )
            .image,
        isNotNull,
      );
      expect(t.takeException(), isNull);
      if (width == 360) await shot(t, key, 'Home_Single_Coin_Header');
    });
  }
}
