import 'package:dt_exchange/core/design/appearance.dart';
import 'package:flutter/material.dart';
import '../transactions/transaction_pages.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/presentation/kit.dart';
import '../../preview/models.dart';
import '../../preview/money.dart';
import '../../preview/preview_controller.dart';
import '../sell/sell_pages.dart';

class HistoryPage extends ConsumerStatefulWidget {
  const HistoryPage({this.filter = 'all', super.key});
  final String filter;
  @override
  ConsumerState<HistoryPage> createState() => _HistoryState();
}

class _HistoryState extends ConsumerState<HistoryPage> {
  late String filter;
  final search = TextEditingController();
  @override
  void initState() {
    super.initState();
    filter = widget.filter;
  }

  @override
  void didUpdateWidget(covariant HistoryPage old) {
    super.didUpdateWidget(old);
    if (old.filter != widget.filter) filter = widget.filter;
  }

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!ref.watch(previewModeProvider)) {
      return ApiHistoryPage(filter: widget.filter);
    }
    final all = ref.watch(previewProvider).transactions;
    final list = all
        .where(
          (t) =>
              (filter == 'all' || t.kind.name == filter) &&
              (search.text.isEmpty ||
                  '${t.id} ${t.title}'.toLowerCase().contains(
                    search.text.toLowerCase(),
                  )),
        )
        .toList();
    return AppPage(
      title: 'History',
      subtitle: 'Every move, in one place.',
      back: false,
      children: [
        TextField(
          controller: search,
          onChanged: (_) => setState(() {}),
          decoration: InputDecoration(
            hintText: 'Search order ID or type',
            prefixIcon: const Icon(Icons.search_rounded),
            suffixIcon: search.text.isEmpty
                ? null
                : IconButton(
                    tooltip: 'Clear search',
                    onPressed: () {
                      search.clear();
                      setState(() {});
                    },
                    icon: const Icon(Icons.close, size: 18),
                  ),
          ),
        ),
        const SizedBox(height: 20),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final f in [
                ('all', 'All'),
                ('deposit', 'Deposits'),
                ('sell', 'Sell Orders'),
                ('payout', 'Payouts'),
              ])
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(f.$2),
                    selected: filter == f.$1,
                    onSelected: (_) => setState(() => filter = f.$1),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 22),
        SectionHeading(
          '${list.length} transaction${list.length == 1 ? '' : 's'}',
        ),
        if (list.isEmpty)
          SurfaceCard(
            child: Column(
              children: [
                Icon(
                  Icons.search_off_rounded,
                  size: 40,
                  color: dtColor(context, DtColors.muted),
                ),
                SizedBox(height: 12),
                Text('No matching transactions'),
                SizedBox(height: 8),
                Text(
                  'Try another filter or order ID.',
                  style: TextStyle(fontSize: 13),
                ),
              ],
            ),
          )
        else
          DtReveal(
            child: SurfaceCard(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
              child: Column(
                children: [
                  for (var i = 0; i < list.length; i++) ...[
                    TransactionTile(list[i]),
                    if (i < list.length - 1)
                      Divider(
                        color: dtColor(context, DtColors.border),
                        height: 1,
                      ),
                  ],
                ],
              ),
            ),
          ),
        const SizedBox(height: 24),
        const InfoNote(
          'Amounts and references shown here are sample records for the UI preview.',
        ),
      ],
    );
  }
}

