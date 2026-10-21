import 'package:dt_exchange/core/design/appearance.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/presentation/kit.dart';
import '../engagement/engagement_pages.dart';
import '../../core/api/api_client.dart';
import '../../preview/preview_controller.dart';

final payoutNoticesProvider = FutureProvider.autoDispose<List<dynamic>>(
  (ref) async => List<dynamic>.from(
    await ref.read(apiSessionProvider).request('/notifications'),
  ),
);

class NotificationsPage extends ConsumerWidget {
  const NotificationsPage({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(previewModeProvider)) return const ApiNotificationsPage();
    final s = ref.watch(previewProvider);
    return AppPage(
      title: 'Notifications',
      actions: [
        IconButton(
          tooltip: 'Mark all as read',
          onPressed: s.unread == 0
              ? null
              : () => ref.read(previewProvider.notifier).markAllRead(),
          icon: const Icon(Icons.done_all_rounded),
        ),
      ],
      children: [
        SectionHeading(
          s.unread == 0 ? 'You’re all caught up' : '${s.unread} unread updates',
        ),
        for (final n in s.notices) ...[
          DtReveal(
            child: SurfaceCard(
              color: n.read
                  ? dtColor(context, DtColors.white)
                  : dtColor(context, DtColors.softBlue),
              padding: const EdgeInsets.all(18),
              child: InkWell(
                borderRadius: BorderRadius.circular(16),
                onTap: () {
                  ref.read(previewProvider.notifier).markRead(n.id);
                  context.push(n.route);
                },
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(11),
                      decoration: BoxDecoration(
                        color: dtColor(context, DtColors.white),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Icon(
                        n.id == 'n3'
                            ? Icons.waving_hand_outlined
                            : Icons.notifications_none_rounded,
                        color: dtColor(context, DtColors.navy),
                        size: 22,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            n.title,
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: dtColor(context, DtColors.navy),
                            ),
                          ),
                          const SizedBox(height: 7),
                          Text(n.body, style: const TextStyle(fontSize: 12)),
                          const SizedBox(height: 10),
                          Text(
                            n.time,
                            style: TextStyle(
                              fontSize: 10,
                              color: dtColor(context, DtColors.muted),
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (!n.read)
                      const Padding(
                        padding: EdgeInsets.only(left: 8, top: 5),
                        child: Icon(
                          Icons.circle,
                          size: 7,
                          color: DtColors.teal,
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),
        ],
        const SizedBox(height: 10),
        DtButton(
          label: 'Manage notification preferences',
          style: DtButtonStyle.secondary,
          onPressed: () => context.push('/settings/notifications'),
        ),
      ],
    );
  }
}
