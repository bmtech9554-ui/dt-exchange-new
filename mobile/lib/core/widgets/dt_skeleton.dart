import 'package:dt_exchange/core/design/appearance.dart';
import 'package:flutter/material.dart';
import '../design/tokens.dart';

class DtSkeleton extends StatefulWidget {
  const DtSkeleton({this.height = 18, this.width, super.key});
  final double height;
  final double? width;
  @override
  State<DtSkeleton> createState() => _DtSkeletonState();
}

class _DtSkeletonState extends State<DtSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  );
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _controller.stop();
    } else {
      _controller.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _controller,
    builder: (_, _) => Container(
      width: widget.width,
      height: widget.height,
      decoration: BoxDecoration(
        color: Color.lerp(
          dtColor(context, DtColors.border),
          dtColor(context, DtColors.softBlue),
          _controller.value,
        ),
        borderRadius: BorderRadius.circular(8),
      ),
    ),
  );
}
