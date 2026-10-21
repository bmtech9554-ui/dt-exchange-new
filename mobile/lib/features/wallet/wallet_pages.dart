import 'package:dt_exchange/core/design/appearance.dart';
import '../manual/manual_pages.dart';
import 'package:flutter/material.dart';
import '../transactions/transaction_pages.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/presentation/kit.dart';
import '../../preview/preview_controller.dart';
import '../../preview/fixtures.dart';
import '../../preview/models.dart';
import '../../preview/money.dart';

class WalletPage extends ConsumerWidget {
  const WalletPage({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(previewModeProvider)) return const ApiWalletPage();
    final s = ref.watch(previewProvider);
    return AppPage(
      title: 'Wallet',
      subtitle: 'Your USDT, all in one place.',
      back: false,
      children: [
        DtReveal(
          child: SurfaceCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Total available balance'),
                const SizedBox(height: 18),
                Wrap(
                  spacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    AnimatedAmount(
                      value: s.balance,
                      format: PreviewMoney.usdt,
                      style: Theme.of(context).textTheme.displaySmall,
                    ),
                    const UsdtTokenIcon(size: 28),
                    const Text('USDT'),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  '≈ ${PreviewMoney.inr(PreviewMoney.gross(s.balance, s.ratePaise))}',
                ),
                const SizedBox(height: 26),
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
                        label: 'Sell USDT',
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
        const SizedBox(height: 24),
        const SectionHeading('Your deposit address'),
        if (ref.watch(previewModeProvider))
          const DepositAddressCard(compact: true)
        else
          const InfoNote('Deposit addresses are not available yet.'),
        const SizedBox(height: 24),
        SectionHeading(
          'Recent deposits',
          action: 'View all',
          onTap: () => context.go('/history?filter=deposits'),
        ),
        SurfaceCard(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
          child: Column(
            children: s.transactions
                .where((t) => t.kind == TransactionKind.deposit)
                .map(TransactionTile.new)
                .toList(),
          ),
        ),
        const SizedBox(height: 18),
        if (ref.watch(previewModeProvider))
          const InfoNote(
            'Pending deposit: 12 of 20 sample confirmations. Available balance changes only after a confirmed deposit.',
            icon: Icons.schedule,
          ),
      ],
    );
  }
}

class DepositAddressCard extends StatelessWidget {
  const DepositAddressCard({
    this.compact = false,
    this.address = previewDepositAddress,
    this.sandbox = true,
    this.preview = true,
    super.key,
  });
  final bool compact, sandbox, preview;
  final String address;
  @override
  Widget build(BuildContext context) => SurfaceCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const UsdtTokenIcon(size: 44),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'USDT',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: dtColor(context, DtColors.navy),
                    ),
                  ),
                  Text('TRON · TRC20', style: TextStyle(fontSize: 12)),
                  Text(
                    'Recommended network',
                    style: TextStyle(
                      fontSize: 10,
                      color: dtColor(context, Color(0xFF087E64)),
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.check_circle,
              size: 19,
              color: dtColor(context, Color(0xFF087E64)),
            ),
          ],
        ),
        const SizedBox(height: 22),
        PreviewQr(data: address, preview: preview || sandbox),
        const SizedBox(height: 20),
        Text(
          preview
              ? 'Preview deposit address'
              : sandbox
              ? 'Sandbox deposit address'
              : 'Deposit address',
          style: const TextStyle(fontSize: 12),
        ),
        const SizedBox(height: 8),
        SelectableText(
          address,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: dtColor(context, DtColors.navy),
          ),
        ),
        Align(
          alignment: Alignment.centerRight,
          child: CopyControl(value: address, label: 'Copy address'),
        ),
        InfoNote(
          preview
              ? 'Preview QR only — not a payment address. Do not send funds here.'
              : sandbox
              ? 'Sandbox only. This is not a payable blockchain address.'
              : 'Only send USDT on the selected TRC20 network.',
          icon: Icons.qr_code_2,
        ),
        if (!compact) ...[
          const SizedBox(height: 16),
          Text(
            'Only send USDT on the selected TRC20 network.',
            style: TextStyle(
              fontSize: 12,
              color: dtColor(context, DtColors.muted),
            ),
          ),
        ],
      ],
    ),
  );
}

class DepositPage extends ConsumerWidget {
  const DepositPage({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) =>
      !ref.watch(previewModeProvider)
      ? const DepositEntryPage()
      : AppPage(
          title: 'Deposit USDT',
          subtitle: 'Select the right network. Every time.',
          children: [
            const DepositAddressCard(),
            const SubmitDepositPage(embedded: true, preview: true),
            const SizedBox(height: 20),
            const SurfaceCard(
              child: Column(
                children: [
                  DetailRow('Asset', 'Tether · USDT'),
                  DetailRow('Network', 'TRON · TRC20'),
                  DetailRow('Confirmation target', '20 · sample policy'),
                ],
              ),
            ),
            const SizedBox(height: 20),
            DtButton(
              label: 'View deposit history',
              style: DtButtonStyle.secondary,
              icon: Icons.history,
              onPressed: () => context.go('/history?filter=deposits'),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => context.push('/support'),
              child: Text(
                'Need help with a deposit?',
                style: TextStyle(color: dtColor(context, DtColors.navy)),
              ),
            ),
          ],
        );
}
