import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

class DtLogo extends StatelessWidget {
  const DtLogo({this.size = 48, super.key});
  final double size;
  @override
  Widget build(BuildContext context) => SvgPicture.asset(
    'assets/brand/dt-monogram.svg',
    width: size,
    height: size,
    semanticsLabel: 'DT Exchange',
  );
}
