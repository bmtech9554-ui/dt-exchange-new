import 'package:dt_exchange/core/design/appearance.dart';
import 'telegram_support.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/presentation/kit.dart';
import '../../preview/preview_controller.dart';

const faqs = [
  (
    'Which network can I use?',
    'This interface supports USDT on TRON (TRC20). The preview QR is not a payment address. Future networks will appear only when supported.',
  ),
  (
    'When is my rate locked?',
    'The rate shown on Confirm is preserved when you accept the quote. An expired quote must be refreshed.',
  ),
  (
    'How do I track my payout?',
    'Open History and select your sell order. The status timeline and payout reference appear in its details.',
  ),
  (
    'Can I change my payout bank?',
    'Select an available bank before confirming a sale. Changing your default later does not change an already confirmed order.',
  ),
  (
    'Does this preview move real money?',
    'No. All balances, rates, deposits, transactions and payouts are simulated. Do not send funds to a preview QR.',
  ),
];

class SupportPage extends ConsumerWidget {
  const SupportPage({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(previewProvider);
    return AppPage(
      title: 'Help & Support',
      children: [
        const TelegramSupportCard(),
        const SizedBox(height: 16),
        DtReveal(
          child: SurfaceCard(
            color: dtColor(context, DtColors.softBlue),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.headset_mic_outlined,
                  size: 36,
                  color: dtColor(context, DtColors.navy),
                ),
                const SizedBox(height: 18),
                Text(
                  'Here to help.',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 10),
                const Text('Find an answer or tell us what you need.'),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: DtButton(
                    label: 'Create support ticket',
                    icon: Icons.add_comment_outlined,
                    onPressed: () => context.push('/support/new'),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 26),
        const SectionHeading('Frequently asked questions'),
        SurfaceCard(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          child: Column(
            children: [
              for (final q in faqs)
                ExpansionTile(
                  tilePadding: EdgeInsets.zero,
                  childrenPadding: const EdgeInsets.only(bottom: 16),
                  shape: const Border(),
                  collapsedShape: const Border(),
                  title: Text(
                    q.$1,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: dtColor(context, DtColors.navy),
                    ),
                  ),
                  children: [
                    Text(
                      q.$2,
                      style: const TextStyle(fontSize: 12, height: 1.7),
                    ),
                  ],
                ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        SectionHeading(
          'Your tickets${s.tickets.isEmpty ? '' : ' · ${s.tickets.length}'}',
        ),
        if (s.tickets.isEmpty)
          const SurfaceCard(
            child: DtEmptyState(
              title: 'No tickets yet',
              description: 'Your sample requests will appear here.',
            ),
          )
        else
          for (final ticket in s.tickets) ...[
            SurfaceCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    ticket.subject,
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: dtColor(context, DtColors.navy),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${ticket.id} · ${ticket.category}',
                    style: const TextStyle(fontSize: 11),
                  ),
                  const SizedBox(height: 8),
                  Text(ticket.message, style: const TextStyle(fontSize: 12)),
                  const SizedBox(height: 10),
                  Text(
                    'Saved in preview · Not sent',
                    style: TextStyle(
                      fontSize: 11,
                      color: dtColor(context, Color(0xFF087E64)),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
      ],
    );
  }
}

class NewTicketPage extends ConsumerStatefulWidget {
  const NewTicketPage({this.order = '', super.key});
  final String order;
  @override
  ConsumerState<NewTicketPage> createState() => _TicketState();
}

class _TicketState extends ConsumerState<NewTicketPage> {
  final form = GlobalKey<FormState>();
  late final TextEditingController subject;
  final message = TextEditingController();
  String category = 'Transaction', id = '';
  bool busy = false;
  @override
  void initState() {
    super.initState();
    subject = TextEditingController(
      text: widget.order.isEmpty ? '' : 'Help with ${widget.order}',
    );
  }

  @override
  void dispose() {
    subject.dispose();
    message.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (!form.currentState!.validate()) return;
    setState(() => busy = true);
    await Future<void>.delayed(const Duration(milliseconds: 500));
    if (!mounted) return;
    final value = ref
        .read(previewProvider.notifier)
        .createTicket(subject.text.trim(), message.text.trim(), category);
    setState(() {
      busy = false;
      id = value;
    });
  }

  @override
  Widget build(BuildContext context) => AppPage(
    title: 'Create support ticket',
    children: [
      if (id.isNotEmpty) ...[
        const Center(child: SuccessMark()),
        const SizedBox(height: 24),
        Text(
          'Your preview ticket is saved.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 16),
        Text(id, textAlign: TextAlign.center),
        const SizedBox(height: 20),
        const InfoNote(
          'This ticket is held in this session only. Nothing was sent to a support team.',
        ),
        const SizedBox(height: 24),
        DtButton(
          label: 'View your tickets',
          onPressed: () => context.go('/support'),
        ),
      ] else ...[
        const InfoNote(
          'Use sample information. Do not include passwords, OTPs or full financial account details.',
        ),
        const SizedBox(height: 24),
        SurfaceCard(
          child: Form(
            key: form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: category,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Category'),
                  items: [
                    for (final c in [
                      'Transaction',
                      'Deposit',
                      'Bank account',
                      'Account',
                      'Other',
                    ])
                      DropdownMenuItem(value: c, child: Text(c)),
                  ],
                  onChanged: (v) => setState(() => category = v!),
                ),
                const SizedBox(height: 18),
                DtField(
                  label: 'Subject',
                  controller: subject,
                  validator: (v) => (v?.trim().length ?? 0) >= 5
                      ? null
                      : 'Add a short subject (5+ characters)',
                ),
                const SizedBox(height: 18),
                TextFormField(
                  controller: message,
                  maxLines: 5,
                  maxLength: 1000,
                  decoration: const InputDecoration(
                    labelText: 'How can we help?',
                    alignLabelWithHint: true,
                  ),
                  validator: (v) => (v?.trim().length ?? 0) >= 15
                      ? null
                      : 'Describe your question in at least 15 characters',
                ),
                const SizedBox(height: 22),
                DtButton(
                  label: 'Save preview ticket',
                  loading: busy,
                  onPressed: submit,
                ),
              ],
            ),
          ),
        ),
      ],
    ],
  );
}
