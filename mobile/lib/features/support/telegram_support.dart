import 'package:dt_exchange/core/design/appearance.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/presentation/kit.dart';

final telegramUsernameProvider = Provider<String>((ref) => 'dtexchange');

final telegramSupportDeepLink = Uri.parse('tg://resolve?domain=dtexchange');
final telegramSupportUri = Uri.https('t.me', '/dtexchange');
// Only public links; launching does not authenticate or send a message.
final telegramSupportLauncherProvider = Provider<Future<bool> Function(Uri)>(
  (ref) =>
      (uri) => launchUrl(uri, mode: LaunchMode.externalApplication),
);

class TelegramSupportCard extends ConsumerStatefulWidget {
  const TelegramSupportCard({super.key});
  @override
  ConsumerState<TelegramSupportCard> createState() => _TelegramSupportState();
}

class _TelegramSupportState extends ConsumerState<TelegramSupportCard> {
  bool opening = false;
  String get username {
    final value = ref.read(telegramUsernameProvider);
    return RegExp(r'^[A-Za-z][A-Za-z0-9_]{4,31}$').hasMatch(value)
        ? value
        : 'dtexchange';
  }

  Future<void> openSupport() async {
    setState(() => opening = true);
    try {
      final launch = ref.read(telegramSupportLauncherProvider);
      var opened = false;
      for (final uri in [
        Uri.parse('tg://resolve?domain=$username'),
        Uri.https('t.me', '/$username'),
      ]) {
        try {
          opened = await launch(uri).timeout(const Duration(seconds: 3));
        } catch (_) {
          // A missing handler or launch failure falls back to public HTTPS.
        }
        if (opened || !mounted) break;
      }
      if (!opened && mounted) showError();
    } catch (_) {
      if (mounted) showError();
    } finally {
      if (mounted) setState(() => opening = false);
    }
  }

  void showError() => toast(
    context,
    'Could not open Telegram. Please try https://t.me/$username in your browser.',
  );

  @override
  Widget build(BuildContext context) => SurfaceCard(
    color: dtColor(context, DtColors.softBlue),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Need help? Contact DT Exchange Support on Telegram.'),
        const SizedBox(height: 12),
        Semantics(
          label:
              'Contact DT Exchange Support on Telegram, @$username. Opens an external app or browser.',
          child: SizedBox(
            width: double.infinity,
            child: DtButton(
              onPressed: opening ? null : openSupport,
              loading: opening,
              icon: Icons.telegram,
              label: 'Telegram Support',
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text('@$username'),
      ],
    ),
  );
}
