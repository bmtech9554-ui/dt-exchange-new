import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dt_exchange/features/manual/maintenance_gate.dart';

void main() {
  for (final blocked in [false, true]) {
    testWidgets('remote maintenance $blocked preserves or gates app', (
      tester,
    ) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            publicConfigurationProvider.overrideWith(
              (ref) async => {
                'config': {'telegram': 'dtexchange'},
                'maintenance': {
                  'app': blocked,
                  'api': false,
                  'message': 'Scheduled service maintenance',
                },
              },
            ),
          ],
          child: const MaterialApp(
            home: MaintenanceGate(child: Text('Home content')),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.text('Home content'),
        blocked ? findsNothing : findsOneWidget,
      );
      if (blocked) {
        expect(find.text('Retry'), findsOneWidget);
        expect(find.text('Telegram Support @dtexchange'), findsOneWidget);
        expect(find.text('Scheduled service maintenance'), findsOneWidget);
      }
    });
  }
  testWidgets('configuration outage offers retry without reload loop', (
    tester,
  ) async {
    var calls = 0;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          publicConfigurationProvider.overrideWith((ref) async {
            calls++;
            throw StateError('synthetic offline');
          }),
        ],
        child: const MaterialApp(
          home: MaintenanceGate(child: Text('Home content')),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(calls, 1);
    expect(find.text('Home content'), findsNothing);
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(calls, 2);
  });
  testWidgets('maintenance retry returns to app and resume rechecks remote state', (tester) async {
    var blocked=true,calls=0;
    await tester.pumpWidget(ProviderScope(overrides:[publicConfigurationProvider.overrideWith((ref)async{calls++;return {'config':{'telegram':'dtexchange'},'maintenance':{'app':blocked,'api':false,'message':'Synthetic maintenance'}};})],child:const MaterialApp(home:MaintenanceGate(child:Text('Restored app')))));
    await tester.pumpAndSettle();expect(find.text('Synthetic maintenance'),findsOneWidget);
    blocked=false;await tester.tap(find.text('Retry'));await tester.pumpAndSettle();expect(find.text('Restored app'),findsOneWidget);
    blocked=true;tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);await tester.pumpAndSettle();expect(find.text('Synthetic maintenance'),findsOneWidget);expect(calls,3);
  });
}
