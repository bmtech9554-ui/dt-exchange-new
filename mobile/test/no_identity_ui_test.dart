import 'package:flutter_test/flutter_test.dart';
import 'package:dt_exchange/app/router.dart';
import 'package:dt_exchange/preview/preview_controller.dart';
import 'test_support.dart';

void main() {
  setUpAll(loadPreviewFonts);
  for (final route in [
    '/home',
    '/wallet',
    '/history',
    '/profile',
    '/sell/amount',
    '/deposit',
  ]) {
    testWidgets('$route has no identity UI or KYC redirect for a new account', (
      t,
    ) async {
      final c = await pumpPreview(
        t,
        route: route,
        setup: (x) => x.register('New User', 'new@example.com', '9000000001'),
      );
      addTearDown(() => closePreview(t, c));
      expect(
        c.read(routerProvider).routeInformationProvider.value.uri.path,
        route,
      );
      expect(c.read(previewProvider).verified, false);
      expect(
        find.textContaining(
          RegExp(
            r'KYC|PAN|Selfie|Verify identity|Verification Required|Activate your account|Complete verification',
            caseSensitive: false,
          ),
        ),
        findsNothing,
      );
      if (route == '/profile') {
        for (final label in [
          'User details',
          'Bank Accounts',
          'Referral Program',
          'Settings',
          'Logout',
        ]) {
          expect(find.text(label), findsOneWidget);
        }
        expect(find.text('Verified'), findsNothing);
      }
      expect(t.takeException(), isNull);
    });
  }
  testWidgets('retired identity route cannot render an activation screen', (
    t,
  ) async {
    final c = await pumpPreview(t, route: '/activation');
    addTearDown(() => closePreview(t, c));
    expect(find.text('Page not found'), findsOneWidget);
    expect(find.text('Activate your account'), findsNothing);
  });
}
