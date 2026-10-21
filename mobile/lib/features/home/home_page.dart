import 'package:dt_exchange/core/design/appearance.dart';
import '../manual/maintenance_gate.dart';
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/presentation/kit.dart';
import '../../core/api/api_client.dart';
import '../../preview/models.dart';
import '../../preview/preview_controller.dart';
import '../../preview/money.dart';
import '../engagement/engagement_pages.dart';
import 'home_header.dart';

class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});
  @override
  ConsumerState<HomePage> createState() => _HomeState();
}

class _HomeState extends ConsumerState<HomePage> {
  final amount = TextEditingController(text: '100');
  bool loading = true;
  DateTime? rateFetchedAt;
  Timer? timer, debounce;
  PreviewQuote? serverQuote;
  String? apiError;
  bool quoting = false;
  int generation = 0;
  Future<void> quote() async {
    if (ref.read(previewModeProvider)) return;
    final s = ref.read(previewProvider);
    if (s.banks.isEmpty) return;
    final g = ++generation;
    setState(() => quoting = true);
    try {
      final q = await ref
          .read(previewProvider.notifier)
          .quoteApi(amount.text, s.defaultBankId);
      if (mounted && g == generation) {
        setState(() {
          serverQuote = q;
          apiError = null;
        });
      }
    } catch (e) {
      if (mounted && g == generation) setState(() => apiError = apiMessage(e));
    } finally {
      if (mounted && g == generation) setState(() => quoting = false);
    }
  }

