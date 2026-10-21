import 'package:dt_exchange/core/design/appearance.dart';
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../preview/preview_controller.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../design/tokens.dart';
import '../widgets/usdt_token_icon.dart';
export '../widgets/usdt_token_icon.dart';
export '../widgets/usdt_action_card.dart';
export '../widgets/rate_sparkline.dart';
export '../widgets/tinted_card.dart';
import '../widgets/dt_reveal.dart';
import '../widgets/dt_card.dart';
import '../../preview/models.dart';
import '../../preview/money.dart';
export '../design/tokens.dart';
export '../widgets/dt_button.dart';
export '../widgets/dt_card.dart';
export '../widgets/dt_field.dart';
export '../widgets/dt_logo.dart';
export '../widgets/dt_reveal.dart';
export '../widgets/dt_skeleton.dart';
export '../widgets/dt_status_badge.dart';
export '../widgets/dt_empty_state.dart';
export '../widgets/dt_step_progress.dart';

void toast(BuildContext context, String message) =>
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
        backgroundColor: DtColors.navy,
      ),
    );
Future<bool> confirmAction(
  BuildContext context, {
  required String title,
  required String body,
  String action = 'Confirm',
}) async =>
    await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(title),
        content: Text(body),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(c, true),
            child: Text(action),
          ),
        ],
      ),
    ) ??
    false;
String? requiredValue(String? s) =>
    s == null || s.trim().isEmpty ? 'This field is required' : null;
String? contactValidator(String? s) {
  final value = s?.trim() ?? '';
  return RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(value) ||
          RegExp(r'^\+?\d{10,13}$').hasMatch(value)
      ? null
      : 'Enter a valid email or mobile number';
}

String? emailValidator(String? s) =>
    RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(s?.trim() ?? '')
    ? null
    : 'Enter a valid email';
String? passwordValidator(String? s) =>
    (s?.length ?? 0) >= 8 ? null : 'Use at least 8 characters';
String shortDate(DateTime d) =>
    '${d.day} ${const ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.month - 1]}, ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';

class AppPage extends StatelessWidget {
  const AppPage({
    required this.title,
    required this.children,
    this.titleWidget,
    this.subtitle,
    this.statusMessage,
    this.back = true,
    this.actions = const [],
    this.onRefresh,
    this.compactHeader = false,
    super.key,
  });
  final String title;
  final Widget? titleWidget;
  final String? subtitle;
  final String? statusMessage;
  final bool back;
  final bool compactHeader;
  final List<Widget> children, actions;
  final Future<void> Function()? onRefresh;
  @override
  Widget build(BuildContext context) {
    Widget list = ListView(
      padding: EdgeInsets.fromLTRB(
        MediaQuery.sizeOf(context).width < 360 ? 16 : 24,
        compactHeader ? 6 : 12,
        MediaQuery.sizeOf(context).width < 360 ? 16 : 24,
        32,
      ),
      children: [
        PreviewLabel(productionMessage: statusMessage),
        SizedBox(height: compactHeader ? 8 : 22),
        ...children,
      ],
    );
    if (onRefresh != null) {
      list = RefreshIndicator(
        onRefresh: onRefresh!,
        color: dtColor(context, DtColors.navy),
        child: list,
      );
    }
    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        leading: back
            ? IconButton(
                tooltip: 'Back',
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: () =>
                    context.canPop() ? context.pop() : context.go('/home'),
              )
            : null,
        title:
            titleWidget ??
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                if (subtitle != null)
                  Text(
                    subtitle!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.labelSmall,
                  ),
              ],
            ),
        actions: actions,
        toolbarHeight: compactHeader ? 64 : 76,
      ),
      body: SafeArea(
        top: false,
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 640),
            child: list,
          ),
        ),
      ),
    );
  }
}

class PreviewLabel extends ConsumerWidget {
  const PreviewLabel({this.productionMessage, super.key});
  final String? productionMessage;
  @override
  Widget build(BuildContext context, WidgetRef ref) => Row(
    children: [
      Container(
        width: 6,
        height: 6,
        decoration: const BoxDecoration(
          color: DtColors.teal,
          shape: BoxShape.circle,
        ),
      ),
      const SizedBox(width: 7),
      Flexible(
        child: Text(
          ref.watch(previewModeProvider)
              ? 'PREVIEW  ·  No real transfers'
              : productionMessage ?? 'Provider-confirmed payout updates',
          style: TextStyle(
            fontSize: 10,
            letterSpacing: .8,
            color: dtColor(context, DtColors.muted),
          ),
        ),
      ),
    ],
  );
}

class SectionHeading extends StatelessWidget {
  const SectionHeading(this.title, {this.action, this.onTap, super.key});
  final String title;
  final String? action;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 6, bottom: 14),
    child: Row(
      children: [
        Expanded(
          child: Text(title, style: Theme.of(context).textTheme.titleMedium),
        ),
        if (action != null)
          TextButton(
            onPressed: onTap,
            child: Text(
              action!,
              style: TextStyle(
                color: dtColor(context, Color(0xFF087E64)),
                fontSize: 12,
              ),
            ),
          ),
      ],
    ),
  );
}

