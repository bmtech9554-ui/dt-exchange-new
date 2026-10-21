import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../storage/session_store.dart';
import 'tokens.dart';

final appearanceProvider = AsyncNotifierProvider<Appearance, ThemeMode>(
  Appearance.new,
);

class Appearance extends AsyncNotifier<ThemeMode> {
  @override
  Future<ThemeMode> build() async {
    final store = ref.watch(sessionStoreProvider);
    try {
      final value = await store.preference('appearance');
      return ThemeMode.values.where((x) => x.name == value).firstOrNull ??
          ThemeMode.system;
    } catch (_) {
      return ThemeMode.system;
    }
  }

  Future<void> select(ThemeMode value) async {
    await ref
        .read(sessionStoreProvider)
        .savePreference('appearance', value.name);
    state = AsyncData(value);
  }
}

/// Semantic surfaces and ink. Brand artwork/gradient colors stay unchanged.
Color dtColor(BuildContext context, Color light) {
  if (Theme.of(context).brightness != Brightness.dark) return light;
  return switch (light) {
    DtColors.white => DtColors.darkSurface,
    DtColors.background => DtColors.darkBackground,
    DtColors.navy => DtColors.darkText,
    DtColors.muted => DtColors.darkMuted,
    DtColors.border => DtColors.darkBorder,
    DtColors.softMint => DtColors.darkMint,
    DtColors.softBlue => DtColors.darkBlue,
    DtColors.softRed => DtColors.darkRed,
    DtColors.red => const Color(0xFFFFA3AD),
    const Color(0xFF087E64) || const Color(0xFF086750) => DtColors.mint,
    const Color(0xFF315FB1) => DtColors.aqua,
    _ => light,
  };
}

class AppearancePicker extends ConsumerWidget {
  const AppearancePicker({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) =>
      DropdownButtonFormField<ThemeMode>(
        isExpanded: true,
        itemHeight: null,
        initialValue:
            ref.watch(appearanceProvider).asData?.value ?? ThemeMode.system,
        key: ValueKey(ref.watch(appearanceProvider).asData?.value),
        decoration: const InputDecoration(labelText: 'Appearance'),
        items: const [
          DropdownMenuItem(value: ThemeMode.light, child: Text('Light')),
          DropdownMenuItem(value: ThemeMode.dark, child: Text('Dark')),
          DropdownMenuItem(
            value: ThemeMode.system,
            child: Text('System Default'),
          ),
        ],
        onChanged: (value) async {
          if (value == null) return;
          try {
            await ref.read(appearanceProvider.notifier).select(value);
          } catch (_) {
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Unable to save appearance. Please try again.'),
                ),
              );
            }
          }
        },
      );
}
