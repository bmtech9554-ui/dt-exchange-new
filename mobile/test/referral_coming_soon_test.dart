import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dt_exchange/core/design/appearance.dart';
import 'package:dt_exchange/features/referral/production_referral_page.dart';
import 'package:dt_exchange/features/referral/referral_coming_soon_page.dart';
import 'test_support.dart';

void main() {
  setUpAll(loadPreviewFonts);
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  for (final mode in [ThemeMode.light, ThemeMode.dark]) {
    testWidgets('Coming Soon route fits narrow large text in $mode', (t) async {
      final c = await pumpPreview(
        t,
        route: '/referral',
        size: const Size(320, 700),
        scale: 1.5,
      );
      await c.read(appearanceProvider.notifier).select(mode);
      await t.pump();
      expect(find.text('Referral Program'), findsOneWidget);
      expect(find.text('Coming Soon'), findsOneWidget);
      expect(
        find.text('Something exciting is on the way. Stay tuned!'),
        findsOneWidget,
      );
      expect(find.byType(ProductionReferralPage), findsNothing);
      expect(c.exists(referralOverviewProvider), isFalse);
      for (final text in [
        'Referral code',
        'Referral Link',
        'Invite & Earn',
        'Share & Invite Friends',
        'Referral History',
      ]) {
        expect(find.text(text), findsNothing);
      }
      expect(t.takeException(), isNull);
      await revealText(t, 'Back');
      await t.tap(find.text('Back'));
      await t.pump();
      await t.pump(const Duration(milliseconds: 500));
      expect(find.text('Profile'), findsWidgets);
      expect(find.byType(ReferralComingSoonPage), findsNothing);
      await closePreview(t, c);
    });
  }
  testWidgets(
    'Profile keeps referral badge and navigates without fetching referrals',
    (t) async {
      final c = await pumpPreview(t, route: '/profile');
      expect(find.text('Coming Soon'), findsOneWidget);
      expect(find.text('Earn by inviting friends'), findsNothing);
      await t.tap(find.text('Referral Program'));
      await t.pump();
      await t.pump(const Duration(milliseconds: 500));
      expect(find.byType(ReferralComingSoonPage), findsOneWidget);
      expect(c.exists(referralOverviewProvider), isFalse);
      await closePreview(t, c);
    },
  );
  testWidgets(
    'gift animates, pauses in background, resumes and respects reduced motion',
    (t) async {
      final c = await pumpPreview(t, route: '/referral');
      double scale() => t
          .widget<Transform>(find.byKey(const Key('referral-gift-pulse')))
          .transform
          .entry(0, 0);
      final first = scale();
      await t.pump(const Duration(milliseconds: 400));
      expect(scale(), isNot(first));
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await t.pump();
      final stopped = scale();
      await t.pump(const Duration(seconds: 1));
      expect(scale(), stopped);
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await t.pump();
      await t.pump(const Duration(milliseconds: 400));
      expect(scale(), isNot(stopped));
      t.platformDispatcher.accessibilityFeaturesTestValue =
          FakeAccessibilityFeatures(disableAnimations: true);
      await t.pump();
      await t.pump(const Duration(seconds: 1));
      expect(scale(), 1);
      await closePreview(t, c);
      t.platformDispatcher.clearAccessibilityFeaturesTestValue();
    },
  );
  testWidgets(
    'old registration invite has no referral field while coming soon',
    (t) async {
      final c = await pumpPreview(
        t,
        route: '/register?ref=OLDINVITE',
        signedIn: false,
      );
      expect(find.text('Referral code (optional)'), findsNothing);
      expect(find.text('OLDINVITE'), findsNothing);
      await closePreview(t, c);
    },
  );
}
