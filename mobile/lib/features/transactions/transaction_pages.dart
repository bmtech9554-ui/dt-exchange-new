import '../manual/manual_pages.dart';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/presentation/kit.dart';
import '../../preview/preview_controller.dart';
import '../../preview/money.dart';
import '../sell/sell_pages.dart';
import '../wallet/wallet_pages.dart';

String tokenText(dynamic value) {
  final s = value?.toString() ?? '0';
  return s.contains('.') ? s.replaceFirst(RegExp(r'\.?0+$'), '') : s;
}

BigInt tokenUnits(dynamic value) {
  final p = value.toString().split('.');
  return BigInt.parse(p[0]) * BigInt.from(1000000) +
      BigInt.parse((p.length > 1 ? p[1] : '').padRight(6, '0').substring(0, 6));
}

String inrMinor(dynamic value) =>
    PreviewMoney.inr(BigInt.parse(value.toString()));
String statusText(String s) => switch (s) {
  'READY_FOR_PAYOUT' => 'Ready for payout · payout pending',
  'MANUAL_REVIEW' => 'Manual review required',
  'AWAITING_DEPOSIT' => 'Waiting for USDT',
  'DEPOSIT_DETECTED' => 'USDT detected',
  'BLOCKCHAIN_CONFIRMING' => 'Blockchain confirmations',
  'DEPOSIT_CONFIRMED' => 'USDT received',
  'PAYOUT_PROCESSING' => 'INR Payout Processing',
  'COMPLETED' => 'Transaction Successful',
  _ => s.replaceAll('_', ' '),
};

class ApiAddressCard extends StatelessWidget {
  const ApiAddressCard({
    required this.address,
    required this.sandbox,
    super.key,
  });
  final String address;
  final bool sandbox;
  @override
  Widget build(BuildContext context) =>
      DepositAddressCard(address: address, sandbox: sandbox, preview: false);
}

class ApiOrderPage extends ConsumerStatefulWidget {
  const ApiOrderPage({required this.id, this.send = false, super.key});
  final String id;
  final bool send;
  @override
  ConsumerState<ApiOrderPage> createState() => _ApiOrderState();
}