  Future<void> refresh() async {
    setState(() => loading = true);
    try {
      if (ref.read(previewModeProvider)) {
        await Future<void>.delayed(const Duration(milliseconds: 450));
        ref.read(previewProvider.notifier).refreshRate();
      } else {
        await ref.read(previewProvider.notifier).loadAccount();
        await quote();
        rateFetchedAt = ref.read(previewProvider.notifier).loadError == null
            ? DateTime.now()
            : null;
      }
    } catch (e) {
      if (mounted) setState(() => apiError = apiMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  void initState() {
    super.initState();
    if (!ref.read(previewModeProvider)) Future.microtask(refresh);
    timer = Timer(const Duration(milliseconds: 550), () {
      if (mounted) setState(() => loading = false);
    });
  }

  @override
  void dispose() {
    timer?.cancel();
    debounce?.cancel();
    amount.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(previewProvider);
    final a = PreviewMoney.parseUsdt(amount.text);
    final gross = a == null ? BigInt.zero : PreviewMoney.gross(a, s.ratePaise);
    final fee = PreviewMoney.fee(gross);
    return AppPage(
      title: 'DT Exchange',
      statusMessage:
          'The funding we provide is clean, secure, and fully guaranteed.',
      titleWidget: const HomeBrandHeader(),
      back: false,
      compactHeader: true,
      actions: [
        IconButton(
          tooltip: 'Notifications',
          onPressed: () => context.push('/notifications'),
          icon: Badge(
            isLabelVisible: s.unread > 0,
            label: Text('${s.unread}'),
            child: const Icon(Icons.notifications_none_rounded),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(right: 16),
          child: GestureDetector(
            onTap: () => context.go('/profile'),
            child: CircleAvatar(
              radius: 18,
              backgroundColor: dtColor(context, DtColors.softBlue),
              child: Text(
                s.name.substring(0, 1),
                style: TextStyle(
                  color: dtColor(context, DtColors.navy),
                  fontSize: 14,
                ),
              ),
            ),
          ),
        ),
      ],
      onRefresh: refresh,
      children: [
        if (!ref.watch(previewModeProvider) &&
            (ref
                            .watch(publicConfigurationProvider)
                            .asData
                            ?.value['config']?['announcement']
                        as String? ??
                    '')
                .isNotEmpty)
          InfoNote(
            ref
                    .watch(publicConfigurationProvider)
                    .asData!
                    .value['config']['announcement']
                as String,
          ),
        if (!ref.watch(previewModeProvider))
          ...?(ref
                      .watch(engagementData('/notifications/announcements'))
                      .asData
                      ?.value
                  is List
              ? [
                  for (final a
                      in ref
                          .watch(engagementData('/notifications/announcements'))
                          .asData!
                          .value)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: InfoNote("${a['title']} — ${a['message']}"),
                    ),
                ]
              : null),
        if (ref.read(previewProvider.notifier).loadError != null)
          InfoNote(ref.read(previewProvider.notifier).loadError!),
        DtReveal(
          child: TintedCard(
            key: const Key('home-rate-card'),
            radius: 24,
            padding: const EdgeInsets.all(16),
            accent: DtColors.aqua,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const UsdtTokenIcon(size: 26),
                    const SizedBox(width: 9),
                    Expanded(
                      child: Text(
                        'USDT / INR',
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: dtColor(context, DtColors.navy),
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: dtColor(context, DtColors.softMint),
                        borderRadius: BorderRadius.circular(7),
                      ),
                      child: Text(
                        ref.watch(previewModeProvider)
                            ? 'PREVIEW'
                            : s.ratePaise == 0
                            ? 'UNAVAILABLE'
                            : ref.read(previewProvider.notifier).sandboxRate
                            ? 'SANDBOX'
                            : 'CURRENT',
                        style: TextStyle(
                          fontSize: 9,
                          color: dtColor(context, Color(0xFF087E64)),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: loading
                          ? const DtSkeleton(height: 34)
                          : !ref.watch(previewModeProvider) && s.ratePaise == 0
                          ? Text(
                              '\u2014',
                              style: Theme.of(context).textTheme.headlineMedium,
                            )
                          : AnimatedAmount(
                              value: BigInt.from(s.ratePaise),
                              format: (v) => PreviewMoney.inr(v),
                              style: Theme.of(context).textTheme.headlineMedium,
                            ),
                    ),
                    IconButton(
                      tooltip: 'Refresh rate',
                      onPressed: refresh,
                      icon: Icon(
                        Icons.refresh,
                        size: 20,
                        color: dtColor(context, DtColors.muted),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Expanded(
                      child: ref.watch(previewModeProvider)
                          ? DtReveal(
                              child: Align(
                                alignment: Alignment.centerLeft,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 3,
                                  ),
                                  decoration: BoxDecoration(
                                    color: dtColor(context, DtColors.softMint),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Wrap(
                                    spacing: 12,
                                    runSpacing: 4,
                                    children: [
                                      Text(
                                        '+0.24%',
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: dtColor(
                                            context,
                                            Color(0xFF087E64),
                                          ),
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                      Text(
                                        '+₹0.25 (24h)',
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: dtColor(
                                            context,
                                            Color(0xFF087E64),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            )
                          : Text(
                              ref.read(previewProvider.notifier).sandboxRate
                                  ? '1 USDT · Sandbox rate'
                                  : '1 USDT · Current sell rate',
                              style: TextStyle(
                                fontSize: 11,
                                color: dtColor(context, Color(0xFF087E64)),
                              ),
                            ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                RateSparkline(
                  animate: !loading && s.ratePaise > 0,
                  preview: ref.watch(previewModeProvider),
                  valueLabel: s.ratePaise > 0
                      ? PreviewMoney.inr(BigInt.from(s.ratePaise))
                      : null,
                  height: MediaQuery.sizeOf(context).height < 780 ? 76 : 88,
                ),
                const SizedBox(height: 6),
                Text(
                  ref.watch(previewModeProvider)
                      ? 'Preview Rate · Sample visualization only'
                      : rateFetchedAt == null
                      ? 'Refresh to check the latest rate'
                      : 'Fetched ${shortDate(rateFetchedAt!)} · Decorative line',
                  style: TextStyle(
                    fontSize: 10,
                    color: dtColor(context, DtColors.muted),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        DtReveal(
          child: SurfaceCard(
            key: const Key('home-balance-card'),
            padding: const EdgeInsets.all(16),
            color: dtColor(context, DtColors.softMint),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const UsdtTokenIcon(size: 20),
                    const SizedBox(width: 8),
                    const Expanded(
                      child: Text(
                        'Your USDT balance',
                        style: TextStyle(fontSize: 13),
                      ),
                    ),
                    IconButton(
                      tooltip: s.hideBalance ? 'Show balance' : 'Hide balance',
                      visualDensity: VisualDensity.compact,
                      onPressed: () =>
                          ref.read(previewProvider.notifier).hideBalance(),
                      icon: Icon(
                        s.hideBalance
                            ? Icons.visibility_off_outlined
                            : Icons.visibility_outlined,
                        size: 18,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                if (loading)
                  const DtSkeleton(height: 44)
                else if (s.hideBalance)
                  Text(
                    '••••••',
                    style: Theme.of(context).textTheme.headlineMedium,
                  )
                else
                  Wrap(
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 8,
                    children: [
                      AnimatedAmount(
                        value: s.balance,
                        format: PreviewMoney.usdt,
                        style: Theme.of(context).textTheme.headlineMedium,
                      ),
                      Text(
                        'USDT',
                        style: TextStyle(
                          fontSize: 13,
                          color: dtColor(context, DtColors.muted),
                        ),
                      ),
                    ],
                  ),
                const SizedBox(height: 3),
                Text(
                  s.hideBalance
                      ? '≈ ₹••••••'
                      : '≈ ${PreviewMoney.inr(PreviewMoney.gross(s.balance, s.ratePaise))}',
                  style: TextStyle(
                    fontSize: 13,
                    color: dtColor(context, DtColors.muted),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: UsdtActionCard(
                        sell: false,
                        onTap: () => context.push('/deposit'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: UsdtActionCard(
                        sell: true,
                        onTap: () => context.push('/sell/amount'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            for (final x in [
              ('Deposit', Icons.south_west_rounded, '/deposit'),
              ('Sell', Icons.north_east_rounded, '/sell/amount'),
              ('Bank', Icons.account_balance_outlined, '/banks'),
              ('Support', Icons.headset_mic_outlined, '/support'),
            ])
              Expanded(
                child: Semantics(
                  button: true,
                  label: x.$1,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () => context.push(x.$3),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 5),
                      child: Column(
                        children: [
                          Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              color: dtColor(context, DtColors.white),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Icon(
                              x.$2,
                              color: dtColor(context, DtColors.navy),
                              size: 22,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            x.$1,
                            style: TextStyle(
                              fontSize: 11,
                              color: dtColor(context, DtColors.muted),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 25),
        const SectionHeading('Quick sell'),
        SurfaceCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: amount,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                onChanged: (_) {
                  generation++;
                  serverQuote = null;
                  setState(() {});
                  debounce?.cancel();
                  if (!ref.read(previewModeProvider)) {
                    debounce = Timer(const Duration(milliseconds: 600), quote);
                  }
                },
                decoration: InputDecoration(
                  errorText: apiError == null
                      ? null
                      : 'Quote unavailable. Open Sell for details.',
                  labelText: 'USDT amount',
                  prefixIcon: const Padding(
                    padding: EdgeInsets.all(12),
                    child: UsdtTokenIcon(size: 24),
                  ),
                  suffixText: 'USDT',
                ),
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w600,
                  color: dtColor(context, DtColors.navy),
                ),
              ),
              const SizedBox(height: 12),
              DetailRow(
                'Rate',
                !ref.watch(previewModeProvider) && serverQuote != null
                    ? '₹${serverQuote!.serverRate} / USDT'
                    : '${PreviewMoney.inr(BigInt.from(s.ratePaise))} / USDT',
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
              if (!ref.watch(previewModeProvider) && serverQuote == null)
                const Text(
                  'Add an approved bank account to request a quote.',
                  style: TextStyle(fontSize: 11),
                ),
              const SizedBox(height: 16),
              DtButton(
                label: 'Sell USDT',
                icon: Icons.arrow_forward_rounded,
                onPressed: () => context.push(
                  '/sell/amount?amount=${Uri.encodeComponent(amount.text)}',
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        SectionHeading(
          'Recent transactions',
          action: 'View all',
          onTap: () => context.go('/history'),
        ),
        SurfaceCard(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 5),
          child: Column(
            children: s.transactions.take(3).map(TransactionTile.new).toList(),
          ),
        ),
        const SizedBox(height: 20),
        const InfoNote(
          'Clear rates. One payout destination. Your next exchange, made simple.',
          mint: true,
          icon: Icons.verified_user_outlined,
        ),
      ],
    );
  }
}
