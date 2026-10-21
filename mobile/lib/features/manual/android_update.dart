import 'package:dt_exchange/core/design/appearance.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api/api_client.dart';
import '../../core/api/app_version.dart';
import '../../core/presentation/kit.dart';

bool approvedDownloadUrl(String value, String officialOrigin) {
  final u = Uri.tryParse(value), origin = Uri.tryParse(officialOrigin);
  return u != null &&
      origin != null &&
      origin.scheme == 'https' &&
      origin.hasAuthority &&
      u.scheme == 'https' &&
      u.origin == origin.origin &&
      u.userInfo.isEmpty &&
      !u.hasQuery &&
      !u.hasFragment &&
      u.path == '/download';
}

bool updateRequired(Map<String, dynamic> data, int current) =>
    data['available'] == true &&
    (current < (data['minimumVersionCode'] as int? ?? 0) ||
        (data['mandatory'] == true &&
            current < (data['latestVersionCode'] as int? ?? 0)));

class AndroidUpdateGate extends ConsumerStatefulWidget {
  const AndroidUpdateGate({required this.child, super.key});
  final Widget child;
  @override
  ConsumerState<AndroidUpdateGate> createState() => _UpdateState();
}

class _UpdateState extends ConsumerState<AndroidUpdateGate> {
  Map<String, dynamic>? release;
  bool dismissed = false;
  String? error;
  static const enabled = bool.fromEnvironment('ANDROID_UPDATES_ENABLED');
  static const current = appVersionCode;
  static const origin = String.fromEnvironment('OFFICIAL_DOWNLOAD_ORIGIN');
  @override
  void initState() {
    super.initState();
    if (enabled) load();
  }

  Future<void> load() async {
    try {
      final d = Map<String, dynamic>.from(
        await ref
            .read(apiSessionProvider)
            .request('/app/version/android', authenticated: false),
      );
      if (d['available'] == true &&
          !approvedDownloadUrl(d['downloadUrl'] ?? '', origin)) {
        throw StateError('Update address could not be verified.');
      }
      if (mounted) setState(() => release = d);
    } catch (e) {
      if (mounted) {
        setState(
          () => error =
              'Unable to check the app version. Please reconnect and try again.',
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!enabled) return widget.child;
    final required = release != null && updateRequired(release!, current);
    final newer =
        release?['available'] == true &&
        (release!['latestVersionCode'] as int) > current;
    final unavailable = release == null;
    if (!required && !unavailable && (!newer || dismissed)) return widget.child;
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
                      Icons.system_update,
                      color: DtColors.teal,
                      size: 48,
                    ),
                    const SizedBox(height: 20),
                    Text(
                      unavailable
                          ? 'Checking app version'
                          : required
                          ? 'Update Required'
                          : 'DT Exchange Update Available',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      unavailable
                          ? (error ?? 'Checking secure release information…')
                          : required
                          ? 'For your security, update DT Exchange to continue.'
                          : release!['releaseNotes'] ?? '',
                    ),
                    const SizedBox(height: 24),
                    if (unavailable)
                      DtButton(label: 'Try again', onPressed: load)
                    else
                      DtButton(
                        label: required
                            ? 'Download Latest Version'
                            : 'Update Now',
                        onPressed: () async {
                          final value = release!['downloadUrl'] as String;
                          if (approvedDownloadUrl(value, origin)) {
                            await launchUrl(
                              Uri.parse(value),
                              mode: LaunchMode.externalApplication,
                            );
                          }
                        },
                      ),
                    if (!required && !unavailable)
                      TextButton(
                        onPressed: () => setState(() => dismissed = true),
                        child: const Text('Later'),
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
