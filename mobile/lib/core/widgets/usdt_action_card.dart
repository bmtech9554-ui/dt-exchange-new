import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../design/tokens.dart';
import 'usdt_token_icon.dart';

class UsdtActionCard extends StatefulWidget {
  const UsdtActionCard({required this.sell, required this.onTap, super.key});
  final bool sell;
  final VoidCallback onTap;
  @override
  State<UsdtActionCard> createState() => _UsdtActionCardState();
}

class _UsdtActionCardState extends State<UsdtActionCard> {
  bool pressed = false;
  @override
  Widget build(BuildContext context) {
    final reduced = MediaQuery.disableAnimationsOf(context);
    const color = DtColors.navy;
    return Semantics(
      button: true,
      child: AnimatedScale(
        scale: pressed && !reduced ? .975 : 1,
        duration: reduced ? Duration.zero : const Duration(milliseconds: 140),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(22),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: widget.sell
                  ? [
                      Color.lerp(DtColors.blue, DtColors.softBlue, .68)!,
                      Color.lerp(DtColors.blue, DtColors.softBlue, .42)!,
                    ]
                  : [DtColors.mint, DtColors.teal],
            ),
            boxShadow: [
              BoxShadow(
                color: DtColors.navy.withValues(alpha: .05),
                blurRadius: 14,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: Material(
            color: Colors.transparent,
            borderRadius: BorderRadius.circular(22),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onHighlightChanged: (v) => setState(() => pressed = v),
              highlightColor: Colors.white.withValues(alpha: .16),
              splashColor: Colors.white.withValues(alpha: .12),
              onTap: () {
                HapticFeedback.selectionClick();
                widget.onTap();
              },
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const UsdtTokenIcon(size: 26),
                        const Spacer(),
                        Icon(Icons.north_east_rounded, size: 19, color: color),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      widget.sell ? 'Sell USDT' : 'Deposit USDT',
                      style: TextStyle(
                        color: color,
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      widget.sell
                          ? 'Receive INR to your bank'
                          : 'Add USDT to your wallet',
                      style: TextStyle(color: color, fontSize: 11, height: 1.4),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
