import 'package:dt_exchange/core/design/appearance.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/presentation/kit.dart';
import '../../core/api/api_client.dart';
import '../../preview/preview_controller.dart';
import '../profile/profile_pages.dart';
import '../engagement/engagement_pages.dart';
import 'biometric_page.dart';

class SettingsPage extends ConsumerWidget {
  const SettingsPage({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(previewProvider);
    final preview = ref.watch(previewModeProvider);
    final settings = preview
        ? null
        : ref.watch(engagementData('/settings')).asData?.value;
    return AppPage(
      title: 'Settings',
      children: [
        const SectionHeading('Account & access'),
        SurfaceCard(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 4),
          child: Column(
            children: [
              MenuRow(
                icon: Icons.lock_outline_rounded,
                title: 'Change password',
                onTap: () => context.push('/settings/password'),
              ),
              MenuRow(
                icon: Icons.pin_outlined,
                title: 'Security PIN',
                subtitle: preview
                    ? (s.pinSet
                          ? 'Preview PIN configured'
                          : 'Add a 6-digit PIN')
                    : (settings?['pinSet'] == true
                          ? 'PIN configured'
                          : 'Add a 6-digit PIN'),
                onTap: () => context.push('/settings/pin'),
              ),
              MenuRow(
                icon: Icons.fingerprint_rounded,
                title: 'Biometric login',
                subtitle: preview
                    ? (s.biometric
                          ? 'Preview enabled'
                          : 'Use your device to sign in')
                    : (ref.watch(biometricPreferenceProvider).asData?.value ==
                              true
                          ? 'Enabled on this device'
                          : 'Use your device to sign in'),
                onTap: () => context.push('/settings/biometric'),
              ),
              MenuRow(
                icon: Icons.phonelink_lock_outlined,
                title: 'Two-factor authentication',
                subtitle: s.twoFactor
                    ? 'Preview enabled'
                    : 'Add another layer of protection',
                onTap: () => context.push('/settings/2fa'),
              ),
              MenuRow(
                icon: Icons.devices_outlined,
                title: 'Login devices',
                subtitle: preview
                    ? '${s.devices.length} preview sessions'
                    : 'Manage your signed-in devices',
                onTap: () => context.push('/settings/devices'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        const InfoNote(
          'We process only reviewed transactions that meet our compliance requirements.',
        ),
        const SectionHeading('Make it yours'),
        SurfaceCard(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 4),
          child: Column(
            children: [
              MenuRow(
                icon: Icons.notifications_none_rounded,
                title: 'Notifications',
                onTap: () => context.push('/settings/notifications'),
              ),
              MenuRow(
                icon: Icons.tune_rounded,
                title: 'App preferences',
                subtitle: 'Light, Dark or System Default · English · INR',
                onTap: () => context.push('/settings/preferences'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        const SectionHeading('Information & support'),
        SurfaceCard(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 4),
          child: Column(
            children: [
              MenuRow(
                icon: Icons.privacy_tip_outlined,
                title: 'Privacy Policy',
                onTap: () => context.push('/legal/privacy'),
              ),
              MenuRow(
                icon: Icons.description_outlined,
                title: 'Terms & Conditions',
                onTap: () => context.push('/legal/terms'),
              ),
              MenuRow(
                icon: Icons.headset_mic_outlined,
                title: 'Help & Support',
                onTap: () => context.push('/support'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 26),
        DtButton(
          label: 'Delete account',
          icon: Icons.person_remove_outlined,
          style: DtButtonStyle.danger,
          onPressed: () => context.push('/settings/delete'),
        ),
      ],
    );
  }
}

class PasswordPage extends ConsumerStatefulWidget {
  const PasswordPage({this.reset = false, super.key});
  final bool reset;
  @override
  ConsumerState<PasswordPage> createState() => _PasswordState();
}

class _PasswordState extends ConsumerState<PasswordPage> {
  final form = GlobalKey<FormState>();
  final current = TextEditingController(),
      next = TextEditingController(),
      confirm = TextEditingController();
  bool busy = false, done = false;
  @override
  void dispose() {
    current.dispose();
    next.dispose();
    confirm.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (!form.currentState!.validate()) return;
    setState(() => busy = true);
    if (!ref.read(previewModeProvider)) {
      if (next.text.length < 12) {
        toast(context, 'Use at least 12 characters');
        setState(() => busy = false);
        return;
      }
      try {
        await ref
            .read(previewProvider.notifier)
            .passwordApi(
              next.text,
              current: widget.reset ? null : current.text,
            );
        if (mounted) {
          toast(context, 'Password changed. Sign in again.');
          context.go('/login');
        }
      } catch (e) {
        if (mounted) toast(context, apiMessage(e));
      } finally {
        if (mounted) setState(() => busy = false);
      }
      return;
    }
    await Future<void>.delayed(const Duration(milliseconds: 500));
    if (mounted) {
      current.clear();
      next.clear();
      confirm.clear();
      setState(() {
        busy = false;
        done = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) => AppPage(
    title: widget.reset ? 'Reset password' : 'Change password',
    children: [
      if (done) ...[
        const Center(child: SuccessMark()),
        const SizedBox(height: 24),
        Text(
          'Preview password updated',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 14),
        const Text(
          'No real password has been changed or stored.',
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 24),
        DtButton(
          label: widget.reset ? 'Back to login' : 'Back to settings',
          onPressed: () => context.go(widget.reset ? '/login' : '/settings'),
        ),
      ] else ...[
        InfoNote(
          ref.watch(previewModeProvider)
              ? 'Use sample passwords. This UI preview validates the form but does not change or store credentials.'
              : 'Use at least 12 characters. Changing your password signs out every device.',
        ),
        const SizedBox(height: 24),
        SurfaceCard(
          child: Form(
            key: form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (!widget.reset) ...[
                  DtField(
                    label: 'Current password',
                    controller: current,
                    obscureText: true,
                    validator: passwordValidator,
                  ),
                  const SizedBox(height: 18),
                ],
                DtField(
                  label: 'New password',
                  controller: next,
                  obscureText: true,
                  validator: (v) {
                    final e = passwordValidator(v);
                    if (e != null) return e;
                    return !widget.reset && v == current.text
                        ? 'Choose a different password'
                        : null;
                  },
                ),
                const SizedBox(height: 18),
                DtField(
                  label: 'Confirm new password',
                  controller: confirm,
                  obscureText: true,
                  validator: (v) =>
                      v == next.text ? null : 'Passwords must match',
                ),
                const SizedBox(height: 24),
                DtButton(
                  label: ref.watch(previewModeProvider)
                      ? 'Update preview password'
                      : 'Update password',
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

class PinPage extends ConsumerStatefulWidget {
  const PinPage({super.key});
  @override
  ConsumerState<PinPage> createState() => _PinState();
}

class _PinState extends ConsumerState<PinPage> {
  final form = GlobalKey<FormState>();
  final pin = TextEditingController(), confirm = TextEditingController();
  bool done = false;
  @override
  void dispose() {
    pin.dispose();
    confirm.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AppPage(
    title: 'Security PIN',
    children: [
      if (done) ...[
        const Center(child: SuccessMark()),
        const SizedBox(height: 20),
        const Text('Preview PIN configured', textAlign: TextAlign.center),
        const SizedBox(height: 24),
        DtButton(label: 'Back to settings', onPressed: () => context.pop()),
      ] else ...[
        const InfoNote(
          'Preview only. A PIN is not persisted and does not protect this demo.',
        ),
        const SizedBox(height: 24),
        SurfaceCard(
          child: Form(
            key: form,
            child: Column(
              children: [
                for (final item in [
                  (pin, 'New 6-digit PIN'),
                  (confirm, 'Confirm PIN'),
                ])
                  Padding(
                    padding: const EdgeInsets.only(bottom: 18),
                    child: TextFormField(
                      controller: item.$1,
                      obscureText: true,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      decoration: InputDecoration(
                        labelText: item.$2,
                        counterText: '',
                      ),
                      validator: (v) => RegExp(r'^\d{6}$').hasMatch(v ?? '')
                          ? (item.$1 == confirm && v != pin.text
                                ? 'PINs must match'
                                : null)
                          : 'Enter 6 digits',
                    ),
                  ),
                DtButton(
                  label: 'Set preview PIN',
                  onPressed: !ref.watch(previewModeProvider)
                      ? null
                      : () {
                          if (form.currentState!.validate()) {
                            ref
                                .read(previewProvider.notifier)
                                .preference('pin', true);
                            pin.clear();
                            confirm.clear();
                            setState(() => done = true);
                          }
                        },
                ),
              ],
            ),
          ),
        ),
      ],
    ],
  );
}

class SecurityPreviewPage extends ConsumerWidget {
  const SecurityPreviewPage({required this.biometric, super.key});
  final bool biometric;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(previewProvider);
    final enabled = biometric ? s.biometric : s.twoFactor;
    return AppPage(
      title: biometric ? 'Biometric login' : 'Two-factor authentication',
      children: [
        Center(
          child: Container(
            padding: const EdgeInsets.all(28),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: dtColor(context, DtColors.softMint),
            ),
            child: Icon(
              biometric ? Icons.fingerprint : Icons.phonelink_lock,
              size: 56,
              color: dtColor(context, DtColors.navy),
            ),
          ),
        ),
        const SizedBox(height: 26),
        Text(
          biometric ? 'A familiar touch.' : 'An extra layer of care.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 22),
        InfoNote(
          biometric
              ? 'Preview preference only. Face ID / fingerprint authentication is not connected.'
              : 'Preview preference only. No authenticator secret is issued and 2FA is not enforced.',
        ),
        const SizedBox(height: 24),
        SurfaceCard(
          child: SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(
              biometric
                  ? 'Preview biometric preference'
                  : 'Preview 2FA preference',
              style: const TextStyle(fontSize: 14),
            ),
            subtitle: Text(
              enabled ? 'Enabled in UI only' : 'Disabled',
              style: const TextStyle(fontSize: 12),
            ),
            value: enabled,
            onChanged: !ref.watch(previewModeProvider)
                ? null
                : (v) => ref
                      .read(previewProvider.notifier)
                      .preference(biometric ? 'biometric' : 'twoFactor', v),
          ),
        ),
        const SizedBox(height: 20),
        const Text(
          'Device authentication and server enforcement are later-phase integrations.',
          style: TextStyle(fontSize: 12),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}

class DevicesPage extends ConsumerStatefulWidget {
  const DevicesPage({super.key});
  @override
  ConsumerState<DevicesPage> createState() => _DevicesState();
}

class _DevicesState extends ConsumerState<DevicesPage> {
  String? error;
  bool loading = false;
  @override
  void initState() {
    super.initState();
    if (!ref.read(previewModeProvider)) Future.microtask(load);
  }

  Future<void> load() async {
    setState(() => loading = true);
    try {
      await ref.read(previewProvider.notifier).loadSessions();
    } catch (e) {
      error = apiMessage(e);
    }
    if (mounted) setState(() => loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final devices = ref.watch(previewProvider).devices;
    if (!ref.watch(previewModeProvider)) {
      final c = ref.read(previewProvider.notifier);
      return AppPage(
        title: 'Login devices',
        onRefresh: load,
        children: [
          if (loading) const DtSkeleton(height: 90),
          if (error != null) InfoNote(error!),
          for (final d in c.liveSessions) ...[
            SurfaceCard(
              child: Column(
                children: [
                  DetailRow('Device', d['deviceLabel'] ?? 'DT Exchange app'),
                  DetailRow('Last active', d['lastSeenAt'].toString()),
                  if (d['current'] == true)
                    const Text('Current device')
                  else
                    TextButton(
                      onPressed: () async {
                        try {
                          await c.logoutDevice(d['id']);
                        } catch (e) {
                          if (context.mounted) toast(context, apiMessage(e));
                        }
                      },
                      child: const Text('Remove session'),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],
          DtButton(
            label: 'Logout all other devices',
            onPressed: () async {
              try {
                await c.logoutOthers();
              } catch (e) {
                if (context.mounted) toast(context, apiMessage(e));
              }
            },
          ),
        ],
      );
    }
    return AppPage(
      title: 'Login devices',
      children: [
        const InfoNote(
          'These are sample device sessions. Removing one only changes the preview list.',
        ),
        const SizedBox(height: 24),
        for (final d in devices) ...[
          SurfaceCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(
                    d.contains('iPhone') ? Icons.phone_iphone : Icons.computer,
                    color: dtColor(context, DtColors.navy),
                  ),
                  title: Text(d, style: const TextStyle(fontSize: 14)),
                  subtitle: const Text(
                    'Sample activity · India',
                    style: TextStyle(fontSize: 12),
                  ),
                ),
                if (!d.contains('Current'))
                  TextButton(
                    onPressed: () async {
                      if (await confirmAction(
                        context,
                        title: 'Remove this session?',
                        body:
                            'The sample device will be removed from this preview.',
                        action: 'Remove',
                      )) {
                        ref.read(previewProvider.notifier).revokeDevice(d);
                      }
                    },
                    child: Text(
                      'Remove session',
                      style: TextStyle(color: dtColor(context, DtColors.red)),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],
      ],
    );
  }
}

class PreferencesPage extends ConsumerWidget {
  const PreferencesPage({this.notifications = false, super.key});
  final bool notifications;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(previewProvider);
    final items = notifications
        ? [
            (
              'transactions',
              'Transaction updates',
              'Deposit and payout status',
              s.transactionAlerts,
            ),
            ('rates', 'Rate alerts', 'Preview rate changes', s.rateAlerts),
            (
              'marketing',
              'Product news',
              'Occasional app updates',
              s.marketing,
            ),
          ]
        : [
            (
              'motion',
              'Reduce motion',
              'Limit decorative animations',
              s.reducedMotion,
            ),
          ];
    return AppPage(
      title: notifications ? 'Notification preferences' : 'App preferences',
      children: [
        SurfaceCard(
          child: Column(
            children: [
              for (final p in items)
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(p.$2, style: const TextStyle(fontSize: 14)),
                  subtitle: Text(p.$3, style: const TextStyle(fontSize: 12)),
                  value: p.$4,
                  onChanged: (v) =>
                      ref.read(previewProvider.notifier).preference(p.$1, v),
                ),
              if (!notifications) ...[
                Divider(color: dtColor(context, DtColors.border), height: 24),
                const AppearancePicker(),
                const DetailRow('Language', 'English'),
                const DetailRow('Currency', 'INR · ₹'),
              ],
            ],
          ),
        ),
        const SizedBox(height: 20),
        InfoNote(
          notifications
              ? 'Preferences are kept for this preview session. No push notifications are delivered.'
              : 'Your appearance choice is saved on this device. System Default follows your device theme. Reduced motion is respected.',
        ),
      ],
    );
  }
}

class DeleteAccountPage extends ConsumerStatefulWidget {
  const DeleteAccountPage({super.key});
  @override
  ConsumerState<DeleteAccountPage> createState() => _DeleteState();
}

class _DeleteState extends ConsumerState<DeleteAccountPage> {
  final c = TextEditingController();
  @override
  void dispose() {
    c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AppPage(
    title: 'Delete account',
    children: [
      const InfoNote(
        'This resets only your preview session. No live account or financial records are deleted.',
      ),
      const SizedBox(height: 24),
      SurfaceCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Type DELETE to reset your preview.',
              style: TextStyle(color: dtColor(context, DtColors.navy)),
            ),
            const SizedBox(height: 18),
            TextField(
              controller: c,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(labelText: 'Confirmation'),
            ),
            const SizedBox(height: 24),
            DtButton(
              label: 'Delete preview account',
              style: DtButtonStyle.danger,
              onPressed: c.text == 'DELETE'
                  ? () async {
                      if (await confirmAction(
                        context,
                        title: 'Reset the preview?',
                        body:
                            'Local profile changes, banks and sample orders will be cleared.',
                        action: 'Reset preview',
                      )) {
                        if (!context.mounted) return;
                        ref.read(previewProvider.notifier).logout();
                        context.go('/login');
                      }
                    }
                  : null,
            ),
          ],
        ),
      ),
    ],
  );
}

class LegalPage extends StatelessWidget {
  const LegalPage({required this.privacy, super.key});
  final bool privacy;
  @override
  Widget build(BuildContext context) => AppPage(
    title: privacy ? 'Privacy Policy' : 'Terms & Conditions',
    children: [
      const InfoNote(
        'Preview content only. Operational terms and privacy notices require review before a live launch.',
      ),
      const SizedBox(height: 24),
      SurfaceCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              privacy ? 'Your data in this preview' : 'About this preview',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 18),
            Text(
              privacy
                  ? 'Profile, bank, preference and support entries are held in memory for this session. They reset on logout or restart. Passwords and PIN values are not stored. Use fictional information only.\n\nCopy and Share are explicit device actions. Sharing uses the operating system’s share sheet; you choose the destination.'
                  : 'DT Exchange Phase 2 demonstrates the mobile interface. Rates, balances, transaction references and rewards are sample data. No real account, deposit, sale or payout is created.\n\nThe QR code is not a valid payment address. Do not transfer funds. Simulated completion is for interface review only.',
              style: const TextStyle(fontSize: 14, height: 1.8),
            ),
            const SizedBox(height: 20),
            TextButton(
              onPressed: () => context.push('/support'),
              child: const Text('Questions? Help & Support'),
            ),
          ],
        ),
      ),
    ],
  );
}
