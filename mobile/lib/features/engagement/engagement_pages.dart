import 'package:dt_exchange/core/design/appearance.dart';
import '../support/telegram_support.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import '../../core/api/api_client.dart';
import '../../core/presentation/kit.dart';
import '../../preview/preview_controller.dart';
import '../../preview/money.dart';

final engagementData = FutureProvider.autoDispose.family<dynamic, String>(
  (ref, path) => ref
      .read(apiSessionProvider)
      .request(
        path,
        authenticated:
            !path.startsWith('/settings/legal/') && path != '/support/faq',
      ),
);

class ApiEngagementView extends ConsumerWidget {
  const ApiEngagementView({
    required this.title,
    required this.path,
    required this.builder,
    this.leading = const [],
    super.key,
  });
  final String title, path;
  final List<Widget> leading;
  final List<Widget> Function(dynamic) builder;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(engagementData(path));
    return AppPage(
      title: title,
      children: [
        ...leading,
        ...data.when(
          data: builder,
          loading: () => [const DtSkeleton(height: 240)],
          error: (e, s) => [InfoNote(apiMessage(e))],
        ),
        const SizedBox(height: 20),
        DtButton(
          label: 'Refresh',
          style: DtButtonStyle.secondary,
          onPressed: () => ref.invalidate(engagementData(path)),
        ),
      ],
    );
  }
}

class ApiNotificationsPage extends ConsumerStatefulWidget {
  const ApiNotificationsPage({super.key});
  @override
  ConsumerState<ApiNotificationsPage> createState() => _NoticeState();
}

class _NoticeState extends ConsumerState<ApiNotificationsPage> {
  int page = 1;
  @override
  Widget build(BuildContext context) {
    final path = '/notifications?page=$page&limit=20';
    return ApiEngagementView(
      title: 'Notifications',
      path: path,
      builder: (data) {
        final items = data as List;
        return [
          SectionHeading(
            items.isEmpty ? 'You’re all caught up' : 'Your updates',
          ),
          DtButton(
            label: 'Mark all as read',
            style: DtButtonStyle.secondary,
            onPressed: () async {
              try {
                await ref
                    .read(apiSessionProvider)
                    .request('/notifications/read-all', method: 'POST');
                ref.invalidate(engagementData(path));
              } catch (e) {
                if (context.mounted) toast(context, apiMessage(e));
              }
            },
          ),
          const SizedBox(height: 16),
          if (items.isEmpty)
            const SurfaceCard(
              child: DtEmptyState(
                title: 'No notifications',
                description: 'Important updates will appear here.',
              ),
            ),
          for (final n in items) ...[
            DtReveal(
              child: SurfaceCard(
                color: n['read_at'] == null
                    ? dtColor(context, DtColors.softBlue)
                    : dtColor(context, DtColors.white),
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(
                    Icons.notifications_none_rounded,
                    color: dtColor(context, DtColors.navy),
                  ),
                  title: Text(n['title']),
                  subtitle: Text(
                    '${n['body']}\n${DateTime.tryParse(n['created_at'] ?? '')?.toLocal().toString().split('.').first ?? ''}',
                  ),
                  onTap: () async {
                    try {
                      await ref
                          .read(apiSessionProvider)
                          .request(
                            '/notifications/${n['id']}/read',
                            method: 'PATCH',
                          );
                      ref.invalidate(engagementData(path));
                      final route = n['deep_link'] ?? n['data']?['route'];
                      if (context.mounted &&
                          route is String &&
                          route.startsWith('/')) {
                        context.push(route);
                      }
                    } catch (e) {
                      if (context.mounted) toast(context, apiMessage(e));
                    }
                  },
                ),
              ),
            ),
            const SizedBox(height: 14),
          ],
          Row(
            children: [
              Expanded(
                child: DtButton(
                  label: 'Previous',
                  style: DtButtonStyle.secondary,
                  onPressed: page > 1 ? () => setState(() => page--) : null,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: DtButton(
                  label: 'Next',
                  style: DtButtonStyle.secondary,
                  onPressed: items.length == 20
                      ? () => setState(() => page++)
                      : null,
                ),
              ),
            ],
          ),
        ];
      },
    );
  }
}

