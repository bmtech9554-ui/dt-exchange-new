import 'package:dt_exchange/core/design/appearance.dart';
import '../manual/manual_pages.dart';
import 'dart:async';
import '../transactions/transaction_pages.dart';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/presentation/kit.dart';
import '../../core/api/api_client.dart';
import '../../preview/preview_controller.dart';
import '../../preview/models.dart';
import '../../preview/money.dart';
import '../../features/wallet/wallet_pages.dart';

const sellSteps = ['Amount', 'Confirm', 'Send', 'Track'];
const timelineLabels = [
  'Waiting for USDT',
  'USDT Detected',
  'Blockchain Confirmations',
  'USDT Received',
  'INR Payout Processing',
  'INR Sent',
  'Completed',
];

class SellAmountPage extends ConsumerStatefulWidget {
  const SellAmountPage({this.initial = '', super.key});
  final String initial;
  @override
  ConsumerState<SellAmountPage> createState() => _AmountState();
}

class _AmountState extends ConsumerState<SellAmountPage> {
  late final TextEditingController amount;
  FundingMode mode = FundingMode.wallet;
  String? bankId, error;
  bool quoting = false;
  PreviewQuote? serverQuote;
  Timer? debounce;
  int quoteGeneration = 0;
  Future<void> requestQuote() async {
    if (ref.read(previewModeProvider)) return;
    final generation = ++quoteGeneration;
    setState(() => quoting = true);
    try {
      final q = await ref
          .read(previewProvider.notifier)
          .quoteApi(
            amount.text,
            bankId ?? ref.read(previewProvider).defaultBankId,
            mode: mode,
          );
      if (mounted && generation == quoteGeneration) {
        setState(() {
          serverQuote = q;
          error = null;
        });
      }
    } catch (e) {
      if (mounted && generation == quoteGeneration) {
        setState(() => error = apiMessage(e));
      }
    } finally {
      if (mounted && generation == quoteGeneration) {
        setState(() => quoting = false);
      }
    }
  }

  void changed() {
    if (!ref.read(previewModeProvider)) {
      quoteGeneration++;
      serverQuote = null;
      debounce?.cancel();
      debounce = Timer(const Duration(milliseconds: 600), requestQuote);
    }
    setState(() => error = null);
  }

  @override
  void initState() {
    super.initState();
    if (!ref.read(previewModeProvider)) mode = FundingMode.onchain;
    amount = TextEditingController(
      text: widget.initial.isEmpty ? '250' : widget.initial,
    );
    if (!ref.read(previewModeProvider)) Future.microtask(loadSell);
  }

  Future<void> loadSell() async {
    try {
      await ref.read(previewProvider.notifier).loadWalletApi();
      if (!mounted) return;
      await ref.read(previewProvider.notifier).loadBanks();
      if (!mounted) return;
      final configuration = await ref.read(manualConfigurationProvider.future);
      if (!mounted) return;
      if (configuration['manualDepositReview'] == true) {
        setState(() => mode = FundingMode.wallet);
      }
      await requestQuote();
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    }
  }

