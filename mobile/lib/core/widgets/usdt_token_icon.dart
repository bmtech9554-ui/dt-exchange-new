import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Canonical asset mark. This never replaces the DT Exchange brand logo.
class UsdtTokenIcon extends StatelessWidget {
  const UsdtTokenIcon({this.size = 28, super.key});
  final double size;
  @override
  Widget build(BuildContext context) => Semantics(
    label: 'USDT token',
    image: true,
    child: SizedBox.square(
      dimension: size,
      child: SvgPicture.string(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">'
        '<circle cx="24" cy="24" r="24" fill="#26A17B"/>'
        '<path d="M13 11h22v5H27v7h-6v-7h-8z" fill="white"/>'
        '<ellipse cx="24" cy="23" rx="15" ry="4.5" fill="white"/>'
        '<ellipse cx="24" cy="22" rx="12" ry="2.5" fill="#26A17B"/>'
        '<path d="M21 16h6v9h-6zm0 11h6v11h-6z" fill="white"/>'
        '</svg>',
        excludeFromSemantics: true,
      ),
    ),
  );
}