class ApiReferralPage extends ConsumerWidget {
  const ApiReferralPage({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => ApiEngagementView(
    title: 'Referral program',
    path: '/referrals/me',
    builder: (r) => [
      DtReveal(
        child: SurfaceCard(
          color: dtColor(context, DtColors.softMint),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                Icons.people_outline_rounded,
                size: 36,
                color: dtColor(context, DtColors.navy),
              ),
              const SizedBox(height: 22),
              Text(
                'Good things\nare better shared.',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 12),
              const Text('Invite a friend to a simpler exchange experience.'),
            ],
          ),
        ),
      ),
      const SizedBox(height: 24),
      const SectionHeading('Your invitation'),
      SurfaceCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Referral code'),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: Text(
                    r['code'],
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w600,
                      color: dtColor(context, DtColors.navy),
                    ),
                  ),
                ),
                CopyControl(value: r['code']),
              ],
            ),
            Divider(height: 28, color: dtColor(context, DtColors.border)),
            if (r['inviteLink'] != null) ...[
              SelectableText(
                r['inviteLink'],
                style: const TextStyle(fontSize: 12),
              ),
              CopyControl(value: r['inviteLink'], label: 'Copy link'),
              const SizedBox(height: 12),
              DtButton(
                label: 'Share invitation',
                icon: Icons.ios_share_rounded,
                onPressed: () async {
                  try {
                    final box = context.findRenderObject() as RenderBox?;
                    await SharePlus.instance.share(
                      ShareParams(
                        text: 'Discover DT Exchange. ${r['inviteLink']}',
                        sharePositionOrigin: box == null
                            ? null
                            : box.localToGlobal(Offset.zero) & box.size,
                      ),
                    );
                  } catch (_) {
                    if (context.mounted) {
                      toast(context, 'Copy your invite link to share.');
                    }
                  }
                },
              ),
            ] else
              const InfoNote(
                'Invite links are not yet configured. You can share your code.',
              ),
          ],
        ),
      ),
      const SizedBox(height: 20),
      SurfaceCard(
        child: Column(
          children: [
            DetailRow('Total referrals', '${r['totalReferrals']}'),
            DetailRow('Qualified referrals', '${r['qualifiedReferrals']}'),
            DetailRow(
              'Rewards earned',
              PreviewMoney.inr(BigInt.parse(r['rewardsEarnedMinor'])),
              strong: true,
            ),
          ],
        ),
      ),
      const SizedBox(height: 20),
      if (r['enabled'] != true)
        const InfoNote('The referral campaign is currently paused.'),
      if ((r['history'] as List).isEmpty)
        const InfoNote(
          'No referrals yet. Your eligible invitations will appear here.',
        ),
      for (final h in r['history'])
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: SurfaceCard(
            child: DetailRow(
              'Referral ${h['id'].toString().substring(0, 8)}',
              h['lifecycle'],
            ),
          ),
        ),
      const InfoNote(
        'Rewards follow the active campaign rules and are recorded in the ledger. They do not change your sell-order payout.',
      ),
    ],
  );
}