  @override
  void dispose() {
    debounce?.cancel();
    amount.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(previewProvider);
    final value = PreviewMoney.parseUsdt(amount.text);
    final gross = value == null
        ? BigInt.zero
        : PreviewMoney.gross(value, s.ratePaise);
    final fee = PreviewMoney.fee(gross);
    return AppPage(
      title: 'Sell USDT',
      children: [
        DtStepProgress(labels: sellSteps, activeStep: 0),
        const SizedBox(height: 28),
        Text(
          'How much would\nyou like to sell?',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 22),
        SurfaceCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (ref.watch(previewModeProvider) ||
                  ref
                          .watch(manualConfigurationProvider)
                          .value?['manualDepositReview'] !=
                      true)
                SegmentedButton<FundingMode>(
                  segments: const [
                    ButtonSegment(
                      value: FundingMode.wallet,
                      label: Text('Wallet balance'),
                    ),
                    ButtonSegment(
                      value: FundingMode.onchain,
                      label: Text('Send USDT'),
                    ),
                  ],
                  selected: {mode},
                  onSelectionChanged: (v) {
                    mode = v.first;
                    changed();
                  },
                ),
              const SizedBox(height: 22),
              TextField(
                controller: amount,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                onChanged: (_) => changed(),
                style: TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.w600,
                  color: dtColor(context, DtColors.navy),
                ),
                decoration: InputDecoration(
                  labelText: 'Amount',
                  suffixText: 'USDT',
                  prefixIcon: Padding(
                    padding: EdgeInsets.all(12),
                    child: UsdtTokenIcon(size: 24),
                  ),
                  errorText: error,
                  errorMaxLines: 3,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'Available: ${PreviewMoney.usdt(s.balance)} USDT',
                style: const TextStyle(fontSize: 11),
              ),
              const SizedBox(height: 16),
              if (ref.watch(previewModeProvider) || mode == FundingMode.wallet)
                Wrap(
                  spacing: 8,
                  children: [
                    for (final p in [25, 50, 75, 100])
                      ActionChip(
                        label: Text(p == 100 ? 'MAX' : '$p%'),
                        onPressed: () {
                          amount.text = PreviewMoney.usdt(
                            s.balance * BigInt.from(p) ~/ BigInt.from(100),
                          );
                          changed();
                        },
                      ),
                  ],
                ),
              const SizedBox(height: 15),
              DetailRow(
                'Exchange rate',
                ref.watch(previewModeProvider)
                    ? '${PreviewMoney.inr(BigInt.from(s.ratePaise))} / USDT'
                    : serverQuote == null
                    ? '—'
                    : '₹${serverQuote!.serverRate} / USDT',
              ),
              DetailRow(
                ref.watch(previewModeProvider) ? 'Fee · 0.50%' : 'Fee',
                ref.watch(previewModeProvider)
                    ? PreviewMoney.inr(fee)
                    : serverQuote == null
                    ? '—'
                    : PreviewMoney.inr(serverQuote!.fee),
              ),
              if (quoting) const DtSkeleton(height: 22),
              if (serverQuote != null)
                DetailRow(
                  'Quote expires',
                  serverQuote!.expiresAt.toLocal().toString().substring(11, 19),
                ),
              Divider(color: dtColor(context, DtColors.border), height: 24),
              DetailRow(
                'You receive',
                ref.watch(previewModeProvider)
                    ? PreviewMoney.inr(gross - fee)
                    : serverQuote == null
                    ? '—'
                    : PreviewMoney.inr(serverQuote!.net),
                strong: true,
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        const SectionHeading('Receive INR in'),
        SurfaceCard(
          child: RadioGroup<String>(
            groupValue: bankId ?? s.defaultBankId,
            onChanged: (v) {
              bankId = v;
              changed();
            },
            child: Column(
              children: [
                for (final bank in s.banks)
                  RadioListTile<String>(
                    contentPadding: EdgeInsets.zero,
                    value: bank.id,
                    title: Text(
                      bank.name,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    subtitle: Text(
                      '•••• ${bank.last4}',
                      style: const TextStyle(fontSize: 12),
                    ),
                  ),
                TextButton.icon(
                  onPressed: () async {
                    await context.push('/banks/add');
                    if (!mounted || ref.read(previewModeProvider)) return;
                    await loadSell();
                  },
                  icon: const Icon(Icons.add, size: 18),
                  label: Text(
                    'Add bank account',
                    style: TextStyle(color: dtColor(context, DtColors.navy)),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),
        DtButton(
          label: 'Continue',
          loading: quoting,
          icon: Icons.arrow_forward,
          onPressed: () async {
            if (!ref.read(previewModeProvider)) {
              debounce?.cancel();
              await requestQuote();
              if (context.mounted && serverQuote != null && error == null) {
                context.push('/sell/confirm');
              }
              return;
            }
            try {
              ref
                  .read(previewProvider.notifier)
                  .makeQuote(amount.text, mode, bankId ?? s.defaultBankId);
              context.push('/sell/confirm');
            } on StateError catch (e) {
              setState(() => error = e.message);
              toast(context, e.message);
            }
          },
        ),
        const SizedBox(height: 15),
        Text(
          ref.watch(previewModeProvider)
              ? 'Preview limits: 10 – 10,000 USDT'
              : 'Limits and fees are validated by DT Exchange.',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 11,
            color: dtColor(context, DtColors.muted),
          ),
        ),
      ],
    );
  }
}

class SellConfirmPage extends ConsumerStatefulWidget {
  const SellConfirmPage({super.key});
  @override
  ConsumerState<SellConfirmPage> createState() => _ConfirmState();
}

class _ConfirmState extends ConsumerState<SellConfirmPage> {
  Timer? timer;
  bool busy = false;
  String? orderKey;
  @override
  void initState() {
    super.initState();
    timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final q = ref.watch(previewProvider).quote;
    if (q == null) return const MissingSellPage();
    final remaining = q.expiresAt
        .difference(DateTime.now())
        .inSeconds
        .clamp(0, 90);
    return AppPage(
      title: 'Confirm sell',
      children: [
        DtStepProgress(labels: sellSteps, activeStep: 1),
        const SizedBox(height: 28),
        Text(
          'Everything, at a glance.',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 20),
        SurfaceCard(
          color: dtColor(context, DtColors.softMint),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('You receive'),
              const SizedBox(height: 12),
              AnimatedAmount(
                value: q.net,
                format: (v) => PreviewMoney.inr(v),
                style: Theme.of(context).textTheme.displaySmall,
              ),
              const SizedBox(height: 8),
              Text('For ${PreviewMoney.usdt(q.amount)} USDT'),
            ],
          ),
        ),
        const SizedBox(height: 20),
        SurfaceCard(
          child: Column(
            children: [
              DetailRow('USDT amount', '${PreviewMoney.usdt(q.amount)} USDT'),
              DetailRow(
                'Accepted rate',
                q.serverRate == null
                    ? '${PreviewMoney.inr(BigInt.from(q.ratePaise))} / USDT'
                    : '₹${q.serverRate} / USDT',
              ),
              DetailRow('Gross amount', PreviewMoney.inr(q.gross)),
              DetailRow(
                q.serverNet == null ? 'Fee · 0.50%' : 'Fee',
                PreviewMoney.inr(q.fee),
              ),
              Divider(color: dtColor(context, DtColors.border), height: 24),
              DetailRow('Final INR', PreviewMoney.inr(q.net), strong: true),
              const SizedBox(height: 12),
              BankSummary(q.bank),
              DetailRow(
                'Funding method',
                q.mode == FundingMode.wallet
                    ? 'Wallet balance'
                    : 'Send on TRC20',
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        InfoNote(
          remaining == 0
              ? 'This quote expired. Refresh it before continuing.'
              : 'Quote valid for ${remaining}s. The accepted rate stays fixed after confirmation.',
          icon: Icons.schedule,
        ),
        if (!ref.watch(previewModeProvider))
          const InfoNote(
            'Withdrawals are processed within 24 hours. Ensure your bank details are correct.',
          ),
        const SizedBox(height: 22),
        DtButton(
          label: remaining == 0 ? 'Refresh quote' : 'Confirm Sell',
          loading: busy,
          icon: Icons.check_rounded,
          onPressed: busy
              ? null
              : () async {
                  if (remaining == 0) {
                    context.go(
                      '/sell/amount?amount=${PreviewMoney.usdt(q.amount)}',
                    );
                    return;
                  }
                  setState(() => busy = true);
                  try {
                    String id;
                    if (ref.read(previewModeProvider)) {
                      id = ref.read(previewProvider.notifier).confirmQuote();
                    } else {
                      orderKey ??= requestKey();
                      final result = await ref
                          .read(apiSessionProvider)
                          .request(
                            '/sell/orders',
                            method: 'POST',
                            idempotencyKey: orderKey,
                            data: {'quoteId': q.id, 'bankAccountId': q.bank.id},
                          );
                      id = result['orderId'];
                    }
                    if (context.mounted) context.go('/sell/send/$id');
                  } catch (e) {
                    if (context.mounted) {
                      toast(
                        context,
                        e is StateError ? e.message : apiMessage(e),
                      );
                    }
                  } finally {
                    if (mounted) setState(() => busy = false);
                  }
                },
        ),
        const SizedBox(height: 14),
        if (ref.watch(previewModeProvider))
          Text(
            'This is a simulated sale. No funds are transferred.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 11,
              color: dtColor(context, DtColors.muted),
            ),
          ),
      ],
    );
  }
}

class SellSendPage extends ConsumerWidget {
  const SellSendPage({required this.id, super.key});
  final String id;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(previewModeProvider)) {
      return ApiOrderPage(id: id, send: true);
    }
    ref.watch(previewProvider);
    final tx = ref.read(previewProvider.notifier).findTransaction(id);
    if (tx == null) return const MissingSellPage();
    final wallet = tx.quote!.mode == FundingMode.wallet;
    return AppPage(
      title: wallet ? 'Using wallet balance' : 'Send USDT',
      children: [
        DtStepProgress(labels: sellSteps, activeStep: 2),
        const SizedBox(height: 28),
        if (wallet) ...[
          const Center(child: SuccessMark()),
          const SizedBox(height: 24),
          Text(
            'Your USDT is reserved.',
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: 12),
          const Text(
            'Your available balance is used for this preview order. No second deposit is needed.',
          ),
          const SizedBox(height: 24),
          SurfaceCard(
            child: Column(
              children: [
                DetailRow('Reserved', '${PreviewMoney.usdt(tx.amount)} USDT'),
                DetailRow(
                  'You receive',
                  PreviewMoney.inr(tx.inrPaise),
                  strong: true,
                ),
                BankSummary(tx.quote!.bank),
              ],
            ),
          ),
        ] else ...[
          Text(
            'Send exactly\n${PreviewMoney.usdt(tx.amount)} USDT',
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: 12),
          const Text('Network: TRON · TRC20'),
          const SizedBox(height: 20),
          const DepositAddressCard(),
          const SizedBox(height: 16),
          DetailRow('Order ID', id),
        ],
        const SizedBox(height: 24),
        DtButton(
          label: wallet ? 'Track payout' : 'I Have Sent the USDT',
          icon: Icons.arrow_forward_rounded,
          onPressed: () => context.go('/sell/track/$id'),
        ),
        const SizedBox(height: 16),
        const InfoNote(
          'The tracking preview waits for simulated confirmation events. This button alone never confirms receipt.',
        ),
      ],
    );
  }
}

class SellTrackPage extends ConsumerStatefulWidget {
  const SellTrackPage({required this.id, super.key});
  final String id;
  @override
  ConsumerState<SellTrackPage> createState() => _TrackState();
}

class _TrackState extends ConsumerState<SellTrackPage> {
  bool started = false;
  @override
  Widget build(BuildContext context) {
    if (!ref.watch(previewModeProvider)) return ApiOrderPage(id: widget.id);
    ref.watch(previewProvider);
    final tx = ref.read(previewProvider.notifier).findTransaction(widget.id);
    if (tx == null) return const MissingSellPage();
    final done = tx.stage == 6;
    return AppPage(
      title: done ? 'Transaction successful' : 'Track your exchange',
      children: [
        DtStepProgress(labels: sellSteps, activeStep: 3),
        const SizedBox(height: 26),
        Center(
          child: AnimatedSwitcher(
            duration: MediaQuery.disableAnimationsOf(context)
                ? Duration.zero
                : DtMotion.reveal,
            child: done
                ? const SuccessMark(key: ValueKey('success'))
                : Container(
                    key: const ValueKey('waiting'),
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: dtColor(context, DtColors.softBlue),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.sync_rounded,
                      size: 36,
                      color: DtColors.blue,
                    ),
                  ),
          ),
        ),
        const SizedBox(height: 22),
        Text(
          done ? 'Exchange complete.' : 'Every step, in view.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 10),
        Text(
          done
              ? 'Preview transaction completed. No real payout occurred.'
              : '${PreviewMoney.usdt(tx.amount)} USDT to ${PreviewMoney.inr(tx.inrPaise)}',
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 24),
        SurfaceCard(child: TransactionTimeline(stage: tx.stage)),
        const SizedBox(height: 20),
        SurfaceCard(
          child: Column(
            children: [
              DetailRow('Order ID', tx.id),
              DetailRow('USDT sold', '${PreviewMoney.usdt(tx.amount)} USDT'),
              DetailRow(
                'INR receivable',
                PreviewMoney.inr(tx.inrPaise),
                strong: true,
              ),
              BankSummary(tx.quote!.bank),
              if (done) DetailRow('Preview UTR', tx.utr),
            ],
          ),
        ),
        const SizedBox(height: 24),
        if (!done)
          DtButton(
            label: started
                ? 'Simulating confirmations…'
                : 'Simulate blockchain & payout',
            onPressed: started
                ? null
                : () {
                    setState(() => started = true);
                    ref.read(previewProvider.notifier).simulate(tx.id);
                  },
            icon: Icons.play_arrow_rounded,
          )
        else
          DtButton(
            label: 'View transaction',
            icon: Icons.receipt_long_outlined,
            onPressed: () => context.push('/history/${tx.id}'),
          ),
        const SizedBox(height: 12),
        DtButton(
          label: 'Back to Home',
          style: DtButtonStyle.secondary,
          onPressed: () => context.go('/home'),
        ),
      ],
    );
  }
}

class TransactionTimeline extends StatelessWidget {
  const TransactionTimeline({
    required this.stage,
    this.payoutPending = false,
    super.key,
  });
  final bool payoutPending;
  final int stage;
  @override
  Widget build(BuildContext context) => Column(
    children: List.generate(
      timelineLabels.length,
      (i) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AnimatedContainer(
              duration: MediaQuery.disableAnimationsOf(context)
                  ? Duration.zero
                  : DtMotion.standard,
              width: 27,
              height: 27,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: i <= stage
                    ? dtColor(context, DtColors.softMint)
                    : dtColor(context, DtColors.background),
                border: Border.all(
                  color: i == stage ? DtColors.teal : Colors.transparent,
                ),
              ),
              child: Icon(
                i < stage || stage == 6
                    ? Icons.check_rounded
                    : i == stage
                    ? Icons.more_horiz
                    : Icons.circle_outlined,
                size: 16,
                color: i <= stage
                    ? dtColor(context, const Color(0xFF087E64))
                    : dtColor(context, DtColors.muted),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  payoutPending && i == 4
                      ? 'Ready for payout · pending'
                      : timelineLabels[i],
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: i == stage ? FontWeight.w600 : FontWeight.w400,
                    color: i <= stage
                        ? dtColor(context, DtColors.navy)
                        : dtColor(context, DtColors.muted),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class MissingSellPage extends StatelessWidget {
  const MissingSellPage({super.key});
  @override
  Widget build(BuildContext context) => AppPage(
    title: 'Start a new exchange',
    children: [
      const SurfaceCard(
        child: DtEmptyState(
          title: 'No active order',
          description: 'Create a new preview quote to continue.',
        ),
      ),
      const SizedBox(height: 22),
      DtButton(
        label: 'Enter amount',
        onPressed: () => context.go('/sell/amount'),
      ),
    ],
  );
}
