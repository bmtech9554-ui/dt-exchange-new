import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dt_exchange/core/widgets/rate_sparkline.dart';

Widget host({
  bool visible = true,
  bool reduced = false,
  bool available = true,
}) => MaterialApp(
  home: MediaQuery(
    data: MediaQueryData(disableAnimations: reduced),
    child: TickerMode(
      enabled: visible,
      child: Scaffold(body: RateSparkline(animate: available)),
    ),
  ),
);
AnimationController controller(WidgetTester t) =>
    t
            .widgetList<CustomPaint>(find.byType(CustomPaint))
            .map((w) => w.painter)
            .whereType<RateSparklinePainter>()
            .single
            .sweep!
        as AnimationController;

void main() {
  testWidgets(
    'production decorative overlay moves continuously without rebuilding the base curve',
    (t) async {
      await t.pumpWidget(host());
      await t.pump(const Duration(seconds: 2));
      final paints = t
          .widgetList<CustomPaint>(find.byType(CustomPaint))
          .map((w) => w.painter)
          .toList();
      expect(paints.whereType<RateGlintPainter>().single.preview, false);
      final base = paints.whereType<RateSparklinePainter>().single;
      final c = controller(t);
      expect(c.isAnimating, true);
      for (var i = 0; i < 12; i++) {
        final before = c.value;
        await t.pump(const Duration(milliseconds: 700));
        expect(c.value, isNot(before));
        expect(
          t
              .widgetList<CustomPaint>(find.byType(CustomPaint))
              .map((w) => w.painter)
              .whereType<RateSparklinePainter>()
              .single,
          same(base),
        );
      }
      expect(find.text('12 AM'), findsNothing);
      expect(find.byKey(const Key('rate-value-bubble')), findsNothing);
      await t.pumpWidget(const SizedBox());
      await t.pump(const Duration(seconds: 10));
      expect(t.takeException(), isNull);
      expect(t.binding.transientCallbackCount, 0);
    },
  );
  testWidgets(
    'production motion pauses for inactive tab and background, resumes safely',
    (t) async {
      await t.pumpWidget(host());
      await t.pump(const Duration(seconds: 2));
      final c = controller(t);
      await t.pumpWidget(host(visible: false));
      expect(c.isAnimating, false);
      final paused = c.value;
      await t.pump(const Duration(seconds: 5));
      expect(c.value, paused);
      await t.pumpWidget(host());
      expect(c.isAnimating, true);
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await t.pump();
      expect(c.isAnimating, false);
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await t.pump();
      expect(c.isAnimating, true);
      await t.pumpWidget(const SizedBox());
      expect(t.takeException(), isNull);
    },
  );
  testWidgets(
    'reduced motion and unavailable rate never run an ambient ticker',
    (t) async {
      await t.pumpWidget(host(available: false));
      await t.pump(const Duration(seconds: 3));
      expect(controller(t).isAnimating, false);
      await t.pumpWidget(host());
      await t.pump(const Duration(seconds: 2));
      expect(controller(t).isAnimating, true);
      await t.pumpWidget(host(reduced: true));
      expect(controller(t).isAnimating, false);
      await t.pump(const Duration(seconds: 8));
      expect(controller(t).value, 0);
      await t.pumpWidget(host());
      await t.pump();
      expect(controller(t).isAnimating, true);
      await t.pumpWidget(host(available: false));
      expect(controller(t).isAnimating, false);
      await t.pumpWidget(const SizedBox());
      expect(t.takeException(), isNull);
    },
  );
}
