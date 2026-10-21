import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/widgets/dt_card.dart';
import '../../core/widgets/dt_empty_state.dart';

class RoutePlaceholder extends StatelessWidget {
  const RoutePlaceholder({required this.title, required this.phase, super.key});
  final String title;
  final int phase;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(title),
      leading: IconButton(
        tooltip: 'Back',
        icon: const Icon(Icons.arrow_back),
        onPressed: () => context.canPop() ? context.pop() : context.go('/home'),
      ),
    ),
    body: SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          DtCard(
            child: DtEmptyState(
              title: title,
              description:
                  'Navigation is ready. This screen is scheduled for Phase $phase.',
            ),
          ),
        ],
      ),
    ),
  );
}