class TransactionDetailsPage extends ConsumerWidget {
  const TransactionDetailsPage({required this.id, super.key});
  final String id;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(previewModeProvider)) return ApiDepositDetailsPage(id: id);
    final s = ref.watch(previewProvider);
    PreviewTransaction? tx;
    for (final t in s.transactions) {
      if (t.id == id) {
        tx = t;
        break;
      }
    }
    if (tx == null) {
      return const AppPage(
        title: 'Transaction',
        children: [
          InfoNote(
            'This preview transaction is unavailable. Return to History to choose another.',
          ),
        ],
      );
    }
    final t = tx;
    final q = t.quote;
    final completed = t.status == TransactionState.completed;
    return AppPage(
      title: 'Transaction details',
      children: [
        DtReveal(
          child: SurfaceCard(
            child: Column(
              children: [
                if (completed)
                  const SuccessMark(size: 72)
                else
                  const Icon(
                    Icons.schedule_rounded,
                    size: 54,
                    color: DtColors.teal,
                  ),
                const SizedBox(height: 16),
                Text(t.title, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 12),
                Text(
                  t.kind == TransactionKind.payout
                      ? PreviewMoney.inr(t.inrPaise)
                      : '${PreviewMoney.usdt(t.amount)} USDT',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 8),
                Text(
                  completed ? 'Completed' : t.status.name.toUpperCase(),
                  style: TextStyle(
                    color: dtColor(context, Color(0xFF087E64)),
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 8),
                Text(shortDate(t.date), style: const TextStyle(fontSize: 12)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),
        const SectionHeading('Transaction summary'),
        SurfaceCard(
          child: Column(
            children: [
              DetailRow('Order ID', t.id),
              DetailRow('Date', '${shortDate(t.date)} · ${t.date.year}'),
              DetailRow('USDT', PreviewMoney.usdt(t.amount)),
              DetailRow('Network', 'TRON · TRC20'),
              if (q != null) ...[
                DetailRow(
                  'Accepted rate',
                  '${PreviewMoney.inr(BigInt.from(q.ratePaise))} / USDT',
                ),
                DetailRow('Fee · 0.50%', PreviewMoney.inr(q.fee)),
              ],
              DetailRow(
                t.kind == TransactionKind.deposit
                    ? 'INR equivalent'
                    : 'INR received',
                PreviewMoney.inr(t.inrPaise),
                strong: true,
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        const SectionHeading('Tracking & references'),
        SurfaceCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              DetailRow('TxID', t.stage >= 1 ? t.txId : 'Awaiting detection'),
              if (t.stage >= 1)
                Align(
                  alignment: Alignment.centerRight,
                  child: CopyControl(value: t.txId, label: 'Copy TxID'),
                ),
              DetailRow(
                'Confirmations',
                t.stage >= 3
                    ? '20 / 20'
                    : t.stage == 2
                    ? '12 / 20'
                    : '0 / 20',
              ),
              if (q != null) ...[
                DetailRow('Payout bank', q.bank.name),
                DetailRow('Account', '•••• ${q.bank.last4}'),
                DetailRow('IFSC', q.bank.ifsc),
              ],
              if (t.kind != TransactionKind.deposit)
                DetailRow(
                  'UTR / payout reference',
                  completed ? t.utr : 'Awaiting payout',
                ),
              if (completed && t.kind != TransactionKind.deposit)
                Align(
                  alignment: Alignment.centerRight,
                  child: CopyControl(value: t.utr, label: 'Copy UTR'),
                ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        const SectionHeading('Status timeline'),
        SurfaceCard(
          child: t.kind == TransactionKind.deposit
              ? _DepositTimeline(t)
              : TransactionTimeline(stage: t.stage),
        ),
        if (!completed && t.kind == TransactionKind.sell) ...[
          const SizedBox(height: 20),
          DtButton(
            label: 'Track order',
            onPressed: () => context.push('/sell/track/$id'),
          ),
        ],
        const SizedBox(height: 20),
        DtButton(
          label: 'Get help with this transaction',
          style: DtButtonStyle.secondary,
          icon: Icons.headset_mic_outlined,
          onPressed: () =>
              context.push('/support/new?order=${Uri.encodeComponent(id)}'),
        ),
      ],
    );
  }
}

class _DepositTimeline extends StatelessWidget {
  const _DepositTimeline(this.tx);
  final PreviewTransaction tx;
  @override
  Widget build(BuildContext context) => Column(
    children: [
      for (final row in [
        ('USDT Detected', 1),
        ('Blockchain Confirmations', 2),
        ('USDT Received', 3),
      ])
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: Icon(
            tx.stage >= row.$2
                ? Icons.check_circle_rounded
                : Icons.radio_button_unchecked,
            color: tx.stage >= row.$2
                ? DtColors.emerald
                : dtColor(context, DtColors.border),
          ),
          title: Text(row.$1, style: const TextStyle(fontSize: 13)),
          subtitle: row.$2 == 2 && tx.stage == 2
              ? const Text(
                  '12 of 20 · Sample progress',
                  style: TextStyle(fontSize: 11),
                )
              : null,
        ),
    ],
  );
}
