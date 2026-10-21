import 'package:flutter/material.dart';
import '../../core/widgets/dt_logo.dart';

/// The supplied animation is displayed once, without transforms or overlays.
class HomeBrandHeader extends StatelessWidget {
  const HomeBrandHeader({super.key});
  static const coinAsset = 'assets/animations/usdt_single_coin_flip_live.gif';

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final size = width < 360
        ? 44.0
        : width < 420
        ? 48.0
        : 52.0;
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        DtLogo(size: size),
        const SizedBox(width: 12),
        Image.asset(
          coinAsset,
          key: const Key('home-usdt-coin'),
          width: size,
          height: size,
          fit: BoxFit.contain,
          gaplessPlayback: true,
          semanticLabel: 'USDT coin',
        ),
      ],
    );
  }
}
