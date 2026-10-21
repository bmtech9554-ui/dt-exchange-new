import 'package:dt_exchange/core/design/appearance.dart';
import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import '../design/tokens.dart';

/// The approved curve is decorative artwork in connected mode, not price history.
/// Time labels and sample movements belong exclusively to preview mode.
class RateSparkline extends StatefulWidget {
  const RateSparkline({
    this.preview = false,
    this.animate = true,
    this.valueLabel,
    this.height = 88,
    super.key,
  });
  final bool preview;
  final bool animate;
  final String? valueLabel;
  final double height;
  @override
  State<RateSparkline> createState() => _RateSparklineState();
}

class _RateSparklineState extends State<RateSparkline>
    with TickerProviderStateMixin, WidgetsBindingObserver {
  late final entrance = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1600),
  )..addStatusListener(onEntrance);
  late final sweep = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 4200),
  );
  Timer? cycle;
  bool active = true;
  bool motionAllowed = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    active =
        WidgetsBinding.instance.lifecycleState == null ||
        WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed;
  }

  void onEntrance(AnimationStatus status) {
    if (status == AnimationStatus.completed && motionAllowed) {
      startAmbient();
    }
  }

  void startAmbient() {
    cycle?.cancel();
    if (!widget.preview) {
      // Production movement is decorative: repaint only the cached overlay,
      // without a timer, rate polling or rebuilding the Home widget.
      sweep.repeat();
      return;
    }
    sweep.forward(from: 0);
    // The quiet interval avoids constant frames while retaining a slow pulse.
    cycle = Timer.periodic(
      const Duration(seconds: 7),
      (_) => sweep.forward(from: 0),
    );
  }

  void syncMotion() {
    cycle?.cancel();
    entrance.stop();
    sweep.stop();
    final reduced = MediaQuery.disableAnimationsOf(context);
    motionAllowed =
        widget.animate &&
        active &&
        !reduced &&
        TickerMode.valuesOf(context).enabled;
    if (reduced) {
      entrance.value = 1;
      sweep.value = 0;
    } else if (motionAllowed) {
      if (entrance.value < 1) {
        entrance.forward();
      } else {
        startAmbient();
      }
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    syncMotion();
  }

  @override
  void didUpdateWidget(RateSparkline oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.preview != widget.preview ||
        oldWidget.animate != widget.animate) {
      syncMotion();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    active = state == AppLifecycleState.resumed;
    syncMotion();
  }

  @override
  void dispose() {
    cycle?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    entrance.dispose();
    sweep.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Semantics(
    label: widget.preview
        ? 'Sample rate trend; preview only'
        : 'Decorative rate line; price history unavailable',
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          height: widget.height,
          width: double.infinity,
          child: AnimatedBuilder(
            animation: entrance,
            builder: (_, _) => Stack(
              fit: StackFit.expand,
              children: [
                // Once entrance completes, this layer stays cached during idle motion.
                RepaintBoundary(
                  child: CustomPaint(
                    painter: RateSparklinePainter(
                      progress: entrance.value,
                      preview: widget.preview,
                      sweep: sweep,
                    ),
                  ),
                ),
                if (entrance.value == 1)
                  RepaintBoundary(
                    child: CustomPaint(
                      painter: RateGlintPainter(sweep, preview: widget.preview),
                    ),
                  ),
                if (widget.valueLabel != null)
                  Positioned(
                    right: 0,
                    top: 0,
                    child: Opacity(
                      opacity: ((entrance.value - .65) / .35).clamp(0, 1),
                      child: Container(
                        key: const Key('rate-value-bubble'),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 9,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: dtColor(context, DtColors.white),
                          borderRadius: BorderRadius.circular(9),
                          border: Border.all(
                            color: DtColors.teal.withValues(alpha: .22),
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: DtColors.teal.withValues(alpha: .10),
                              blurRadius: 9,
                              offset: const Offset(0, 3),
                            ),
                          ],
                        ),
                        child: Text(
                          widget.valueLabel!,
                          style: TextStyle(
                            fontSize: 10,
                            color: dtColor(context, DtColors.navy),
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        if (widget.preview) ...[
          const SizedBox(height: 6),
          Row(
            children: [
              for (final label in ['12 AM', '6 AM', '12 PM', '6 PM', '12 AM'])
                Expanded(
                  child: Text(
                    label,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 9,
                      color: dtColor(context, DtColors.muted),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ],
    ),
  );
}

class _CurveGeometry {
  _CurveGeometry(Size size) {
    // Original approved compact-Home artwork; these are normalized drawing
    // coordinates, never market observations or inputs to financial calculations.
    const values = [.78, .72, .77, .48, .56, .34, .42, .24, .29, .13];
    final points = List.generate(
      values.length,
      (i) => Offset(
        10 + i * (size.width - 24) / (values.length - 1),
        30 + values[i] * (size.height - 40),
      ),
    );
    end = points.last;
    line = Path()..moveTo(points.first.dx, points.first.dy);
    for (var i = 1; i < points.length; i++) {
      final a = points[i - 1], b = points[i], mid = (a.dx + b.dx) / 2;
      line.cubicTo(mid, a.dy, mid, b.dy, b.dx, b.dy);
    }
    metric = line.computeMetrics().first;
    area = Path.from(line)
      ..lineTo(end.dx, size.height - 2)
      ..lineTo(points.first.dx, size.height - 2)
      ..close();
  }
  late final Offset end;
  late final Path line, area;
  late final ui.PathMetric metric;
}

class RateSparklinePainter extends CustomPainter {
  RateSparklinePainter({
    required this.progress,
    required this.preview,
    this.sweep,
  });
  final double progress;
  final bool preview;
  // Exposed for animation-state verification; only the overlay listens to it.
  final Animation<double>? sweep;
  @override
  void paint(Canvas canvas, Size size) {
    final geometry = _CurveGeometry(size);
    final draw = Curves.easeInOutCubic.transform((progress / .6).clamp(0, 1));
    final fill = Curves.easeOut.transform(((progress - .3) / .55).clamp(0, 1));
    final dot = Curves.easeOutCubic.transform(
      ((progress - .82) / .18).clamp(0, 1),
    );
    final rect = Offset.zero & size;
    // Original faint grid is decorative; time labels remain preview-only.
    final grid = Paint()
      ..color = DtColors.navy.withValues(alpha: .055)
      ..strokeWidth = .6;
    for (var i = 0; i < 4; i++) {
      final y = 28 + (size.height - 30) * i / 3;
      canvas.drawLine(Offset(10, y), Offset(size.width - 14, y), grid);
    }
    for (var i = 0; i < 5; i++) {
      final x = 10 + (size.width - 24) * i / 4;
      for (double y = 28; y < size.height - 2; y += 6) {
        canvas.drawLine(
          Offset(x, y),
          Offset(x, math.min(y + 2, size.height - 2)),
          grid,
        );
      }
    }
    canvas.save();
    canvas.clipRect(Rect.fromLTWH(0, 0, size.width * draw, size.height));
    canvas.drawPath(
      geometry.area,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            DtColors.mint.withValues(alpha: .24 * fill),
            DtColors.aqua.withValues(alpha: .02 * fill),
          ],
          stops: [0, .6 + .4 * fill],
        ).createShader(rect.translate(0, 12 * (1 - fill))),
    );
    canvas.restore();
    canvas.drawRect(
      Rect.fromLTWH(
        geometry.end.dx - 9,
        geometry.end.dy,
        18,
        size.height - geometry.end.dy,
      ),
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            DtColors.aqua.withValues(alpha: .12 * dot),
            DtColors.aqua.withValues(alpha: 0),
          ],
        ).createShader(rect),
    );

    final revealed = geometry.metric.extractPath(
      0,
      geometry.metric.length * draw,
    );
    canvas.drawPath(
      revealed,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 9
        ..color = DtColors.teal.withValues(alpha: .11)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 5),
    );
    for (final fraction in [.18, .4, .62, .81]) {
      if (draw < fraction) continue;
      final point = geometry.metric
          .getTangentForOffset(geometry.metric.length * fraction)!
          .position;
      canvas.drawCircle(
        point,
        6,
        Paint()..color = DtColors.teal.withValues(alpha: .10),
      );
      canvas.drawCircle(point, 2.3, Paint()..color = DtColors.white);
      canvas.drawCircle(point, 1.2, Paint()..color = DtColors.teal);
    }

    canvas.drawPath(
      revealed,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeWidth = 3
        ..shader = const LinearGradient(
          colors: [DtColors.mint, DtColors.teal, DtColors.aqua],
        ).createShader(rect),
    );
    if (dot > 0) {
      canvas.drawCircle(
        geometry.end,
        9 * dot,
        Paint()..color = DtColors.teal.withValues(alpha: .10 * dot),
      );
      canvas.drawCircle(
        geometry.end,
        4.5 * dot,
        Paint()..color = DtColors.teal,
      );
      canvas.drawCircle(
        geometry.end,
        1.8 * dot,
        Paint()..color = DtColors.white,
      );
    }
  }

  @override
  bool shouldRepaint(RateSparklinePainter old) =>
      old.progress != progress || old.preview != preview;
}

/// Only the tiny glint and endpoint halo animate after the chart is drawn.
class RateGlintPainter extends CustomPainter {
  RateGlintPainter(this.sweep, {this.preview = true}) : super(repaint: sweep);
  final bool preview;
  final Animation<double> sweep;
  Size? cachedSize;
  _CurveGeometry? _cachedGeometry;
  @override
  void paint(Canvas canvas, Size size) {
    if (size != cachedSize) {
      cachedSize = size;
      _cachedGeometry = _CurveGeometry(size);
    }
    final g = _cachedGeometry!;
    final phase = sweep.value;
    final breath = math.sin(math.pi * phase);
    if (breath <= 0) return;
    for (final fraction in [.18, .4, .62, .81]) {
      final dot = g.metric
          .getTangentForOffset(g.metric.length * fraction)!
          .position;
      final shimmer =
          breath * (.55 + .45 * math.sin(phase * math.pi * 2 + fraction * 5));
      canvas.drawCircle(
        dot,
        5 + 2 * shimmer,
        Paint()..color = DtColors.aqua.withValues(alpha: .15 * shimmer),
      );
    }
    final distance = g.metric.length * (.24 + .72 * phase);
    final point = g.metric.getTangentForOffset(distance)!.position;
    final highlight = g.metric.extractPath(
      (distance - 16).clamp(0, g.metric.length),
      distance,
    );
    canvas.drawPath(
      highlight,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeWidth = 4
        ..color = DtColors.white.withValues(alpha: .65 * breath),
    );
    canvas.drawCircle(
      point,
      6,
      Paint()
        ..color = DtColors.aqua.withValues(alpha: .18 * breath)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3),
    );
    canvas.drawCircle(
      point,
      2,
      Paint()..color = DtColors.white.withValues(alpha: breath),
    );
    canvas.drawCircle(
      g.end,
      9 + 3 * breath,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = DtColors.teal.withValues(alpha: .18 * breath),
    );
  }

  @override
  bool shouldRepaint(RateGlintPainter old) =>
      old.sweep != sweep || old.preview != preview;
}
