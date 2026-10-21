import 'package:dt_exchange/core/design/appearance.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/presentation/kit.dart';
import '../../core/api/api_client.dart';
import '../../preview/preview_controller.dart';
import '../referral/referral_availability.dart';

class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(previewProvider);
    return AppPage(
      title: 'Profile',
      back: false,
      children: [
        DtReveal(
          child: SurfaceCard(
            child: Column(
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CircleAvatar(
                      radius: 30,
                      backgroundColor: dtColor(context, DtColors.softBlue),
                      child: Text(
                        s.name
                            .split(' ')
                            .where((n) => n.isNotEmpty)
                            .take(2)
                            .map((n) => n[0])
                            .join(),
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w600,
                          color: dtColor(context, DtColors.navy),
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            s.name,
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          const SizedBox(height: 5),
                          Text(s.email, style: const TextStyle(fontSize: 12)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        ref.watch(previewModeProvider)
                            ? 'User ID · DT100284'
                            : 'User ID · ${ref.read(previewProvider.notifier).publicUserId}',
                        style: TextStyle(
                          fontSize: 10,
                          color: dtColor(context, DtColors.muted),
                        ),
                      ),
                    ),
                    TextButton(
                      onPressed: () => context.push('/profile/details'),
                      child: Text(
                        'User details',
                        style: TextStyle(
                          fontSize: 12,
                          color: dtColor(context, DtColors.navy),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),
        DtReveal(
          child: SurfaceCard(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
            child: Column(
              children: [
                MenuRow(
                  icon: Icons.account_balance_outlined,
                  title: 'Bank Accounts',
                  subtitle: 'Manage your payout methods',
                  onTap: () => context.push('/banks'),
                ),
                Divider(color: dtColor(context, DtColors.border), height: 1),
                MenuRow(
                  icon: Icons.people_outline_rounded,
                  title: 'Referral Program',
                  subtitle: referralComingSoon
                      ? null
                      : 'Earn by inviting friends',
                  trailing: referralComingSoon
                      ? const _ComingSoonBadge()
                      : null,
                  onTap: () => context.push('/referral'),
                ),
                Divider(color: dtColor(context, DtColors.border), height: 1),
                MenuRow(
                  icon: Icons.settings_outlined,
                  title: 'Settings',
                  subtitle: 'Password, security & more',
                  onTap: () => context.push('/settings'),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 28),
        DtButton(
          label: 'Logout',
          icon: Icons.logout_rounded,
          style: DtButtonStyle.danger,
          onPressed: () async {
            if (await confirmAction(
              context,
              title: 'Log out?',
              body: ref.read(previewModeProvider)
                  ? 'Your preview session and local changes will reset.'
                  : 'Sign out of this device?',
              action: 'Logout',
            )) {
              if (!context.mounted) return;
              if (!ref.read(previewModeProvider)) {
                try {
                  await ref.read(previewProvider.notifier).logoutApi();
                } catch (e) {
                  if (context.mounted) toast(context, apiMessage(e));
                }
                if (context.mounted) context.go('/login');
                return;
              }
              ref.read(previewProvider.notifier).logout();
              context.go('/login');
            }
          },
        ),
        const SizedBox(height: 30),
        Text(
          'DT Exchange v1.0',
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

class _ComingSoonBadge extends StatelessWidget {
  const _ComingSoonBadge();
  @override
  Widget build(BuildContext context) => Container(
    constraints: const BoxConstraints(maxWidth: 105),
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
    decoration: BoxDecoration(
      color: dtColor(context, DtColors.softMint),
      borderRadius: BorderRadius.circular(10),
    ),
    child: Text(
      'Coming Soon',
      textAlign: TextAlign.center,
      style: TextStyle(
        fontSize: 10,
        fontWeight: FontWeight.w600,
        color: dtColor(context, DtColors.navy),
      ),
    ),
  );
}

class MenuRow extends StatelessWidget {
  const MenuRow({
    required this.icon,
    required this.title,
    required this.onTap,
    this.subtitle,
    this.trailing,
    super.key,
  });
  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback onTap;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: const EdgeInsets.symmetric(vertical: 8),
    onTap: onTap,
    leading: Container(
      width: 43,
      height: 43,
      decoration: BoxDecoration(
        color: dtColor(context, DtColors.softBlue),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Icon(icon, color: dtColor(context, DtColors.navy), size: 21),
    ),
    title: Text(
      title,
      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
    ),
    subtitle: subtitle == null
        ? null
        : Padding(
            padding: const EdgeInsets.only(top: 5),
            child: Text(
              subtitle!,
              style: TextStyle(
                fontSize: 11,
                color: dtColor(context, DtColors.muted),
              ),
            ),
          ),
    trailing:
        trailing ??
        Icon(
          Icons.chevron_right_rounded,
          size: 20,
          color: dtColor(context, DtColors.muted),
        ),
  );
}

class UserDetailsPage extends ConsumerStatefulWidget {
  const UserDetailsPage({super.key});
  @override
  ConsumerState<UserDetailsPage> createState() => _DetailsState();
}

class _DetailsState extends ConsumerState<UserDetailsPage> {
  final form = GlobalKey<FormState>();
  late final TextEditingController name, email, mobile;
  @override
  void initState() {
    super.initState();
    final s = ref.read(previewProvider);
    name = TextEditingController(text: s.name);
    email = TextEditingController(text: s.email);
    mobile = TextEditingController(text: s.mobile);
  }

  @override
  void dispose() {
    name.dispose();
    email.dispose();
    mobile.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AppPage(
    title: 'User details',
    children: [
      SurfaceCard(
        child: Form(
          key: form,
          child: Column(
            children: [
              DtField(
                label: 'Full name',
                controller: name,
                validator: (v) =>
                    (v?.trim().length ?? 0) > 1 ? null : 'Enter your name',
              ),
              const SizedBox(height: 20),
              DtField(
                label: 'Email',
                controller: email,
                keyboardType: TextInputType.emailAddress,
                validator: emailValidator,
              ),
              const SizedBox(height: 20),
              DtField(
                label: 'Mobile',
                controller: mobile,
                keyboardType: TextInputType.phone,
                validator: (v) => RegExp(r'^\+?\d{10,13}$').hasMatch(v ?? '')
                    ? null
                    : 'Enter a valid mobile number',
              ),
            ],
          ),
        ),
      ),
      const SizedBox(height: 20),
      InfoNote(
        ref.watch(previewModeProvider)
            ? 'Changes are kept only for this preview session.'
            : 'These details come from your account. Contact changes require an OTP confirmation.',
      ),
      const SizedBox(height: 24),
      DtButton(
        label: 'Save changes',
        onPressed: !ref.watch(previewModeProvider)
            ? null
            : () {
                if (!form.currentState!.validate()) return;
                ref
                    .read(previewProvider.notifier)
                    .updateProfile(
                      name.text.trim(),
                      email.text.trim(),
                      mobile.text.trim(),
                    );
                toast(context, 'Preview details saved');
                context.pop();
              },
      ),
    ],
  );
}
