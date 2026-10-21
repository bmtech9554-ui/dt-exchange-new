import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api/api_client.dart';
import '../../core/presentation/kit.dart';

final referralOverviewProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>(
      (ref) async => Map<String, dynamic>.from(
        await ref.read(apiSessionProvider).request('/referrals/me'),
      ),
    );

class ProductionReferralPage extends ConsumerWidget {
  const ProductionReferralPage({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final response = ref.watch(referralOverviewProvider);
    return AppPage(
      title: 'Referral Program',
      onRefresh: () async {
        ref.invalidate(referralOverviewProvider);
        await ref.read(referralOverviewProvider.future);
      },
      children: response.when(
        loading: () => [const DtSkeleton(height: 280)],
        error: (e, _) => [
          InfoNote(apiMessage(e)),
          DtButton(
            label: 'Retry',
            onPressed: () => ref.invalidate(referralOverviewProvider),
          ),
        ],
        data: (r) {
          final policy = r['registrationPolicy'] as Map?;
          final link = r['inviteLink'] as String?;
          Future<void> share(String channel) async {
            if (link == null) return;
            final message =
                'Join DT Exchange with my referral code ${r['code']}. $link';
            try {
              if (channel == 'share') {
                final box = context.findRenderObject() as RenderBox?;
                await SharePlus.instance.share(
                  ShareParams(
                    text: message,
                    subject: 'DT Exchange invitation',
                    sharePositionOrigin: box == null
                        ? null
                        : box.localToGlobal(Offset.zero) & box.size,
                  ),
                );
                return;
              }
              final uri = switch (channel) {
                'WhatsApp' => Uri.https('wa.me', '/', {'text': message}),
                'Telegram' => Uri.https('t.me', '/share/url', {
                  'url': link,
                  'text': 'Join DT Exchange',
                }),
                _ => Uri(
                  scheme: 'mailto',
                  query:
                      'subject=${Uri.encodeComponent('DT Exchange invitation')}&body=${Uri.encodeComponent(message)}',
                ),
              };
              if (!await launchUrl(uri, mode: LaunchMode.externalApplication) &&
                  context.mounted) {
                toast(
                  context,
                  'Unable to open sharing. Copy your link instead.',
                );
              }
            } catch (_) {
              if (context.mounted) {
                toast(
                  context,
                  'Sharing is unavailable. Copy your invite link instead.',
                );
              }
            }
          }

          return [
            SurfaceCard(
              color: DtColors.softMint,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _ReferralGift(),
                  const SizedBox(height: 12),
                  Text(
                    'Invite & Earn',
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                  const SizedBox(height: 10),
                  Text(
                    policy?['enabled'] == true
                        ? 'Earn ${policy!['rewardUsdt']} USDT when a friend registers with your code and completes OTP verification.'
                        : 'Referral rewards are currently unavailable.',
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'Rewards are held separately for manual release. They do not automatically credit your spendable wallet.',
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            SurfaceCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Your Referral Code'),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: SelectableText(
                          r['code'] ?? '',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ),
                      CopyControl(value: r['code'] ?? ''),
                    ],
                  ),
                  const SizedBox(height: 16),
                  DtButton(
                    label: 'Share & Invite Friends',
                    icon: Icons.ios_share_rounded,
                    onPressed: link == null ? null : () => share('share'),
                  ),
                  if (link != null) ...[
                    const SizedBox(height: 16),
                    const Text('Referral Link'),
                    SelectableText(link),
                    CopyControl(value: link, label: 'Copy'),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final channel in ['WhatsApp', 'Telegram', 'Email'])
                          OutlinedButton(
                            onPressed: () => share(channel),
                            child: Text(channel),
                          ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 20),
            SurfaceCard(
              child: Column(
                children: [
                  DetailRow('Referrals', '${r['totalReferrals'] ?? 0}'),
                  DetailRow(
                    'Total Earned',
                    '${r['totalEarnedUsdt'] ?? '0'} USDT',
                  ),
                  DetailRow(
                    'Available Referral Balance',
                    '${r['availableReferralBalanceUsdt'] ?? '0'} USDT',
                  ),
                  const Text(
                    'Pending manual release',
                    style: TextStyle(fontSize: 12),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            const SectionHeading('Referral History'),
            if ((r['history'] as List? ?? []).isEmpty)
              const SurfaceCard(
                child: DtEmptyState(
                  title: 'Your invitations start here',
                  description:
                      'Eligible registrations and rewards will appear here.',
                ),
              ),
            for (final h in r['history'] as List? ?? []) ...[
              SurfaceCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('User ${h['referred_public_user_id'] ?? '—'}'),
                    Text(
                      DateTime.tryParse(
                            h['created_at'] ?? '',
                          )?.toLocal().toString().split('.').first ??
                          '',
                    ),
                    Text('${h['reward_usdt'] ?? '0'} USDT'),
                    Text(
                      (h['reward_status'] ?? h['lifecycle'] ?? '')
                          .toString()
                          .replaceAll('_', ' '),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],
            if ((r['legacyHistory'] as List? ?? []).isNotEmpty) ...[
              const SectionHeading('Earlier referral program'),
              const Text(
                'Earlier rewards retain their original currency and recorded terms.',
              ),
              for (final h in r['legacyHistory'] as List)
                SurfaceCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(h['created_at']?.toString() ?? ''),
                      Text('Reward: ${_minorInr(h['reward_inr_minor'])} INR'),
                      Text(
                        h['lifecycle']?.toString().replaceAll('_', ' ') ?? '',
                      ),
                    ],
                  ),
                ),
            ],
          ];
        },
      ),
    );
  }
}

String _minorInr(dynamic value) {
  final minor = BigInt.tryParse(value?.toString() ?? '0') ?? BigInt.zero;
  return '${minor ~/ BigInt.from(100)}.${(minor % BigInt.from(100)).toString().padLeft(2, '0')}';
}

class _ReferralGift extends StatefulWidget {
  const _ReferralGift();
  @override
  State<_ReferralGift> createState() => _ReferralGiftState();
}

class _ReferralGiftState extends State<_ReferralGift>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late final animation = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 5),
  );
  bool foreground = true;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  void sync() {
    if (foreground &&
        TickerMode.valuesOf(context).enabled &&
        !MediaQuery.disableAnimationsOf(context)) {
      if (!animation.isAnimating) animation.repeat();
    } else {
      animation.stop();
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    sync();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    foreground = state == AppLifecycleState.resumed;
    sync();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    animation.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => RepaintBoundary(
    child: SizedBox(
      width: 100,
      height: 86,
      child: AnimatedBuilder(
        animation: animation,
        builder: (_, _) => Stack(
          alignment: Alignment.center,
          children: [
            Transform.translate(
              offset: Offset(0, math.sin(animation.value * math.pi * 2) * 3),
              child: const Icon(
                Icons.card_giftcard_rounded,
                color: DtColors.teal,
                size: 60,
              ),
            ),
            Transform.translate(
              offset: Offset(
                math.cos(animation.value * math.pi * 2) * 42,
                math.sin(animation.value * math.pi * 2) * 30,
              ),
              child: const Icon(
                Icons.auto_awesome,
                color: DtColors.blue,
                size: 15,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
