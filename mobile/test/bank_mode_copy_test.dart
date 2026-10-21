import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dt_exchange/features/banks/bank_pages.dart';
import 'package:dt_exchange/preview/preview_controller.dart';

void main() {
  for (final preview in [false, true]) {
    testWidgets(
      'bank form keeps production and preview wording distinct: $preview',
      (tester) async {
        await tester.pumpWidget(
          ProviderScope(
            overrides: [previewModeProvider.overrideWithValue(preview)],
            child: const MaterialApp(home: AddBankPage()),
          ),
        );
        await tester.pump();
        if (preview) {
          expect(
            find.textContaining('Bank verification is simulated'),
            findsOneWidget,
          );
        } else {
          expect(
            find.textContaining('not independently verified'),
            findsOneWidget,
          );
          expect(
            find.textContaining(
              RegExp('sandbox|simulated', caseSensitive: false),
            ),
            findsNothing,
          );
        }
        expect(find.text('Account holder name'), findsOneWidget);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox());
      },
    );
  }
}
