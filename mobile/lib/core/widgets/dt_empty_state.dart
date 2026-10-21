import 'package:dt_exchange/core/design/appearance.dart';
import 'package:flutter/material.dart';
import '../design/tokens.dart';

class DtEmptyState extends StatelessWidget {
  const DtEmptyState({
    required this.title,
    required this.description,
    this.icon = Icons.receipt_long_outlined,
    super.key,
  });
  final String title;
  final String description;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(24),
    child: Column(
      children: [
        Container(
          padding: const EdgeInsets.all(17),
          decoration: BoxDecoration(
            color: dtColor(context, DtColors.softMint),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Icon(icon, color: dtColor(context, const Color(0xFF087E64))),
        ),
        const SizedBox(height: 16),
        Text(
          title,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 8),
        Text(
          description,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      ],
    ),
  );
}
