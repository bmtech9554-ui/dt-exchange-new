import 'package:dt_exchange/core/design/appearance.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/design/tokens.dart';

const mainDestinations = [
  NavigationDestination(
    icon: Icon(Icons.home_outlined),
    selectedIcon: Icon(Icons.home_rounded),
    label: 'Home',
  ),
  NavigationDestination(
    icon: Icon(Icons.account_balance_wallet_outlined),
    selectedIcon: Icon(Icons.account_balance_wallet_rounded),
    label: 'Wallet',
  ),
  NavigationDestination(icon: Icon(Icons.history_rounded), label: 'History'),
  NavigationDestination(
    icon: Icon(Icons.person_outline_rounded),
    selectedIcon: Icon(Icons.person_rounded),
    label: 'Profile',
  ),
];

class DtNavigationShell extends StatelessWidget {
  const DtNavigationShell({required this.shell, super.key});
  final StatefulNavigationShell shell;
  @override
  Widget build(BuildContext context) => Scaffold(
    body: shell,
    bottomNavigationBar: DecoratedBox(
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(color: dtColor(context, DtColors.border), width: .5),
        ),
      ),
      child: NavigationBar(
        selectedIndex: shell.currentIndex,
        animationDuration: MediaQuery.disableAnimationsOf(context)
            ? Duration.zero
            : DtMotion.standard,
        onDestinationSelected: (index) =>
            shell.goBranch(index, initialLocation: index == shell.currentIndex),
        destinations: mainDestinations,
      ),
    ),
  );
}
