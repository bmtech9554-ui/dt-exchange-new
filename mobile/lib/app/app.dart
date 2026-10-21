import '../features/manual/maintenance_gate.dart';
import '../features/manual/android_update.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/design/theme.dart';
import '../core/design/appearance.dart';
import '../preview/preview_controller.dart';
import 'router.dart';
import '../public_test/test_mode.dart';

class DtExchangeApp extends ConsumerWidget {
  const DtExchangeApp({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reduced = ref.watch(previewProvider.select((s) => s.reducedMotion));
    return MaterialApp.router(
      title: 'DT Exchange',
      debugShowCheckedModeBanner: false,
      theme: dtLightTheme,
      darkTheme: dtDarkTheme,
      themeMode:
          ref.watch(appearanceProvider).asData?.value ?? ThemeMode.system,
      routerConfig: ref.watch(routerProvider),
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(
          disableAnimations: reduced || MediaQuery.disableAnimationsOf(context),
        ),
        child: publicTestMode
            ? Column(
                children: [
                  Material(
                    color: Theme.of(context).colorScheme.primaryContainer,
                    child: SafeArea(
                      bottom: false,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 7,
                        ),
                        child: Center(
                          child: Text(
                            publicTestLabel,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  Expanded(child: MaintenanceGate(child: child!)),
                ],
              )
            : ref.watch(previewModeProvider)
            ? child!
            : MaintenanceGate(child: AndroidUpdateGate(child: child!)),
      ),
    );
  }
}
