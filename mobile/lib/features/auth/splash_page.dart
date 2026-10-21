import 'package:dt_exchange/core/design/appearance.dart';
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../preview/preview_controller.dart';
import 'package:go_router/go_router.dart';

import '../../core/presentation/kit.dart';

class SplashPage extends ConsumerStatefulWidget {
  const SplashPage({super.key});
  @override
  ConsumerState<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends ConsumerState<SplashPage> {
  Timer? timer;
  @override
  void initState() {
    super.initState();
    timer = Timer(const Duration(milliseconds: 1800), () async {
      if (!ref.read(previewModeProvider)) {
        await ref.read(previewProvider.notifier).restore();
      }
      if (mounted) {
        context.go(ref.read(previewProvider).signedIn ? '/home' : '/login');
      }
    });
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: dtColor(context, DtColors.white),
    body: Stack(
      children: [
        Positioned.fill(child: CustomPaint(painter: _Waves())),
        SafeArea(
          child: Center(
            child: DtReveal(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.all(21),
                    decoration: BoxDecoration(
                      color: dtColor(context, DtColors.white),
                      borderRadius: BorderRadius.circular(36),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x1320DDA5),
                          blurRadius: 42,
                          offset: Offset(0, 18),
                        ),
                      ],
                    ),
                    child: const DtLogo(size: 100),
                  ),
                  const SizedBox(height: 30),
                  Text(
                    'DT Exchange',
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Sell USDT. Receive INR.',
                    style: TextStyle(
                      color: dtColor(context, DtColors.muted),
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 44),
                  SizedBox(
                    width: 100,
                    child: LinearProgressIndicator(
                      minHeight: 2,
                      backgroundColor: dtColor(context, DtColors.softMint),
                      color: DtColors.teal,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        Positioned(
          left: 24,
          right: 24,
          bottom: 36,
          child: Center(
            child: Text(
              'A simpler way forward.',
              style: TextStyle(
                fontSize: 12,
                color: dtColor(context, DtColors.muted),
              ),
            ),
          ),
        ),
      ],
    ),
  );
}

class _Waves extends CustomPainter {
  @override
  void paint(Canvas c, Size s) {
    for (var i = 0; i < 3; i++) {
      final p = Path()
        ..moveTo(0, s.height * (.77 + i * .055))
        ..cubicTo(
          s.width * .4,
          s.height * (.6 + i * .04),
          s.width * .6,
          s.height * (1 + i * .02),
          s.width,
          s.height * (.75 + i * .06),
        )
        ..lineTo(s.width, s.height)
        ..lineTo(0, s.height)
        ..close();
      c.drawPath(
        p,
        Paint()
          ..color = [
            DtColors.softMint,
            DtColors.softBlue,
            DtColors.background,
          ][i].withValues(alpha: .65),
      );
    }
  }

  @override
  bool shouldRepaint(_Waves old) => false;
}