class InfoNote extends StatelessWidget {
  const InfoNote(
    this.text, {
    this.icon = Icons.info_outline,
    this.mint = false,
    super.key,
  });
  final String text;
  final IconData icon;
  final bool mint;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: mint
          ? dtColor(context, DtColors.softMint)
          : dtColor(context, DtColors.softBlue),
      borderRadius: BorderRadius.circular(16),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          icon,
          size: 18,
          color: mint
              ? dtColor(context, const Color(0xFF087E64))
              : dtColor(context, const Color(0xFF315FB1)),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: TextStyle(
              fontSize: 12,
              height: 1.5,
              color: dtColor(context, DtColors.navy),
            ),
          ),
        ),
      ],
    ),
  );
}

class DetailRow extends StatelessWidget {
  const DetailRow(this.label, this.value, {this.strong = false, super.key});
  final String label, value;
  final bool strong;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Row(
            children: [
              if (label.toUpperCase().contains('USDT')) ...[
                const UsdtTokenIcon(size: 18),
                const SizedBox(width: 6),
              ],
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    color: dtColor(context, DtColors.muted),
                    fontSize: 13,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 16),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: TextStyle(
              color: dtColor(context, DtColors.navy),
              fontSize: strong ? 17 : 13,
              fontWeight: strong ? FontWeight.w700 : FontWeight.w500,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ),
      ],
    ),
  );
}

class AnimatedAmount extends StatefulWidget {
  const AnimatedAmount({
    required this.value,
    required this.format,
    this.style,
    super.key,
  });
  final BigInt value;
  final String Function(BigInt) format;
  final TextStyle? style;
  @override
  State<AnimatedAmount> createState() => _AnimatedAmountState();
}

class _AnimatedAmountState extends State<AnimatedAmount> {
  BigInt previous = BigInt.zero;
  Widget _number(BigInt value) => FittedBox(
    fit: BoxFit.scaleDown,
    alignment: Alignment.centerLeft,
    child: Text(widget.format(value), style: widget.style),
  );
  @override
  void didUpdateWidget(covariant AnimatedAmount oldWidget) {
    super.didUpdateWidget(oldWidget);
    previous = oldWidget.value;
  }

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context)) {
      return _number(widget.value);
    }
    return TweenAnimationBuilder<double>(
      key: ValueKey(widget.value),
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 650),
      curve: Curves.easeOutCubic,
      builder: (_, t, _) => _number(
        t == 1
            ? widget.value
            : previous +
                  BigInt.from(
                    ((widget.value - previous).toDouble() * t).round(),
                  ),
      ),
    );
  }
}

class CopyControl extends StatefulWidget {
  const CopyControl({required this.value, this.label = 'Copy', super.key});
  final String value, label;
  @override
  State<CopyControl> createState() => _CopyControlState();
}

class _CopyControlState extends State<CopyControl> {
  bool copied = false;
  Timer? reset;
  @override
  void dispose() {
    reset?.cancel();
    super.dispose();
  }

  Future<void> copy() async {
    try {
      await Clipboard.setData(ClipboardData(text: widget.value));
      if (!mounted) return;
      setState(() => copied = true);
      reset?.cancel();
      reset = Timer(const Duration(seconds: 2), () {
        if (mounted) setState(() => copied = false);
      });
    } catch (_) {
      if (mounted) toast(context, 'Copy is unavailable on this device.');
    }
  }

  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: TextButton.icon(
      onPressed: copy,
      icon: AnimatedSwitcher(
        duration: MediaQuery.disableAnimationsOf(context)
            ? Duration.zero
            : DtMotion.standard,
        child: Icon(
          copied ? Icons.check_circle_outline : Icons.copy_outlined,
          key: ValueKey(copied),
          size: 17,
          color: Theme.of(context).brightness == Brightness.dark
              ? DtColors.mint
              : dtColor(context, const Color(0xFF087E64)),
        ),
      ),
      label: Text(
        copied ? 'Copied' : widget.label,
        style: TextStyle(
          color: Theme.of(context).brightness == Brightness.dark
              ? DtColors.mint
              : dtColor(context, const Color(0xFF087E64)),
          fontSize: 12,
        ),
      ),
    ),
  );
}

class PreviewQr extends StatelessWidget {
  const PreviewQr({required this.data, this.preview = true, super.key});
  final String data;
  final bool preview;
  @override
  Widget build(BuildContext context) => DtReveal(
    child: Center(
      child: Container(
        padding: const EdgeInsets.all(15),
        decoration: BoxDecoration(
          color: dtColor(context, DtColors.white),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: dtColor(context, DtColors.border)),
        ),
        child: Semantics(
          label: preview
              ? 'Preview QR code. Not a payment address.'
              : 'USDT deposit address QR code.',
          child: QrImageView(
            data: data,
            version: QrVersions.auto,
            size: 190,
            // QR modules require a stable high-contrast scan surface in either theme.
            backgroundColor: DtColors.white,
            eyeStyle: const QrEyeStyle(
              eyeShape: QrEyeShape.square,
              color: DtColors.navy,
            ),
            dataModuleStyle: const QrDataModuleStyle(
              dataModuleShape: QrDataModuleShape.square,
              color: DtColors.navy,
            ),
          ),
        ),
      ),
    ),
  );
}

