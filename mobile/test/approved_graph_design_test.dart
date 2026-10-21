import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dt_exchange/core/widgets/rate_sparkline.dart';

void main() {
  // Golden images rendered from the unchanged Build 8007 preview painter,
  // matching the approved compact-Home render. Never regenerate from this test.
  for (final height in [76, 88]) {
    testWidgets('connected artwork matches approved design at $height', (
      tester,
    ) async {
      final recorder = ui.PictureRecorder();
      final canvas = Canvas(recorder);
      final size = Size(320, height.toDouble());
      RateSparklinePainter(progress: 1, preview: false).paint(canvas, size);
      RateGlintPainter(
        const AlwaysStoppedAnimation(.35),
        preview: false,
      ).paint(canvas, size);
      final picture = recorder.endRecording();
      final image = await picture.toImage(320, height);
      await expectLater(
        image,
        matchesGoldenFile('goldens/approved-graph-$height.png'),
      );
      image.dispose();
      picture.dispose();
    });
  }
  testWidgets(
    'production bubble uses supplied rate without implying time history',
    (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(body: RateSparkline(valueLabel: 'INR 107.25')),
        ),
      );
      await tester.pump(const Duration(seconds: 2));
      expect(find.text('INR 107.25'), findsOneWidget);
      expect(find.text('12 AM'), findsNothing);
      expect(find.text('103.00'), findsNothing);
      expect(find.byKey(const Key('rate-value-bubble')), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );
}