class ApiSupportPage extends ConsumerWidget {
  const ApiSupportPage({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final faq = ref.watch(engagementData('/support/faq'));
    final signedIn = ref.watch(previewProvider).signedIn;
    return ApiEngagementView(
      title: 'Help & Support',
      leading: const [TelegramSupportCard(), SizedBox(height: 16)],
      path: signedIn ? '/support/tickets' : '/support/faq',
      builder: (response) {
        final items = signedIn ? response : <dynamic>[];
        return [
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
          faq.when(
            loading: () => const DtSkeleton(height: 160),
            error: (e, s) => InfoNote(apiMessage(e)),
            data: (rows) => SurfaceCard(
              child: Column(
                children: [
                  if ((rows as List).isEmpty)
                    const Text('Help articles are being prepared.'),
                  for (final q in rows)
                    ExpansionTile(
                      tilePadding: EdgeInsets.zero,
                      title: Text(
                        q['question'],
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      children: [
                        Padding(
                          padding: const EdgeInsets.only(bottom: 16),
                          child: Text(
                            q['answer'],
                            style: const TextStyle(fontSize: 12, height: 1.7),
                          ),
                        ),
                      ],
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          const SectionHeading('Your tickets'),
          if ((items as List).isEmpty)
            const SurfaceCard(
              child: DtEmptyState(
                title: 'No tickets yet',
                description: 'Your support requests will appear here.',
              ),
            ),
          for (final t in items) ...[
            SurfaceCard(
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(t['subject']),
                subtitle: Text('${t['category']} · ${t['status']}'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => context.push('/support/tickets/${t['id']}'),
              ),
            ),
            const SizedBox(height: 12),
          ],
        ];
      },
    );
  }
}

class ApiTicketForm extends ConsumerStatefulWidget {
  const ApiTicketForm({this.id, super.key});
  final String? id;
  @override
  ConsumerState<ApiTicketForm> createState() => _TicketFormState();
}

class _TicketFormState extends ConsumerState<ApiTicketForm> {
  final subject = TextEditingController(), message = TextEditingController();
  String category = 'OTHER';
  bool busy = false;
  String? error;
  String keyValue = requestKey();
  @override
  void dispose() {
    subject.dispose();
    message.dispose();
    super.dispose();
  }

  Future<void> send() async {
    if (message.text.trim().length < (widget.id == null ? 10 : 1) ||
        widget.id == null && subject.text.trim().length < 3) {
      setState(() => error = 'Enter a subject and a detailed message.');
      return;
    }
    setState(() => busy = true);
    try {
      final api = ref.read(apiSessionProvider);
      final r = await api.request(
        widget.id == null
            ? '/support/tickets'
            : '/support/tickets/${widget.id}/replies',
        method: 'POST',
        data: widget.id == null
            ? {
                'subject': subject.text.trim(),
                'message': message.text.trim(),
                'category': category,
              }
            : {'message': message.text.trim()},
        idempotencyKey: keyValue,
      );
      message.clear();
      keyValue = requestKey();
      ref.invalidate(engagementData('/support/tickets'));
      if (!mounted) return;
      if (widget.id == null) {
        context.go('/support/tickets/${r['id']}');
      } else {
        ref.invalidate(engagementData('/support/tickets/${widget.id}'));
      }
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  List<Widget> fields() => [
    if (error != null) InfoNote(error!),
    SurfaceCard(
      child: Column(
        children: [
          if (widget.id == null) ...[
            DropdownButtonFormField<String>(
              initialValue: category,
              isExpanded: true,
              items: [
                for (final c in [
                  'ACCOUNT',
                  'BANK_ACCOUNT',
                  'USDT_DEPOSIT',
                  'SELL_ORDER',
                  'PAYOUT',
                  'TRANSACTION_DELAY',
                  'SECURITY',
                  'REFERRAL',
                  'TECHNICAL_ISSUE',
                  'OTHER',
                ])
                  DropdownMenuItem(
                    value: c,
                    child: Text(c.replaceAll('_', ' ')),
                  ),
              ],
              onChanged: (v) => setState(() => category = v!),
              decoration: const InputDecoration(labelText: 'Category'),
            ),
            const SizedBox(height: 18),
            TextField(
              controller: subject,
              maxLength: 160,
              decoration: const InputDecoration(labelText: 'Subject'),
            ),
            const SizedBox(height: 18),
          ],
          TextField(
            controller: message,
            minLines: 4,
            maxLines: 8,
            maxLength: 5000,
            decoration: InputDecoration(
              labelText: widget.id == null ? 'Message' : 'Your reply',
            ),
          ),
          const SizedBox(height: 18),
          DtButton(
            label: widget.id == null ? 'Create ticket' : 'Send reply',
            onPressed: busy ? null : send,
          ),
        ],
      ),
    ),
    const SizedBox(height: 16),
    const InfoNote(
      'Do not share passwords, OTPs or wallet private keys. Private attachment storage is not yet configured.',
    ),
  ];
  @override
  Widget build(BuildContext context) {
    if (widget.id == null) {
      return AppPage(title: 'Create support ticket', children: fields());
    }
    return ApiEngagementView(
      title: 'Support ticket',
      path: '/support/tickets/${widget.id}',
      builder: (t) => [
        SurfaceCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(t['subject'], style: Theme.of(context).textTheme.titleLarge),
              DetailRow('Status', t['status']),
              DetailRow('Category', t['category']),
            ],
          ),
        ),
        const SizedBox(height: 18),
        for (final m in t['messages']) ...[
          DtReveal(
            child: SurfaceCard(
              color: m['authorType'] == 'ADMIN'
                  ? dtColor(context, DtColors.softBlue)
                  : dtColor(context, DtColors.white),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    m['authorType'] == 'ADMIN' ? 'DT Exchange Support' : 'You',
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 8),
                  Text(m['message']),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
        ],
        if (!['CLOSED', 'RESOLVED'].contains(t['status'])) ...[
          ...fields(),
          DtButton(
            label: 'Close ticket',
            style: DtButtonStyle.secondary,
            onPressed: () async {
              try {
                await ref
                    .read(apiSessionProvider)
                    .request(
                      '/support/tickets/${widget.id}/close',
                      method: 'POST',
                    );
                ref.invalidate(engagementData('/support/tickets/${widget.id}'));
              } catch (e) {
                if (context.mounted) toast(context, apiMessage(e));
              }
            },
          ),
        ],
      ],
    );
  }
}

class ApiPreferencesPage extends ConsumerWidget {
  const ApiPreferencesPage({required this.notifications, super.key});
  final bool notifications;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final path = notifications ? '/notifications/preferences' : '/settings';
    return ApiEngagementView(
      title: notifications ? 'Notification preferences' : 'App preferences',
      path: path,
      builder: (result) {
        final data = notifications ? result : result['preferences'];
        final items = notifications
            ? {
                'push': 'Push notifications',
                'email': 'Email notifications',
                'sms': 'SMS notifications',
                'transactions': 'Transaction alerts',
                'security': 'Security alerts',
                'referrals': 'Referral alerts',
                'support': 'Support updates',
              }
            : {'animations': 'Animations', 'haptics': 'Haptic feedback'};
        return [
          SurfaceCard(
            child: Column(
              children: [
                for (final item in items.entries)
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(
                      item.value,
                      style: const TextStyle(fontSize: 14),
                    ),
                    value: data[item.key] == true,
                    onChanged: item.key == 'security'
                        ? null
                        : (v) async {
                            try {
                              await ref
                                  .read(apiSessionProvider)
                                  .request(
                                    notifications
                                        ? path
                                        : '/settings/preferences',
                                    method: 'PATCH',
                                    data: {item.key: v},
                                  );
                              ref.invalidate(engagementData(path));
                              if (item.key == 'animations') {
                                ref
                                    .read(previewProvider.notifier)
                                    .preference('motion', !v);
                              }
                            } catch (e) {
                              if (context.mounted) {
                                toast(context, apiMessage(e));
                              }
                            }
                          },
                  ),
                if (!notifications) ...[
                  const AppearancePicker(),
                  const DetailRow('Language', 'English'),
                ],
              ],
            ),
          ),
          const SizedBox(height: 20),
          InfoNote(
            notifications
                ? 'Security alerts remain enabled. External delivery depends on configured providers.'
                : 'Appearance is saved on this device. Other preferences are saved to your account.',
          ),
        ];
      },
    );
  }
}

class ApiSecurityForm extends ConsumerStatefulWidget {
  const ApiSecurityForm({required this.delete, super.key});
  final bool delete;
  @override
  ConsumerState<ApiSecurityForm> createState() => _SecurityFormState();
}

class _SecurityFormState extends ConsumerState<ApiSecurityForm> {
  final password = TextEditingController(),
      value = TextEditingController(),
      confirm = TextEditingController();
  bool busy = false, done = false;
  String? error;
  @override
  void dispose() {
    password.dispose();
    value.dispose();
    confirm.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AppPage(
    title: widget.delete ? 'Delete account' : 'Security PIN',
    children: [
      if (done) ...[
        const Center(child: SuccessMark()),
        const Text('Security PIN configured', textAlign: TextAlign.center),
      ] else ...[
        InfoNote(
          widget.delete
              ? 'Your account will be deactivated after outstanding transactions and balances are resolved. Required financial and audit records are retained.'
              : 'Your PIN is stored as a secure hash. It does not replace account authentication.',
        ),
        const SizedBox(height: 24),
        if (error != null) InfoNote(error!),
        SurfaceCard(
          child: Column(
            children: [
              TextField(
                controller: password,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Current password',
                ),
              ),
              const SizedBox(height: 18),
              TextField(
                controller: value,
                obscureText: !widget.delete,
                keyboardType: widget.delete
                    ? TextInputType.text
                    : TextInputType.number,
                decoration: InputDecoration(
                  labelText: widget.delete ? 'Reason' : 'New 6-digit PIN',
                ),
              ),
              const SizedBox(height: 18),
              TextField(
                controller: confirm,
                obscureText: !widget.delete,
                decoration: InputDecoration(
                  labelText: widget.delete ? 'Type DELETE' : 'Confirm PIN',
                ),
              ),
              const SizedBox(height: 24),
              DtButton(
                label: widget.delete ? 'Request account deletion' : 'Set PIN',
                style: widget.delete
                    ? DtButtonStyle.danger
                    : DtButtonStyle.primary,
                onPressed: busy
                    ? null
                    : () async {
                        if (widget.delete
                            ? confirm.text != 'DELETE'
                            : !RegExp(r'^\d{6}$').hasMatch(value.text) ||
                                  value.text != confirm.text) {
                          setState(() => error = 'Check your confirmation.');
                          return;
                        }
                        setState(() => busy = true);
                        try {
                          await ref
                              .read(apiSessionProvider)
                              .request(
                                widget.delete
                                    ? '/settings/delete-account'
                                    : '/settings/pin',
                                method: 'POST',
                                data: widget.delete
                                    ? {
                                        'password': password.text,
                                        'reason': value.text,
                                      }
                                    : {
                                        'password': password.text,
                                        'pin': value.text,
                                      },
                              );
                          password.clear();
                          value.clear();
                          confirm.clear();
                          ref.invalidate(engagementData('/settings'));
                          if (!context.mounted) return;
                          if (widget.delete) {
                            await ref.read(apiSessionProvider).clear();
                            ref.read(previewProvider.notifier).logout();
                            if (context.mounted) context.go('/login');
                          } else {
                            setState(() => done = true);
                          }
                        } catch (e) {
                          if (mounted) setState(() => error = apiMessage(e));
                        } finally {
                          if (mounted) setState(() => busy = false);
                        }
                      },
              ),
            ],
          ),
        ),
      ],
    ],
  );
}

class ApiLegalPage extends ConsumerWidget {
  const ApiLegalPage({required this.kind, super.key});
  final String kind;
  @override
  Widget build(BuildContext context, WidgetRef ref) => ApiEngagementView(
    title: kind == 'privacy' ? 'Privacy Policy' : 'Terms & Conditions',
    path: '/settings/legal/$kind',
    builder: (d) => [
      if (d['status'] != 'PUBLISHED')
        const InfoNote('This policy is not yet published for production.'),
      if (d['status'] == 'PUBLISHED') SurfaceCard(child: Text(d['body'] ?? '')),
    ],
  );
}
