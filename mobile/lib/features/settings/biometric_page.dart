import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/presentation/kit.dart';
import '../../core/storage/session_store.dart';

final biometricPreferenceProvider = FutureProvider<bool>(
  (ref) => ref.watch(sessionStoreProvider).biometricEnabled(),
);

class BiometricPage extends ConsumerStatefulWidget {
  const BiometricPage({super.key});
  @override
  ConsumerState<BiometricPage> createState() => _BiometricPageState();
}

class _BiometricPageState extends ConsumerState<BiometricPage> {
  bool busy = false;
  String? error;
  @override
  Widget build(BuildContext context) {
    final enabled = ref.watch(biometricPreferenceProvider);
    return AppPage(
      title: 'Biometric login',
      children: [
        const Icon(Icons.fingerprint_rounded, size: 56),
        const SizedBox(height: 20),
        const Text(
          'Use your enrolled fingerprint or face to unlock your saved DT Exchange session. Your device handles biometric data securely.',
        ),
        const SizedBox(height: 20),
        SurfaceCard(
          child: SwitchListTile(
            title: const Text('Biometric login'),
            value: enabled.asData?.value ?? false,
            onChanged: busy || !enabled.hasValue
                ? null
                : (value) async {
                    setState(() {
                      busy = true;
                      error = null;
                    });
                    try {
                      await ref.read(sessionStoreProvider).setBiometric(value);
                      ref.invalidate(biometricPreferenceProvider);
                    } catch (e) {
                      if (mounted) {
                        setState(
                          () => error = e is StateError
                              ? e.message
                              : 'Biometrics are unavailable. Try normal sign in.',
                        );
                      }
                    } finally {
                      if (mounted) setState(() => busy = false);
                    }
                  },
          ),
        ),
        if (error != null) InfoNote(error!),
        const InfoNote(
          'You can always sign in with your existing password or OTP. Expired or revoked sessions still require normal authentication.',
        ),
      ],
    );
  }
}
