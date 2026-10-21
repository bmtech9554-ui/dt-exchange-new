import 'package:dt_exchange/core/design/appearance.dart';
import '../support/telegram_support.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api/api_client.dart';
import '../../core/presentation/kit.dart';

final publicConfigurationProvider = FutureProvider<Map<String, dynamic>>((
  ref,
) async {
  return Map<String, dynamic>.from(
    await ref
        .read(apiSessionProvider)
        .request('/app/configuration', authenticated: false),
  );
});

class MaintenanceGate extends ConsumerStatefulWidget {
  const MaintenanceGate({required this.child, super.key});
  final Widget child;
  @override
  ConsumerState<MaintenanceGate> createState() => _MaintenanceGateState();
}

class _MaintenanceGateState extends ConsumerState<MaintenanceGate>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref.invalidate(publicConfigurationProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
    final config = ref.watch(publicConfigurationProvider);
    final value = config.asData?.value;
    final maintenance = value?['maintenance'];
    final blocked =
        maintenance is Map &&
        (maintenance['app'] == true || maintenance['api'] == true);

    final public = value?['config'];
    final candidate = public is Map ? public['telegram'] : null;
    final telegram =
        candidate is String &&
            RegExp(r'^[A-Za-z][A-Za-z0-9_]{4,31}$').hasMatch(candidate)
        ? candidate
        : 'dtexchange';
    if (value != null && !blocked) {
      return ProviderScope(
        overrides: [telegramUsernameProvider.overrideWithValue(telegram)],
        child: widget.child,
      );
    }
    final message = blocked && maintenance['message'] is String
        ? maintenance['message'] as String
        : config.hasError
        ? 'Unable to check service availability. Please reconnect and try again.'
        : 'Checking service availability…';
    return Material(
      color: dtColor(context, DtColors.background),
      child: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: SurfaceCard(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.build_circle_outlined,
                      color: DtColors.teal,
                      size: 48,
                    ),
                    const SizedBox(height: 20),
                    Text(
                      blocked ? 'We’ll be back shortly' : 'DT Exchange',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 16),
                    Text(message, textAlign: TextAlign.center),
                    const SizedBox(height: 24),
                    if (!config.isLoading)
                      DtButton(
                        label: 'Retry',
                        onPressed: () =>
                            ref.invalidate(publicConfigurationProvider),
                      ),
                    TextButton(
                      onPressed: () async {
                        for (final uri in [
                          Uri.parse('tg://resolve?domain=$telegram'),
                          Uri.https('t.me', '/$telegram'),
                        ]) {
                          try {
                            if (await launchUrl(
                              uri,
                              mode: LaunchMode.externalApplication,
                            )) {
                              return;
                            }
                          } catch (_) {}
                        }
                      },
                      child: Text('Telegram Support @$telegram'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
