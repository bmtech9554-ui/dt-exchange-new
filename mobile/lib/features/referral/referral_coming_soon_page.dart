import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/design/appearance.dart';
import '../../core/presentation/kit.dart';

class ReferralComingSoonPage extends StatefulWidget {
  const ReferralComingSoonPage({super.key});
  @override
  State<ReferralComingSoonPage> createState() => _ReferralComingSoonPageState();
}

class _ReferralComingSoonPageState extends State<ReferralComingSoonPage>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2400),
  );
  bool _resumed = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _resumed =
        WidgetsBinding.instance.lifecycleState == null ||
        WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed;
  }

  void _syncMotion() {
    final animate =
        _resumed &&
        TickerMode.valuesOf(context).enabled &&
        !MediaQuery.disableAnimationsOf(context);
    if (animate && !_pulse.isAnimating) {
      _pulse.repeat(reverse: true);
    } else if (!animate) {
      _pulse.stop();
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncMotion();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _resumed = state == AppLifecycleState.resumed;
    _syncMotion();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AppPage(
    title: 'Referral Program',
    children: [
      const SizedBox(height: 24),
      SurfaceCard(
        color: dtColor(context, DtColors.softMint),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
        child: Column(
          children: [
            AnimatedBuilder(
              animation: _pulse,
              builder: (context, child) => Transform.scale(
                key: const Key('referral-gift-pulse'),
                scale: MediaQuery.disableAnimationsOf(context)
                    ? 1
                    : 1 + .04 * Curves.easeInOut.transform(_pulse.value),
                child: child,
              ),
              child: Container(
                width: 88,
                height: 88,
                decoration: BoxDecoration(
                  color: dtColor(context, DtColors.white),
                  borderRadius: BorderRadius.circular(28),
                ),
                child: Icon(
                  Icons.card_giftcard_rounded,
                  size: 42,
                  color: dtColor(context, DtColors.teal),
                ),
              ),
            ),
            const SizedBox(height: 28),
            Text(
              'Coming Soon',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 12),
            Text(
              'Something exciting is on the way. Stay tuned!',
              textAlign: TextAlign.center,
              style: TextStyle(
                height: 1.6,
                color: dtColor(context, DtColors.muted),
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: 24),
      DtButton(
        label: 'Back',
        icon: Icons.arrow_back_rounded,
        onPressed: () =>
            context.canPop() ? context.pop() : context.go('/profile'),
      ),
    ],
  );
}
