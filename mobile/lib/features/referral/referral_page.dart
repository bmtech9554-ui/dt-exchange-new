import 'package:dt_exchange/core/design/appearance.dart';
import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/presentation/kit.dart';
import '../../preview/fixtures.dart';

class ReferralPage extends StatelessWidget {
  const ReferralPage({super.key});
  Future<void> share(BuildContext context) async {
    final box = context.findRenderObject() as RenderBox?;
    try {
      await SharePlus.instance.share(
        ShareParams(
          text:
              'Discover DT Exchange. Sell USDT. Receive INR. Preview invite: $previewReferralLink',
          subject: 'Your DT Exchange preview invitation',
          sharePositionOrigin: box == null
              ? null
              : box.localToGlobal(Offset.zero) & box.size,
        ),
      );
    } catch (_) {
      if (context.mounted) {
        toast(
          context,
          'Sharing is unavailable. Copy your invite link instead.',
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) => AppPage(
    title: 'Referral program',
    children: [
      DtReveal(
        child: SurfaceCard(
          color: dtColor(context, DtColors.softMint),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: dtColor(context, DtColors.white),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.people_outline_rounded,
                  size: 32,
                  color: dtColor(context, DtColors.navy),
                ),
              ),
              const SizedBox(height: 22),
              Text(
                'Good things\nare better shared.',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 12),
              const Text(
                'Invite a friend to a simpler exchange experience.',
                style: TextStyle(fontSize: 14),
              ),
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
            const Text('Referral code', style: TextStyle(fontSize: 12)),
            const SizedBox(height: 6),
            Row(
              children: [
                Expanded(
                  child: Text(
                    'DTASHIK20',
                    style: TextStyle(
                      fontSize: 24,
                      letterSpacing: 1,
                      fontWeight: FontWeight.w600,
                      color: dtColor(context, DtColors.navy),
                    ),
                  ),
                ),
                CopyControl(value: 'DTASHIK20'),
              ],
            ),
            Divider(color: dtColor(context, DtColors.border), height: 28),
            const Text('Invite link', style: TextStyle(fontSize: 12)),
            const SizedBox(height: 8),
            SelectableText(
              previewReferralLink,
              style: TextStyle(
                fontSize: 12,
                color: dtColor(context, DtColors.navy),
              ),
            ),
            const Align(
              alignment: Alignment.centerRight,
              child: CopyControl(
                value: previewReferralLink,
                label: 'Copy link',
              ),
            ),
            const SizedBox(height: 12),
            Builder(
              builder: (c) => DtButton(
                label: 'Share invitation',
                icon: Icons.ios_share_rounded,
                onPressed: () => share(c),
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: 20),
      Row(
        children: [
          Expanded(
            child: SurfaceCard(
              padding: EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Total referrals', style: TextStyle(fontSize: 11)),
                  SizedBox(height: 10),
                  Text(
                    '12',
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w600,
                      color: dtColor(context, DtColors.navy),
                    ),
                  ),
                ],
              ),
            ),
          ),
          SizedBox(width: 14),
          Expanded(
            child: SurfaceCard(
              padding: EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Sample rewards', style: TextStyle(fontSize: 11)),
                  SizedBox(height: 10),
                  Text(
                    '₹600',
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w600,
                      color: dtColor(context, DtColors.navy),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
      const SizedBox(height: 24),
      const SectionHeading('How it works'),
      const SurfaceCard(
        child: Column(
          children: [
            _ReferralStep(
              '01',
              'Share your link',
              'Send your invitation to a friend.',
            ),
            _ReferralStep(
              '02',
              'They get started',
              'Your friend activates their account.',
            ),
            _ReferralStep(
              '03',
              'Track rewards',
              'Eligible activity appears in your rewards.',
            ),
          ],
        ),
      ),
      const SizedBox(height: 20),
      const InfoNote(
        'Sample referral activity only. The example.com link is a preview; no rewards can be redeemed.',
      ),
    ],
  );
}

class _ReferralStep extends StatelessWidget {
  const _ReferralStep(this.number, this.title, this.body);
  final String number, title, body;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 10),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          number,
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            color: DtColors.teal,
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: dtColor(context, DtColors.navy),
                ),
              ),
              const SizedBox(height: 4),
              Text(body, style: const TextStyle(fontSize: 12)),
            ],
          ),
        ),
      ],
    ),
  );
}
