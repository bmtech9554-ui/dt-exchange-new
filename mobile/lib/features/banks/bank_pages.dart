import 'package:dt_exchange/core/design/appearance.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/presentation/kit.dart';
import '../../core/api/api_client.dart';
import '../../preview/preview_controller.dart';

class BankAccountsPage extends ConsumerWidget {
  const BankAccountsPage({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(previewProvider);
    return AppPage(
      title: 'Bank accounts',
      subtitle: 'Your INR payout destinations.',
      children: [
        InfoNote(
          ref.watch(previewModeProvider)
              ? 'Payouts go to your selected bank account. Use sample details in this preview.'
              : 'Your account details are encrypted. Saved details are available for manual payouts and are not independently verified.',
          mint: true,
          icon: Icons.account_balance_outlined,
        ),
        const SizedBox(height: 24),
        for (final bank in s.banks) ...[
          DtReveal(
            child: SurfaceCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  BankSummary(bank, isDefault: bank.id == s.defaultBankId),
                  Divider(color: dtColor(context, DtColors.border), height: 24),
                  DetailRow('Account holder', bank.holder),
                  DetailRow('Account number', '•••• •••• ${bank.last4}'),
                  DetailRow('IFSC', bank.ifsc),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Expanded(
                        child: Text(
                          'Account status',
                          style: TextStyle(fontSize: 12),
                        ),
                      ),
                      Text(bank.available ? 'Available' : 'Unavailable'),
                    ],
                  ),
                  if (!ref.watch(previewModeProvider))
                    TextButton(
                      onPressed: () async {
                        try {
                          await ref
                              .read(previewProvider.notifier)
                              .removeBankApi(bank.id);
                        } catch (e) {
                          if (context.mounted) toast(context, apiMessage(e));
                        }
                      },
                      child: const Text('Remove account'),
                    ),
                  if (bank.id != s.defaultBankId) ...[
                    const SizedBox(height: 16),
                    DtButton(
                      label: 'Set as default',
                      style: DtButtonStyle.secondary,
                      onPressed: () async {
                        if (!ref.read(previewModeProvider)) {
                          try {
                            await ref
                                .read(previewProvider.notifier)
                                .defaultBankApi(bank.id);
                            if (context.mounted) {
                              toast(context, 'Default payout account updated');
                            }
                          } catch (e) {
                            if (context.mounted) toast(context, apiMessage(e));
                          }
                          return;
                        }
                        ref
                            .read(previewProvider.notifier)
                            .setDefaultBank(bank.id);
                        toast(context, 'Default payout account updated');
                      },
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 18),
        ],
        DtButton(
          label: 'Add bank account',
          icon: Icons.add_rounded,
          onPressed: () => context.push('/banks/add'),
        ),
        const SizedBox(height: 16),
        TextButton(
          onPressed: () => context.go('/home'),
          child: const Text('Back to Home'),
        ),
      ],
    );
  }
}

class AddBankPage extends ConsumerStatefulWidget {
  const AddBankPage({super.key});
  @override
  ConsumerState<AddBankPage> createState() => _AddBankState();
}

class _AddBankState extends ConsumerState<AddBankPage> {
  final form = GlobalKey<FormState>();
  final holder = TextEditingController(),
      number = TextEditingController(),
      confirm = TextEditingController(),
      ifsc = TextEditingController(),
      bank = TextEditingController();
  bool busy = false;
  String? error;
  @override
  void initState() {
    super.initState();
    holder.text = ref.read(previewProvider).name;
  }

  @override
  void dispose() {
    for (final c in [holder, number, confirm, ifsc, bank]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> save() async {
    if (!form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    if (!ref.read(previewModeProvider)) {
      try {
        await ref
            .read(previewProvider.notifier)
            .addBankApi(holder.text, number.text, ifsc.text, bank.text);
        if (mounted) {
          toast(context, 'Bank account submitted');
          context.pop();
        }
      } catch (e) {
        if (mounted) setState(() => error = apiMessage(e));
      } finally {
        if (mounted) setState(() => busy = false);
      }
      return;
    }
    await Future<void>.delayed(const Duration(milliseconds: 650));
    if (!mounted) return;
    try {
      ref
          .read(previewProvider.notifier)
          .addBank(
            holder: holder.text.trim(),
            number: number.text.trim(),
            ifsc: ifsc.text.trim().toUpperCase(),
            name: bank.text.trim(),
          );
      toast(context, 'Sample bank account added');
      context.pop();
    } catch (e) {
      setState(() {
        busy = false;
        error = e.toString().replaceFirst('Bad state: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) => AppPage(
    title: 'Add bank account',
    children: [
      InfoNote(
        ref.watch(previewModeProvider)
            ? 'Enter sample details only. Bank verification is simulated; no beneficiary is created.'
            : 'Use an account in your own name. Saved details are available for manual payouts and are not independently verified.',
      ),
      const SizedBox(height: 22),
      SurfaceCard(
        child: Form(
          key: form,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              DtField(
                label: 'Account holder name',
                controller: holder,
                validator: requiredValue,
              ),
              const SizedBox(height: 18),
              DtField(
                label: 'Account number',
                controller: number,
                keyboardType: TextInputType.number,
                validator: (v) =>
                    RegExp(r'^\d{9,18}$').hasMatch(v?.trim() ?? '')
                    ? null
                    : 'Use 9–18 digits',
              ),
              const SizedBox(height: 18),
              DtField(
                label: 'Confirm account number',
                controller: confirm,
                keyboardType: TextInputType.number,
                validator: (v) => v?.trim() == number.text.trim()
                    ? null
                    : 'Account numbers must match',
              ),
              const SizedBox(height: 18),
              DtField(
                label: 'IFSC',
                hint: 'HDFC0000001',
                controller: ifsc,
                validator: (v) =>
                    RegExp(
                      r'^[A-Z]{4}0[A-Z0-9]{6}$',
                    ).hasMatch(v?.trim().toUpperCase() ?? '')
                    ? null
                    : 'Enter an 11-character IFSC',
              ),
              const SizedBox(height: 18),
              DtField(
                label: 'Bank name',
                controller: bank,
                validator: requiredValue,
              ),
              if (error != null) ...[
                const SizedBox(height: 16),
                Text(
                  error!,
                  style: TextStyle(color: dtColor(context, DtColors.red)),
                ),
              ],
              const SizedBox(height: 24),
              const InfoNote(
                'Withdrawals are processed within 24 hours. Ensure your bank details are correct.',
              ),
              DtButton(
                label: ref.watch(previewModeProvider)
                    ? 'Add & verify preview account'
                    : 'Add bank account',
                loading: busy,
                onPressed: save,
              ),
            ],
          ),
        ),
      ),
    ],
  );
}