class SuccessMark extends StatelessWidget {
  const SuccessMark({this.size = 88, super.key});
  final double size;
  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
    tween: Tween(begin: 0, end: 1),
    duration: MediaQuery.disableAnimationsOf(context)
        ? Duration.zero
        : const Duration(milliseconds: 700),
    curve: Curves.easeOutCubic,
    builder: (_, value, _) => Transform.scale(
      scale: .8 + .2 * value,
      child: CustomPaint(
        size: Size.square(size),
        painter: _CheckPainter(value),
      ),
    ),
  );
}

class _CheckPainter extends CustomPainter {
  _CheckPainter(this.progress);
  final double progress;
  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height / 2);
    canvas.drawCircle(c, size.width / 2, Paint()..color = DtColors.softMint);
    canvas.drawCircle(
      c,
      size.width * .36,
      Paint()
        ..shader = const LinearGradient(
          colors: [DtColors.ctaStart, DtColors.ctaEnd],
        ).createShader(Offset.zero & size),
    );
    final path = Path()
      ..moveTo(size.width * .31, size.height * .51)
      ..lineTo(size.width * .44, size.height * .63)
      ..lineTo(size.width * .7, size.height * .36);
    final metric = path.computeMetrics().first;
    canvas.drawPath(
      metric.extractPath(0, metric.length * progress),
      Paint()
        ..color = DtColors.navy
        ..style = PaintingStyle.stroke
        ..strokeWidth = 4
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(_CheckPainter old) => old.progress != progress;
}

class TransactionTile extends StatelessWidget {
  const TransactionTile(this.tx, {super.key});
  final PreviewTransaction tx;
  @override
  Widget build(BuildContext context) {
    final deposit = tx.kind == TransactionKind.deposit;
    final complete = tx.status == TransactionState.completed;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => context.push('/history/${tx.id}'),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 13),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: deposit
                      ? dtColor(context, DtColors.softMint)
                      : dtColor(context, DtColors.softBlue),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: tx.kind == TransactionKind.payout
                    ? Icon(
                        Icons.account_balance_outlined,
                        size: 21,
                        color: dtColor(context, DtColors.navy),
                      )
                    : const Center(child: UsdtTokenIcon(size: 28)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      tx.title,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: dtColor(context, DtColors.navy),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      shortDate(tx.date),
                      style: TextStyle(
                        fontSize: 10,
                        color: dtColor(context, DtColors.muted),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 6),
              Flexible(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      tx.kind == TransactionKind.payout
                          ? PreviewMoney.inr(tx.inrPaise)
                          : '${deposit ? '+' : ''}${PreviewMoney.usdt(tx.amount)} USDT',
                      textAlign: TextAlign.end,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: dtColor(context, DtColors.navy),
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      tx.kind == TransactionKind.payout
                          ? '${PreviewMoney.usdt(tx.amount)} USDT'
                          : PreviewMoney.inr(tx.inrPaise),
                      textAlign: TextAlign.end,
                      style: TextStyle(
                        fontSize: 10,
                        color: dtColor(context, DtColors.muted),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      complete
                          ? 'Completed'
                          : tx.status.name[0].toUpperCase() +
                                tx.status.name.substring(1),
                      style: TextStyle(
                        fontSize: 10,
                        color: complete
                            ? dtColor(context, const Color(0xFF087E64))
                            : dtColor(context, const Color(0xFF315FB1)),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class BankSummary extends StatelessWidget {
  const BankSummary(this.bank, {this.isDefault = false, this.onTap, super.key});
  final PreviewBank bank;
  final bool isDefault;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: EdgeInsets.zero,
    onTap: onTap,
    leading: Container(
      width: 42,
      height: 42,
      decoration: BoxDecoration(
        color: dtColor(context, DtColors.softBlue),
        borderRadius: BorderRadius.circular(13),
      ),
      child: Icon(
        Icons.account_balance_outlined,
        color: dtColor(context, DtColors.navy),
        size: 21,
      ),
    ),
    title: Text(
      bank.name,
      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
    ),
    subtitle: Text(
      '•••• ${bank.last4}${isDefault ? '  ·  Default' : ''}',
      style: const TextStyle(fontSize: 12),
    ),
    trailing: onTap != null ? const Icon(Icons.chevron_right, size: 19) : null,
  );
}

/// Retains the Phase 1 card exactly and supplies an ink surface for ListTile.
class SurfaceCard extends StatelessWidget {
  const SurfaceCard({
    required this.child,
    this.color = DtColors.white,
    this.padding = const EdgeInsets.all(24),
    super.key,
  });
  final Widget child;
  final Color color;
  final EdgeInsetsGeometry padding;
  @override
  Widget build(BuildContext context) => DtCard(
    color: color,
    padding: padding,
    child: Material(type: MaterialType.transparency, child: child),
  );
}
