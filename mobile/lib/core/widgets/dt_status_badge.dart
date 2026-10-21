import 'package:dt_exchange/core/design/appearance.dart';
import 'package:flutter/material.dart';
import '../design/tokens.dart';

enum DtStatus { verified, verificationRequired, processing, failed }

class DtStatusBadge extends StatelessWidget {
  const DtStatusBadge(this.status, {super.key});
  final DtStatus status;
  @override
  Widget build(BuildContext context) {
    final (label, color, background, icon) = switch (status) {
      DtStatus.verified => (
        'Verified',
        dtColor(context, const Color(0xFF086750)),
        dtColor(context, DtColors.softMint),
        Icons.check_circle_outline,
      ),
      DtStatus.verificationRequired => (
        'Verification Required',
        dtColor(context, const Color(0xFF315FB1)),
        dtColor(context, DtColors.softBlue),
        Icons.info_outline,
      ),
      DtStatus.processing => (
        'Processing',
        dtColor(context, const Color(0xFF315FB1)),
        dtColor(context, DtColors.softBlue),
        Icons.schedule,
      ),
      DtStatus.failed => (
        'Failed',
        dtColor(context, DtColors.red),
        dtColor(context, DtColors.softRed),
        Icons.error_outline,
      ),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: color),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: color,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
