import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dt_exchange/preview/preview_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dt_exchange/core/presentation/kit.dart';
import 'test_support.dart';
import 'deposit_ux_test.dart' show shot;

void main() {
  setUpAll(loadPreviewFonts);
  testWidgets('Home status override preserves styling and other page labels', (
    t,
  ) async {
    const message =
        'The funding we provide is clean, secure, and fully guaranteed.';
    for (final width in [320.0, 390.0]) {
      t.view.physicalSize = Size(width, 700);
      t.view.devicePixelRatio = 1;
      await t.pumpWidget(
        ProviderScope(
          overrides: [previewModeProvider.overrideWithValue(false)],
          child: const MaterialApp(
            home: AppPage(title: 'Home', statusMessage: message, children: []),
          ),
        ),
      );
      final label = t.widget<Text>(find.text(message));
      expect(label.style?.fontSize, 10);
      expect(label.style?.letterSpacing, .8);
      expect(label.style?.color, DtColors.muted);
      expect(t.takeException(), isNull);
      await t.pumpWidget(
        ProviderScope(
          overrides: [previewModeProvider.overrideWithValue(false)],
          child: const MaterialApp(
            home: AppPage(title: 'Wallet', children: []),
          ),
        ),
      );
      expect(find.text('Provider-confirmed payout updates'), findsOneWidget);
      expect(find.text(message), findsNothing);
    }
    await t.pumpWidget(const SizedBox());
    t.view.resetPhysicalSize();
    t.view.resetDevicePixelRatio();
  });

  for (final size in [
    const Size(360, 740),
    const Size(360, 800),
    const Size(393, 852),
    const Size(412, 915),
  ]) {
    testWidgets('Home main actions visible without scrolling at $size', (
      t,
    ) async {
      t.view.padding = const FakeViewPadding(top: 24, bottom: 24);
      t.view.viewPadding = const FakeViewPadding(top: 24, bottom: 24);
      final key = GlobalKey();
      final c = await pumpPreview(t, size: size, boundary: key);
      addTearDown(() async {
        await closePreview(t, c);
        t.view.resetPadding();
        t.view.resetViewPadding();
      });
      await t.pumpAndSettle();
      final navTop = t.getRect(find.byType(NavigationBar)).top;
      expect(find.byKey(const Key('home-rate-card')), findsOneWidget);
      expect(find.byKey(const Key('home-balance-card')), findsOneWidget);
      expect(find.text('+0.24%'), findsOneWidget);
      expect(find.text('+₹0.25 (24h)'), findsOneWidget);
      expect(find.text('12 AM'), findsNWidgets(2));
      for (final time in ['6 AM', '12 PM', '6 PM']) {
        expect(find.text(time), findsOneWidget);
      }
      expect(find.byKey(const Key('rate-value-bubble')), findsOneWidget);
      expect(find.text('₹103.00'), findsNWidgets(2));
      for (final card in t.widgetList<UsdtActionCard>(
        find.byType(UsdtActionCard),
      )) {
        final finder = find.byWidget(card);
        final rect = t.getRect(finder);
        expect(
          rect.bottom,
          lessThanOrEqualTo(navTop),
          reason: '${card.sell ? 'Sell' : 'Deposit'} must be above navigation',
        );
        expect(rect.height, greaterThanOrEqualTo(100));
        expect(rect.width, greaterThanOrEqualTo(125));
        expect(finder.hitTestable(), findsOneWidget);
      }
      final scroll = t
          .stateList<ScrollableState>(find.byType(Scrollable))
          .firstWhere((s) => s.axisDirection == AxisDirection.down);
      expect(scroll.position.pixels, 0);
      expect(t.takeException(), isNull);
      await shot(
        t,
        key,
        'Home_Compact_${size.width.toInt()}x${size.height.toInt()}',
      );
    });
  }

  testWidgets(
    'narrow large-text Home remains scrollable with reachable actions',
    (t) async {
      final c = await pumpPreview(t, size: const Size(320, 700), scale: 1.6);
      addTearDown(() => closePreview(t, c));
      await t.pumpAndSettle();
      for (final sell in [false, true]) {
        final action = find.byWidgetPredicate(
          (w) => w is UsdtActionCard && w.sell == sell,
        );
        await t.ensureVisible(action);
        await t.pumpAndSettle();
        expect(action.hitTestable(), findsOneWidget);
      }
      expect(t.takeException(), isNull);
    },
  );

  testWidgets(
    'connected graph displays supplied rate bubble without time history',
    (t) async {
      await t.pumpWidget(
        const MaterialApp(
          home: Scaffold(body: RateSparkline(valueLabel: '₹103.00')),
        ),
      );
      await t.pump(const Duration(seconds: 2));
      expect(find.byKey(const Key('rate-value-bubble')), findsOneWidget);
      expect(find.text('12 AM'), findsNothing);
      expect(
        find.bySemanticsLabel(
          RegExp('Decorative rate line; price history unavailable'),
        ),
        findsOneWidget,
      );
      await t.pumpWidget(const SizedBox());
    },
  );
}
