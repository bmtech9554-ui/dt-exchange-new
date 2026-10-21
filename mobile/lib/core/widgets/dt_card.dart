import 'package:flutter/material.dart';
import '../design/tokens.dart';
import '../design/appearance.dart';

class DtCard extends StatelessWidget {
  const DtCard({
    required this.child,
    this.color = DtColors.white,
    this.padding = const EdgeInsets.all(24),
    super.key,
  });
  final Widget child;
  final Color color;
  final EdgeInsetsGeometry padding;
  @override
  Widget build(BuildContext context) => Container(
    padding: padding,
    decoration: BoxDecoration(
      color: dtColor(context, color),
      borderRadius: BorderRadius.circular(DtRadius.card),
      boxShadow: const [
        BoxShadow(
          color: Color(0x06081B3A),
          blurRadius: 24,
          offset: Offset(0, 6),
        ),
      ],
    ),
    child: child,
  );
}
