import 'package:dt_exchange/core/design/appearance.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/design/tokens.dart';
import '../../core/widgets/dt_button.dart';
import '../../core/widgets/dt_card.dart';
import '../../core/widgets/dt_empty_state.dart';
import '../../core/widgets/dt_logo.dart';
import '../../core/widgets/dt_reveal.dart';

class FoundationPage extends StatelessWidget {
  const FoundationPage({required this.title, super.key});
  final String title;
  @override
  Widget build(BuildContext context) => SafeArea(
    child: ListView(
      key: PageStorageKey(title),
      padding: const EdgeInsets.all(24),
      children: [
        Row(
          children: [
            const DtLogo(size: 44),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'DT Exchange',
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
            CircleAvatar(
              radius: 18,
              backgroundColor: dtColor(context, DtColors.softBlue),
              child: Text(
                'DT',
                style: TextStyle(
                  fontSize: 12,
                  color: dtColor(context, DtColors.navy),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 28),
        Text(title, style: Theme.of(context).textTheme.labelSmall),
        const SizedBox(height: 8),
        Text(switch (title) {
          'Home' => 'A fresh start.',
          'Wallet' => 'Your money, clearly.',
          'History' => 'Every move, in view.',
          _ => 'Simply you.',
        }, style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 8),
        const Text('Sell USDT. Receive INR.'),
        const SizedBox(height: 24),
        if (title == 'Profile')
          ..._profile(context)
        else if (title == 'History')
          const DtCard(
            child: DtEmptyState(
              title: 'Every move, in view.',
              description: 'Transaction list and filters arrive in Phase 2.',
            ),
          )
        else ...[
          DtReveal(
            child: DtCard(
              color: dtColor(context, DtColors.softMint),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Balance component'),
                  const SizedBox(height: 16),
                  Text(
                    '— USDT',
                    style: Theme.of(context).textTheme.displaySmall,
                  ),
                  const SizedBox(height: 6),
                  const Text('Your balance will appear here'),
                  const SizedBox(height: 24),
                  Row(
                    children: [
                      Expanded(
                        child: DtButton(
                          label: 'Deposit',
                          icon: Icons.south_west,
                          style: DtButtonStyle.secondary,
                          onPressed: () => context.push('/deposit'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: DtButton(
                          label: 'Sell',
                          icon: Icons.north_east,
                          onPressed: () => context.push('/sell/amount'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final action in [
                ('Bank', '/banks', Icons.account_balance_outlined),
                ('Support', '/support', Icons.headset_mic_outlined),
              ])
                TextButton.icon(
                  onPressed: () => context.push(action.$2),
                  icon: Icon(action.$3, color: dtColor(context, DtColors.navy)),
                  label: Text(
                    action.$1,
                    style: TextStyle(color: dtColor(context, DtColors.navy)),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          DtCard(
            color: dtColor(context, DtColors.softBlue),
            child: DtEmptyState(
              title: 'Built around you.',
              description: 'One clear step at a time.',
              icon: Icons.bubble_chart_outlined,
            ),
          ),
        ],
        const SizedBox(height: 28),
        Text(
          'Phase 1 · Component and navigation preview\nAccount flows arrive in Phase 2.',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 12,
            color: dtColor(context, DtColors.muted),
          ),
        ),
      ],
    ),
  );
  List<Widget> _profile(BuildContext context) => [
    const DtCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('User Details', style: TextStyle(fontWeight: FontWeight.w600)),
          SizedBox(height: 8),
          Text('Name and email will appear after sign-in.'),
        ],
      ),
    ),
    const SizedBox(height: 20),
    DtCard(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        children: [
          _row(
            context,
            Icons.account_balance_outlined,
            'Bank Accounts',
            'Manage your payout methods',
            '/banks',
          ),
          _row(
            context,
            Icons.card_giftcard_outlined,
            'Referral Program',
            'Earn by inviting friends',
            '/referral',
          ),
          _row(
            context,
            Icons.settings_outlined,
            'Settings',
            'Password, security & more',
            '/settings',
          ),
        ],
      ),
    ),
    const SizedBox(height: 20),
    const DtButton(
      label: 'Logout',
      icon: Icons.logout,
      style: DtButtonStyle.danger,
    ),
    const SizedBox(height: 24),
    const Text('DT Exchange v1.0', textAlign: TextAlign.center),
  ];
  Widget _row(
    BuildContext context,
    IconData icon,
    String title,
    String subtitle,
    String route,
  ) => ListTile(
    leading: Icon(icon, color: dtColor(context, DtColors.navy)),
    title: Text(title),
    subtitle: Text(subtitle, style: const TextStyle(fontSize: 12)),
    trailing: const Icon(Icons.chevron_right, size: 20),
    onTap: () => context.push(route),
  );
}
