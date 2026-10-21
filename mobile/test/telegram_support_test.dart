import 'dart:async';
import 'package:dt_exchange/core/widgets/dt_button.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dt_exchange/features/support/telegram_support.dart';

void main() {
  for (final scenario in [
    'deep link',
    'missing app',
    'deep link exception',
    'both fail',
    'timeout',
  ]) {
    testWidgets('Telegram support: $scenario', (tester) async {
      final opened = <String>[];
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            telegramSupportLauncherProvider.overrideWithValue((uri) async {
              opened.add(uri.toString());
              if (scenario == 'timeout') return Completer<bool>().future;
              if (uri.scheme == 'tg') {
                if (scenario == 'deep link exception') {
                  throw StateError('No handler');
                }
                return scenario == 'deep link';
              }
              return scenario != 'both fail';
            }),
          ],
          child: const MaterialApp(home: Scaffold(body: TelegramSupportCard())),
        ),
      );
      expect(find.textContaining('@dtexchange'), findsOneWidget);
      await tester.tap(find.byType(DtButton));
      await tester.pump();
      if (scenario == 'timeout') {
        await tester.pump(const Duration(seconds: 3));
        await tester.pump(const Duration(seconds: 3));
      }
      expect(opened.first, 'tg://resolve?domain=dtexchange');
      expect(
        opened,
        scenario == 'deep link'
            ? ['tg://resolve?domain=dtexchange']
            : ['tg://resolve?domain=dtexchange', 'https://t.me/dtexchange'],
      );
      expect(
        find.textContaining('Could not open Telegram'),
        ['both fail', 'timeout'].contains(scenario)
            ? findsOneWidget
            : findsNothing,
      );
      expect(
        tester.widget<DtButton>(find.byType(DtButton)).onPressed,
        isNotNull,
      );
      expect(tester.takeException(), isNull);
    });
  }
}
