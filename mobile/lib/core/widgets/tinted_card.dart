import 'package:dt_exchange/core/design/appearance.dart';
import 'package:flutter/material.dart';
import '../design/tokens.dart';

/// Light surfaces composed from the canonical palette, without new brand tokens.
class TintedCard extends StatelessWidget {
  const TintedCard({
    required this.child,
    this.tint = DtColors.softMint,
    this.accent = DtColors.teal,
    this.radius = 22,
    this.padding = const EdgeInsets.all(20),
    super.key,
  });
  final Widget child;
  final Color tint, accent;
  final double radius;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: accent.withValues(alpha: .18)),
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Color.lerp(
            dtColor(context, DtColors.white),
            dtColor(context, tint),
            .65,
          )!,
          dtColor(context, tint),
          Color.alphaBlend(
            accent.withValues(alpha: .09),
            dtColor(context, DtColors.white),
          ),
        ],
      ),
      boxShadow: [
        BoxShadow(
          color: DtColors.navy.withValues(alpha: .035),
          blurRadius: 22,
          offset: const Offset(0, 7),
        ),
        BoxShadow(
          color: accent.withValues(alpha: .035),
          blurRadius: 30,
          offset: const Offset(6, 2),
        ),
      ],
    ),
    child: ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: Stack(
        children: [
          Positioned(
            right: -45,
            top: -65,
            child: IgnorePointer(
              child: Container(
                width: 210,
                height: 210,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      accent.withValues(alpha: .08),
                      accent.withValues(alpha: 0),
                    ],
                  ),
                ),
              ),
            ),
          ),
          Padding(padding: padding, child: child),
        ],
      ),
    ),
  );
}

class DashedUploadFrame extends StatelessWidget {
  const DashedUploadFrame({required this.child, super.key});
  final Widget child;
  @override
  Widget build(BuildContext context) => CustomPaint(
    foregroundPainter: const _DashedBorder(),
    child: Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: dtColor(context, DtColors.white).withValues(alpha: .7),
        borderRadius: BorderRadius.circular(16),
      ),
      child: child,
    ),
  );
}

class _DashedBorder extends CustomPainter {
  const _DashedBorder();
  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..addRRect(
        RRect.fromRectAndRadius(
          (Offset.zero & size).deflate(1),
          const Radius.circular(16),
        ),
      );
    final paint = Paint()
      ..color = DtColors.teal.withValues(alpha: .45)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;
    for (final metric in path.computeMetrics()) {
      for (double offset = 0; offset < metric.length; offset += 10) {
        canvas.drawPath(metric.extractPath(offset, offset + 5), paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DashedBorder oldDelegate) => false;
}
