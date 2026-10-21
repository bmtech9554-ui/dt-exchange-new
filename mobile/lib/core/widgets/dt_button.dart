import 'package:flutter/material.dart';
import '../design/tokens.dart';
import '../design/appearance.dart';

enum DtButtonStyle { primary, secondary, danger }

class DtButton extends StatefulWidget {
  const DtButton({
    required this.label,
    this.onPressed,
    this.icon,
    this.loading = false,
    this.style = DtButtonStyle.primary,
    super.key,
  });
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool loading;
  final DtButtonStyle style;
  @override
  State<DtButton> createState() => _DtButtonState();
}

class _DtButtonState extends State<DtButton> {
  bool _pressed = false;
  @override
  Widget build(BuildContext context) {
    final disabled = widget.onPressed == null || widget.loading;
    final primary = widget.style == DtButtonStyle.primary;
    final danger = widget.style == DtButtonStyle.danger;
    return AnimatedScale(
      scale: _pressed ? .98 : 1,
      duration: MediaQuery.disableAnimationsOf(context)
          ? Duration.zero
          : DtMotion.press,
      child: Opacity(
        opacity: disabled ? .45 : 1,
        child: Container(
          decoration: BoxDecoration(
            gradient: primary
                ? const LinearGradient(
                    colors: [DtColors.ctaStart, DtColors.ctaEnd],
                  )
                : null,
            color: primary ? null : dtColor(context, DtColors.white),
            borderRadius: BorderRadius.circular(DtRadius.control),
            border: primary
                ? null
                : Border.all(
                    color: danger ? const Color(0xFFF2BDC4) : DtColors.border,
                  ),
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: disabled ? null : widget.onPressed,
              onHighlightChanged: disabled
                  ? null
                  : (value) => setState(() => _pressed = value),
              borderRadius: BorderRadius.circular(DtRadius.control),
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 52),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 18,
                    vertical: 14,
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (widget.loading)
                        const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      if (!widget.loading && widget.icon != null)
                        Icon(
                          widget.icon,
                          size: 19,
                          color: danger
                              ? dtColor(context, DtColors.red)
                              : primary
                              ? DtColors.navy
                              : dtColor(context, DtColors.navy),
                        ),
                      if (widget.loading || widget.icon != null)
                        const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          widget.label,
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: danger
                                ? dtColor(context, DtColors.red)
                                : primary
                                ? DtColors.navy
                                : dtColor(context, DtColors.navy),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