class _ApiOrderState extends ConsumerState<ApiOrderPage>
    with WidgetsBindingObserver {
  Map<String, dynamic>? order;
  String? error;
  Timer? timer;
  bool loading = false, foreground = true;
  static const terminal = {
    'READY_FOR_PAYOUT',
    'MANUAL_REVIEW',
    'EXPIRED',
    'CANCELLED',
    'FAILED',
    'COMPLETED',
  };
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    Future.microtask(load);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState s) {
    foreground = s == AppLifecycleState.resumed;
    timer?.cancel();
    if (foreground) load();
  }

  @override
  void dispose() {
    timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> load() async {
    if (loading || !mounted || !foreground) return;
    loading = true;
    timer?.cancel();
    try {
      final r = Map<String, dynamic>.from(
        await ref.read(apiSessionProvider).request('/sell/orders/${widget.id}'),
      );
      if (mounted) {
        setState(() {
          order = r;
          error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    } finally {
      loading = false;
      if (mounted &&
          foreground &&
          (!terminal.contains(order?['status']) ||
              order?['status'] == 'READY_FOR_PAYOUT' &&
                  order?['payoutsEnabled'] == true)) {
        timer = Timer(const Duration(seconds: 8), load);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final o = order;
    if (o == null) {
      return AppPage(
        title: widget.send ? 'Send USDT' : 'Track your exchange',
        children: [
          if (error == null)
            const DtSkeleton(height: 240)
          else
            InfoNote(error!),
          DtButton(label: 'Refresh', onPressed: load),
        ],
      );
    }
    final status = o['status'] as String,
        stage = switch (status) {
          'DEPOSIT_DETECTED' => 1,
          'BLOCKCHAIN_CONFIRMING' => 2,
          'DEPOSIT_CONFIRMED' => 3,
          'READY_FOR_PAYOUT' => 4,
          'PAYOUT_PROCESSING' => 4,
          'COMPLETED' => 6,
          _ => 0,
        };
    final showSend =
        widget.send &&
        status == 'AWAITING_DEPOSIT' &&
        o['depositAddress'] != null &&
        DateTime.parse(o['expiresAt']).isAfter(DateTime.now());
    final bank = ref
        .watch(previewProvider)
        .banks
        .where((b) => b.id == o['bankAccountId'])
        .firstOrNull;
    return AppPage(
      title: showSend
          ? 'Send USDT'
          : status == 'COMPLETED'
          ? 'Transaction Successful'
          : 'Track your exchange',
      children: [
        DtStepProgress(labels: sellSteps, activeStep: showSend ? 2 : 3),
        const SizedBox(height: 26),
        if (error != null) InfoNote(error!),
        if (o['sandbox'] == true)
          const InfoNote('Sandbox network · no real USDT or INR transfer.'),
        if (showSend) ...[
          Text(
            'Send exactly\n${tokenText(o['amountUsdt'])} USDT',
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: 20),
          ApiAddressCard(
            address: o['depositAddress'],
            sandbox: o['sandbox'] == true,
          ),
          DetailRow('Network', 'TRC20'),
          DetailRow(
            'Deposit deadline',
            DateTime.parse(o['expiresAt']).toLocal().toString(),
          ),
        ] else ...[
          Center(
            child: AnimatedSwitcher(
              duration: DtMotion.reveal,
              child: status == 'COMPLETED'
                  ? const SuccessMark(key: ValueKey('success'))
                  : Icon(
                      status == 'READY_FOR_PAYOUT'
                          ? Icons.task_alt
                          : Icons.sync_rounded,
                      key: ValueKey(status),
                      size: 56,
                      color: DtColors.teal,
                    ),
            ),
          ),
          const SizedBox(height: 20),
          Text(
            statusText(status),
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: 22),
          SurfaceCard(
            child: TransactionTimeline(
              stage: stage,
              payoutPending: status == 'READY_FOR_PAYOUT',
            ),
          ),
          if (status == 'READY_FOR_PAYOUT')
            const InfoNote(
              'USDT is confirmed. Your INR payout is pending. No INR has been sent.',
            ),
        ],
        if (o['payout']?['status'] == 'MANUAL_REVIEW' ||
            o['payout']?['status'] == 'REVERSED')
          const InfoNote(
            'Your payout requires review. Please contact support for an update.',
          ),
        if (o['walletRefunded'] == true)
          const InfoNote(
            'No INR was sent. The original USDT and sell fees have been restored to your wallet.',
          ),
        if (o['payout']?['receiptId'] != null)
          PrivateReceiptButton(id: o['payout']['receiptId']),
        if (o['payout']?['paidAt'] != null)
          DetailRow(
            'Payment date',
            DateTime.parse(o['payout']['paidAt']).toLocal().toString(),
          ),
        if (o['payout']?['sandbox'] == true)
          const InfoNote('Sandbox payout · no real INR was sent.'),
        const SizedBox(height: 20),
        SurfaceCard(
          child: Column(
            children: [
              if (o['payout']?['utr'] != null)
                DetailRow('UTR', o['payout']['utr']),
              if (o['payout']?['payoutReference'] != null)
                DetailRow('Payout reference', o['payout']['payoutReference']),
              if (o['payout']?['completedAt'] != null)
                DetailRow(
                  'Completion time',
                  DateTime.parse(
                    o['payout']['completedAt'],
                  ).toLocal().toString(),
                ),
              DetailRow('Order ID', o['orderNumber']),
              if (bank != null) BankSummary(bank),
              DetailRow(
                'Created',
                DateTime.parse(o['createdAt']).toLocal().toString(),
              ),
              DetailRow('USDT amount', tokenText(o['amountUsdt'])),
              DetailRow('Locked rate', '₹${o['exchangeRate']}'),
              DetailRow('Fee', inrMinor(o['feeInrMinor'])),
              DetailRow(
                status == 'COMPLETED' ? 'INR received' : 'INR receivable',
                inrMinor(o['finalInrMinor']),
                strong: true,
              ),
              DetailRow(
                'Confirmations',
                '${o['confirmations']} / ${o['requiredConfirmations']}',
              ),
              if (o['txHash'] != null) ...[
                const SizedBox(height: 8),
                SelectableText(
                  o['txHash'],
                  style: const TextStyle(fontSize: 11),
                ),
                CopyControl(value: o['txHash'], label: 'Copy TxID'),
              ],
            ],
          ),
        ),
        const SizedBox(height: 22),
        if (status == 'COMPLETED') ...[
          DtButton(
            label: 'View Transaction',
            onPressed: () => context.push('/history/${widget.id}'),
          ),
          const SizedBox(height: 12),
        ],
        DtButton(
          label: showSend
              ? 'I Have Sent the USDT'
              : widget.send
              ? 'View progress'
              : 'Refresh status',
          onPressed: () async {
            await load();
            if (context.mounted && widget.send) {
              context.go('/sell/track/${widget.id}');
            }
          },
        ),
        const SizedBox(height: 12),
        const InfoNote(
          'Receipt is verified from blockchain data. Refreshing never confirms a payment.',
        ),
        TextButton(
          onPressed: () => context.go('/home'),
          child: const Text('Back to Home'),
        ),
      ],
    );
  }
}

class ApiWalletPage extends ConsumerStatefulWidget {
  const ApiWalletPage({this.depositOnly = false, super.key});
  final bool depositOnly;
  @override
  ConsumerState<ApiWalletPage> createState() => _ApiWalletState();
}

class _ApiWalletState extends ConsumerState<ApiWalletPage> {
  Map<String, dynamic>? wallet, address;
  List<dynamic> deposits = [];
  String? error;
  bool busy = false;
  @override
  void initState() {
    super.initState();
    Future.microtask(load);
  }

  Future<void> load() async {
    if (busy) return;
    setState(() => busy = true);
    try {
      final api = ref.read(apiSessionProvider),
          w = Map<String, dynamic>.from(await api.request('/wallet'));
      ref.read(previewProvider.notifier).updateWalletSnapshot(w);
      final h = await api.request('/history?type=deposits&limit=5');
      if (mounted) {
        setState(() {
          wallet = w;
          deposits = h['items'];
          error = null;
        });
      }
      if (widget.depositOnly) await addressLoad();
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> addressLoad() async {
    try {
      final c = await ref.read(manualConfigurationProvider.future);
      if (c['manualDepositReview'] == true) {
        if (mounted) {
          context.push('/deposit');
        }
        return;
      }
      final a = Map<String, dynamic>.from(
        await ref
            .read(apiSessionProvider)
            .request('/wallet/deposit-address', method: 'POST', data: {}),
      );
      if (mounted) setState(() => address = a);
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(previewProvider);
    return AppPage(
      title: widget.depositOnly ? 'Deposit USDT' : 'Wallet',
      subtitle: widget.depositOnly
          ? 'Select the right network. Every time.'
          : 'Your USDT, all in one place.',
      back: widget.depositOnly,
      children: [
        if (error != null) InfoNote(error!),
        if (busy && wallet == null) const DtSkeleton(height: 220),
        if (!widget.depositOnly && wallet != null) ...[
          if (wallet!['sandbox'] == true)
            const InfoNote('Sandbox wallet · development funds only.'),
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
                        value: tokenUnits(wallet!['availableUsdt']),
                        format: PreviewMoney.usdt,
                        style: Theme.of(context).textTheme.displaySmall,
                      ),
                      const UsdtTokenIcon(size: 28),
                      const Text('USDT'),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '≈ ${PreviewMoney.inr(PreviewMoney.gross(tokenUnits(wallet!['availableUsdt']), s.ratePaise))}',
                  ),
                  DetailRow(
                    'Reserved USDT',
                    tokenText(wallet!['reservedUsdt']),
                  ),
                  DetailRow('Pending INR payout', '₹${wallet!['pendingInr']}'),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(
                        child: DtButton(
                          label: 'Deposit',
                          style: DtButtonStyle.secondary,
                          onPressed: () => context.push('/deposit'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: DtButton(
                          label: 'Sell USDT',
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
        ],
        if (address != null)
          ApiAddressCard(
            address: address!['address'],
            sandbox: address!['sandbox'] == true,
          )
        else if (!busy)
          DtButton(
            label: 'Show deposit address',
            style: DtButtonStyle.secondary,
            onPressed: addressLoad,
          ),
        const SizedBox(height: 24),
        SectionHeading(
          'Recent deposits',
          action: 'View all',
          onTap: () => context.go('/history?filter=deposits'),
        ),
        SurfaceCard(
          child: Column(
            children: [
              if (deposits.isEmpty) const Text('No deposits yet'),
              for (final d in deposits)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text('${tokenText(d['amount_usdt'])} USDT'),
                  subtitle: Text(d['status']),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/history/${d['id']}'),
                ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        DtButton(
          label: 'Refresh',
          style: DtButtonStyle.secondary,
          loading: busy,
          onPressed: load,
        ),
      ],
    );
  }
}

class ApiHistoryPage extends ConsumerStatefulWidget {
  const ApiHistoryPage({this.filter = 'all', super.key});
  final String filter;
  @override
  ConsumerState<ApiHistoryPage> createState() => _ApiHistoryState();
}

class _ApiHistoryState extends ConsumerState<ApiHistoryPage> {
  List<dynamic> items = [];
  String filter = 'all', search = '', error = '';
  int page = 0;
  bool more = true, busy = false;
  @override
  void initState() {
    super.initState();
    filter =
        {'deposit': 'deposits', 'payout': 'payouts'}[widget.filter] ??
        widget.filter;
    Future.microtask(() => load(reset: true));
  }

  Future<void> load({bool reset = false}) async {
    if (busy) return;
    setState(() => busy = true);
    final target = reset ? 1 : page + 1;
    try {
      final r = await ref
          .read(apiSessionProvider)
          .request('/history?type=$filter&page=$target&limit=20');
      if (mounted) {
        setState(() {
          items = reset ? List.of(r['items']) : [...items, ...r['items']];
          page = target;
          more = r['hasMore'];
          error = '';
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => AppPage(
    title: 'History',
    subtitle: 'Every move, in one place.',
    back: false,
    children: [
      TextField(
        decoration: const InputDecoration(
          hintText: 'Search loaded order IDs',
          prefixIcon: Icon(Icons.search_rounded),
        ),
        onChanged: (v) => setState(() => search = v.toLowerCase()),
      ),
      const SizedBox(height: 20),
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            for (final f in [
              ('all', 'All'),
              ('deposits', 'Deposits'),
              ('sell', 'Sell Orders'),
              ('payouts', 'Payouts'),
            ])
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  label: Text(f.$2),
                  selected: filter == f.$1,
                  onSelected: busy
                      ? null
                      : (_) {
                          setState(() => filter = f.$1);
                          load(reset: true);
                        },
                ),
              ),
          ],
        ),
      ),
      const SizedBox(height: 22),
      if (error.isNotEmpty) InfoNote(error),
      if (busy && items.isEmpty) const DtSkeleton(height: 250),
      DtReveal(
        child: SurfaceCard(
          child: Column(
            children: [
              if (items.isEmpty && !busy)
                const Text('No matching transactions'),
              for (final t in items.where(
                (x) => x['id'].toString().toLowerCase().contains(search),
              ))
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: t['type'] == 'payouts'
                      ? const Icon(
                          Icons.account_balance_outlined,
                          color: DtColors.teal,
                        )
                      : const UsdtTokenIcon(size: 28),
                  title: Text(
                    t['type'] == 'sell'
                        ? 'USDT Sell'
                        : t['type'] == 'deposits'
                        ? 'USDT Deposit'
                        : 'INR Payout',
                  ),
                  subtitle: Text(
                    '${t['status'].toString().replaceAll('_', ' ')}\n${DateTime.parse(t['created_at']).toLocal().toString().substring(0, 16)}',
                  ),
                  trailing: Text(
                    t['amount_usdt'] != null
                        ? '${tokenText(t['amount_usdt'])} USDT'
                        : inrMinor(t['inr_minor']),
                  ),
                  onTap: () => context.push(
                    t['type'] == 'sell'
                        ? '/sell/track/${t['id']}'
                        : '/history/${t['id']}',
                  ),
                ),
            ],
          ),
        ),
      ),
      const SizedBox(height: 20),
      if (more)
        DtButton(label: 'Load more', loading: busy, onPressed: () => load()),
      TextButton(
        onPressed: busy ? null : () => load(reset: true),
        child: const Text('Refresh'),
      ),
    ],
  );
}

class ApiDepositDetailsPage extends ConsumerStatefulWidget {
  const ApiDepositDetailsPage({required this.id, super.key});
  final String id;
  @override
  ConsumerState<ApiDepositDetailsPage> createState() =>
      _ApiDepositDetailsState();
}

class _ApiDepositDetailsState extends ConsumerState<ApiDepositDetailsPage> {
  Map<String, dynamic>? data;
  String? error;
  @override
  void initState() {
    super.initState();
    Future.microtask(load);
  }

  Future<void> load() async {
    try {
      final r = Map<String, dynamic>.from(
        await ref.read(apiSessionProvider).request('/history/${widget.id}'),
      );
      if (mounted) setState(() => data = r);
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    }
  }

  @override
  Widget build(BuildContext context) => data?['type'] == 'sell'
      ? ApiOrderPage(id: widget.id)
      : AppPage(
          title: 'Transaction details',
          children: [
            if (error != null) InfoNote(error!),
            if (data == null && error == null) const DtSkeleton(height: 240),
            if (data?['manual'] == true)
              DtButton(
                label: 'View deposit review',
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => ManualDepositDetail(id: widget.id),
                  ),
                ),
              ),
            if (data?['manual_receipt_id'] != null)
              PrivateReceiptButton(id: data!['manual_receipt_id']),
            if (data?['type'] == 'payouts') ...[
              if (data?['sandbox'] == true)
                const InfoNote('Sandbox payout · no real INR transfer.'),
              SurfaceCard(
                child: Column(
                  children: [
                    DetailRow('Payout ID', data!['id']),
                    if (data!['bank'] != null)
                      DetailRow(
                        data!['bank']['bankName'],
                        data!['bank']['accountNumber'],
                      ),
                    DetailRow('Order ID', data!['order_id']),
                    if (data!['amount_usdt'] != null)
                      DetailRow('USDT sold', tokenText(data!['amount_usdt'])),
                    if (data!['rate_inr'] != null)
                      DetailRow('Locked rate', '₹${data!['rate_inr']}'),
                    DetailRow('INR', inrMinor(data!['amount_inr_minor'])),
                    DetailRow('Status', data!['status']),
                    if (data!['utr'] != null) DetailRow('UTR', data!['utr']),
                    if (data!['payout_reference'] != null)
                      DetailRow('Payout reference', data!['payout_reference']),
                    DetailRow('Created', data!['created_at']),
                    if (data!['completed_at'] != null)
                      DetailRow('Completed', data!['completed_at']),
                    if (data!['manual_paid_at'] != null)
                      DetailRow('Payment date', data!['manual_paid_at']),
                  ],
                ),
              ),
            ],
            if (data != null && data?['type'] != 'payouts')
              SurfaceCard(
                child: Column(
                  children: [
                    DetailRow('Deposit ID', data!['id']),
                    DetailRow('USDT', tokenText(data!['amount_usdt'])),
                    DetailRow('Status', data!['status']),
                    DetailRow('Network', 'TRC20'),
                    DetailRow(
                      'Confirmations',
                      '${data!['confirmations']} / ${data!['required_confirmations']}',
                    ),
                    SelectableText(
                      data!['tx_hash'],
                      style: const TextStyle(fontSize: 12),
                    ),
                    CopyControl(value: data!['tx_hash'], label: 'Copy TxID'),
                    DetailRow('Date', data!['created_at']),
                  ],
                ),
              ),
            const SizedBox(height: 20),
            DtButton(label: 'Refresh', onPressed: load),
          ],
        );
}
