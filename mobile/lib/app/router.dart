import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/presentation/kit.dart';
import '../preview/preview_controller.dart';
import '../features/auth/splash_page.dart';
import '../features/auth/auth_pages.dart';
import '../features/home/home_page.dart';
import '../features/wallet/wallet_pages.dart';
import '../features/sell/sell_pages.dart';
import '../features/history/history_pages.dart';
import '../features/profile/profile_pages.dart';
import '../features/banks/bank_pages.dart';
import '../features/referral/referral_page.dart';
import '../features/referral/production_referral_page.dart';
import '../features/referral/referral_availability.dart';
import '../features/referral/referral_coming_soon_page.dart';
import '../features/engagement/engagement_pages.dart';
import '../features/settings/settings_pages.dart';
import '../features/settings/biometric_page.dart';
import '../features/notifications/notifications_page.dart';
import '../features/support/support_pages.dart';
import 'navigation.dart';
import '../public_test/test_mode.dart';
import '../public_test/test_auth_page.dart';
import '../public_test/test_bank_page.dart';

/// A test/preview entry point; production authentication is a later phase.
final initialRouteProvider = Provider<String>((_) => '/splash');
final routerProvider = Provider<GoRouter>((ref) {
  final refresh = ValueNotifier<int>(0);
  ref.listen(
    previewProvider.select((s) => s.signedIn),
    (_, _) => refresh.value++,
  );
  final router = GoRouter(
    initialLocation: ref.read(initialRouteProvider),
    refreshListenable: refresh,
    redirect: (_, route) {
      final s = ref.read(previewProvider);
      final p = route.uri.path;
      final public =
          p == '/splash' ||
          p == '/login' ||
          p == '/register' ||
          p == '/otp' ||
          p == '/forgot-password' ||
          p == '/reset-password' ||
          p.startsWith('/legal/') ||
          p == '/support';
      if (!s.signedIn && !public) return '/login';
      return null;
    },
    errorBuilder: (_, _) => const AppPage(
      title: 'Page not found',
      children: [
        InfoNote('This page is unavailable. Use Back to return to Home.'),
      ],
    ),
    routes: [
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => DtNavigationShell(shell: shell),
        branches: [
          StatefulShellBranch(
            routes: [_route('/home', (_, _) => const HomePage())],
          ),
          StatefulShellBranch(
            routes: [_route('/wallet', (_, _) => const WalletPage())],
          ),
          StatefulShellBranch(
            routes: [
              _route(
                '/history',
                (_, s) => HistoryPage(
                  filter: s.uri.queryParameters['filter'] == 'deposits'
                      ? 'deposit'
                      : s.uri.queryParameters['filter'] ?? 'all',
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [_route('/profile', (_, _) => const ProfilePage())],
          ),
        ],
      ),
      _route('/splash', (_, _) => const SplashPage()),
      _route(
        '/login',
        (_, _) =>
            publicTestMode ? const PublicTestAuthPage() : const LoginPage(),
      ),
      _route(
        '/register',
        (_, s) => publicTestMode
            ? const PublicTestAuthPage(register: true)
            : RegisterPage(
                referralCode: referralComingSoon
                    ? null
                    : s.uri.queryParameters['ref'],
              ),
      ),
      _route(
        '/otp',
        (_, s) => OtpPage(
          purpose: s.uri.queryParameters['purpose'] ?? 'login',
          contact: s.uri.queryParameters['contact'] ?? '',
        ),
      ),
      _route('/forgot-password', (_, _) => const ForgotPasswordPage()),
      _route('/reset-password', (_, _) => const PasswordPage(reset: true)),
      _route('/banks', (_, _) => const BankAccountsPage()),
      _route(
        '/banks/add',
        (_, _) =>
            publicTestMode ? const PublicTestBankPage() : const AddBankPage(),
      ),
      _route(
        '/referral',
        (_, _) => referralComingSoon
            ? const ReferralComingSoonPage()
            : ref.read(previewModeProvider)
            ? const ReferralPage()
            : const ProductionReferralPage(),
      ),
      _route('/settings', (_, _) => const SettingsPage()),
      _route('/settings/password', (_, _) => const PasswordPage()),
      _route(
        '/settings/pin',
        (_, _) => ref.read(previewModeProvider)
            ? const PinPage()
            : const ApiSecurityForm(delete: false),
      ),
      _route(
        '/settings/biometric',
        (_, _) => ref.read(previewModeProvider)
            ? const SecurityPreviewPage(biometric: true)
            : const BiometricPage(),
      ),
      _route(
        '/settings/2fa',
        (_, _) => const SecurityPreviewPage(biometric: false),
      ),
      _route('/settings/devices', (_, _) => const DevicesPage()),
      _route(
        '/settings/notifications',
        (_, _) => ref.read(previewModeProvider)
            ? const PreferencesPage(notifications: true)
            : const ApiPreferencesPage(notifications: true),
      ),
      _route(
        '/settings/preferences',
        (_, _) => ref.read(previewModeProvider)
            ? const PreferencesPage()
            : const ApiPreferencesPage(notifications: false),
      ),
      _route(
        '/settings/delete',
        (_, _) => ref.read(previewModeProvider)
            ? const DeleteAccountPage()
            : const ApiSecurityForm(delete: true),
      ),
      _route(
        '/legal/:kind',
        (_, s) => ref.read(previewModeProvider)
            ? LegalPage(privacy: s.pathParameters['kind'] == 'privacy')
            : ApiLegalPage(kind: s.pathParameters['kind']!),
      ),
      _route(
        '/support',
        (_, _) => ref.read(previewModeProvider)
            ? const SupportPage()
            : const ApiSupportPage(),
      ),
      _route(
        '/support/tickets/:id',
        (_, s) => ApiTicketForm(id: s.pathParameters['id']),
      ),
      _route(
        '/support/new',
        (_, s) => ref.read(previewModeProvider)
            ? NewTicketPage(order: s.uri.queryParameters['order'] ?? '')
            : const ApiTicketForm(),
      ),
      _route('/deposit', (_, _) => const DepositPage()),
      _route('/notifications', (_, _) => const NotificationsPage()),
      _route('/profile/details', (_, _) => const UserDetailsPage()),
      _route(
        '/sell/amount',
        (_, s) =>
            SellAmountPage(initial: s.uri.queryParameters['amount'] ?? ''),
      ),
      _route('/sell/confirm', (_, _) => const SellConfirmPage()),
      _route(
        '/sell/send/:id',
        (_, s) => SellSendPage(id: s.pathParameters['id']!),
      ),
      _route(
        '/sell/track/:id',
        (_, s) => SellTrackPage(id: s.pathParameters['id']!),
      ),
      _route(
        '/history/:id',
        (_, s) => TransactionDetailsPage(id: s.pathParameters['id']!),
      ),
    ],
  );
  ref.onDispose(() {
    router.dispose();
    refresh.dispose();
  });
  return router;
});
GoRoute _route(
  String path,
  Widget Function(BuildContext, GoRouterState) builder,
) => GoRoute(path: path, pageBuilder: (c, s) => _page(c, s, builder(c, s)));
CustomTransitionPage<void> _page(
  BuildContext context,
  GoRouterState state,
  Widget child,
) => CustomTransitionPage<void>(
  key: state.pageKey,
  child: child,
  transitionDuration: MediaQuery.disableAnimationsOf(context)
      ? Duration.zero
      : DtMotion.standard,
  transitionsBuilder: (_, animation, _, child) => FadeTransition(
    opacity: animation,
    child: SlideTransition(
      position: animation.drive(
        Tween(
          begin: const Offset(.025, 0),
          end: Offset.zero,
        ).chain(CurveTween(curve: Curves.easeOutCubic)),
      ),
      child: child,
    ),
  ),
);
