import 'package:dt_exchange/core/design/appearance.dart';
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../preview/money.dart';
import '../../preview/preview_controller.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/api_client.dart';
import '../../core/presentation/kit.dart';
import '../wallet/wallet_pages.dart';
import '../transactions/transaction_pages.dart';
import '../../public_test/test_mode.dart';

final manualConfigurationProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>(
      (ref) async => Map<String, dynamic>.from(
        await ref.read(apiSessionProvider).request('/manual/configuration'),
      ),
    );

class DepositEntryPage extends ConsumerWidget {
  const DepositEntryPage({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => ref
      .watch(manualConfigurationProvider)
      .when(
        data: (c) => c['manualDepositReview'] == true
            ? ManualDepositPage(configuration: c)
            : const ApiWalletPage(depositOnly: true),
        loading: () => const AppPage(
          title: 'Deposit USDT',
          children: [CircularProgressIndicator()],
        ),
        error: (e, _) => AppPage(
          title: 'Deposit USDT',
          children: [
            InfoNote(apiMessage(e)),
            DtButton(
              label: 'Try again',
              onPressed: () => ref.invalidate(manualConfigurationProvider),
            ),
          ],
        ),
      );
}

class ManualDepositPage extends ConsumerStatefulWidget {
  const ManualDepositPage({required this.configuration, super.key});
  final Map<String, dynamic> configuration;
  @override
  ConsumerState<ManualDepositPage> createState() => _DepositState();
}

class _DepositState extends ConsumerState<ManualDepositPage> {
  List<dynamic> rows = [];
  String? error;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final r = await ref.read(apiSessionProvider).request('/manual/deposits');
      if (mounted) setState(() => rows = r as List);
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    }
  }

  @override
  Widget build(BuildContext context) => AppPage(
    title: 'Deposit USDT',
    subtitle: 'TRC20 · reviewed before credit',
    children: [
      if (widget.configuration['sandbox'] == true)
        const InfoNote('Sandbox configuration. Do not send real USDT.'),
      if (publicTestMode)
        const InfoNote(
          'Demo deposits use a generated reference. There is no receiving wallet. Do not send USDT.',
        )
      else if (widget.configuration['address'] is String)
        DepositAddressCard(
          address: widget.configuration['address'],
          sandbox: widget.configuration['sandbox'] == true,
          preview: false,
        )
      else
        const InfoNote(
          'The receiving wallet is not configured. Please try again later.',
        ),
      if (widget.configuration['address'] is String)
        SubmitDepositPage(
          embedded: true,
          onSubmitted: load,
          depositFeeUsdt:
              widget.configuration['depositFeeUsdt'] as String? ?? '0',
          minimumDeposit: widget.configuration['minimumDeposit'] as String?,
          dailyDepositLimit:
              widget.configuration['dailyDepositLimit'] as String?,
          submissionEnabled: widget.configuration['depositsEnabled'] == true,
          onRefreshAvailability: () async {
            ref.invalidate(manualConfigurationProvider);
            await ref.read(manualConfigurationProvider.future);
          },
        ),
      if (widget.configuration['monthlyLimitEnabled'] == true)
        InfoNote(
          'Monthly deposit limit: ${widget.configuration['monthlyDepositLimit']} USDT',
        ),
      InfoNote(
        'Deposit platform fee: ${widget.configuration['depositFeeUsdt'] ?? '0'} USDT',
      ),
      if (error != null) InfoNote(error!),
      const SizedBox(height: 24),
      const SectionHeading('Your deposit reviews'),
      if (rows.isEmpty) const InfoNote('No deposit proofs submitted yet.'),
      ...rows.map(
        (r) => SurfaceCard(
          child: ListTile(
            leading: const UsdtTokenIcon(size: 28),
            title: Text('${r['submitted_amount']} USDT'),
            subtitle: Text(
              '${r['status'].toString().replaceAll('_', ' ')}\n${r['reason'] ?? ''}',
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => ManualDepositDetail(id: r['id']),
              ),
            ),
          ),
        ),
      ),
    ],
  );
}

/// A testable picker port. Bytes remain on the device until submission.
final depositProofPickerProvider = Provider<Future<PlatformFile?> Function()>(
  (ref) => () async {
    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['jpg', 'jpeg', 'png', 'pdf'],
      withData: true,
    );
    return result?.files.single;
  },
);

String? validateDepositTxId(String? value) =>
    RegExp(r'^[a-fA-F0-9]{64}$').hasMatch(value?.trim() ?? '')
    ? null
    : 'Enter the 64-character TRON transaction hash.';
String? validateDepositAmount(
  String? value, {
  String? minimum,
  String? dailyLimit,
}) {
  final units = PreviewMoney.parseUsdt(value ?? '');
  final min = PreviewMoney.parseUsdt(minimum ?? '');
  final max = PreviewMoney.parseUsdt(dailyLimit ?? '');
  if (units != null && min != null && units < min) {
    return 'Minimum deposit is $minimum USDT.';
  }
  if (units != null && max != null && units > max) {
    return 'Daily deposit limit is $dailyLimit USDT.';
  }
  return units != null && units > BigInt.zero
      ? null
      : 'Enter a positive amount with up to 6 decimals.';
}

String shortenedTxId(String value) => value.length > 16
    ? '${value.substring(0, 8)}…${value.substring(value.length - 8)}'
    : value;

class _DepositHeading extends StatelessWidget {
  const _DepositHeading(this.step, this.title, this.icon);
  final String step, title;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: dtColor(context, DtColors.white).withValues(alpha: .8),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: dtColor(context, DtColors.navy), size: 22),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                step,
                style: TextStyle(
                  fontSize: 10,
                  letterSpacing: 1.2,
                  fontWeight: FontWeight.w600,
                  color: dtColor(context, DtColors.muted),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                title,
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: dtColor(context, DtColors.navy),
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class SubmitDepositPage extends ConsumerStatefulWidget {
  const SubmitDepositPage({
    this.resubmitId,
    this.embedded = false,
    this.preview = false,
    this.onSubmitted,
    this.depositFeeUsdt = '0',
    this.minimumDeposit,
    this.dailyDepositLimit,
    this.submissionEnabled = true,
    this.onRefreshAvailability,
    super.key,
  });
  final String depositFeeUsdt;
  final String? resubmitId;
  final String? minimumDeposit, dailyDepositLimit;
  final bool submissionEnabled;
  final Future<void> Function()? onRefreshAvailability;
  final bool embedded;

  /// Only the isolated preview deposit route enables local simulation.
  final bool preview;
  final Future<void> Function()? onSubmitted;
  @override
  ConsumerState<SubmitDepositPage> createState() => _ProofState();
}

class _ProofState extends ConsumerState<SubmitDepositPage> {
  final amount = TextEditingController(),
      hash = TextEditingController(),
      sender = TextEditingController(),
      note = TextEditingController();
  final formKey = GlobalKey<FormState>();
  PlatformFile? file;
  bool busy = false, pasted = false;
  bool refreshingAvailability = false;
  String? error, uploadedProof;
  String key = requestKey();
  DateTime? sentAt;
  @override
  void dispose() {
    for (final c in [amount, hash, sender, note]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> pick() async {
    try {
      final selected = await ref.read(depositProofPickerProvider)();
      if (selected == null || !mounted) return;
      final ext = selected.extension?.toLowerCase();
      if (!['jpg', 'jpeg', 'png', 'pdf'].contains(ext) ||
          selected.bytes == null ||
          selected.size == 0 ||
          selected.size > (publicTestMode ? 1048576 : 5242880)) {
        setState(
          () => error = publicTestMode
              ? 'Choose synthetic proof up to 1 MB.'
              : 'Choose a JPG, PNG or PDF file up to 5 MB.',
        );
        return;
      }
      HapticFeedback.selectionClick();
      setState(() {
        file = selected;
        uploadedProof = null;
        error = null;
      });
    } catch (_) {
      if (mounted) {
        setState(() => error = 'Could not open your files. Please try again.');
      }
    }
  }

  Future<void> pasteHash() async {
    try {
      final clip = await Clipboard.getData(Clipboard.kTextPlain);
      if (!mounted) return;
      final value = clip?.text?.trim() ?? '';
      if (value.isEmpty) {
        toast(context, 'Your clipboard is empty.');
        return;
      }
      setState(() {
        hash.text = value;
        pasted = true;
      });
      HapticFeedback.selectionClick();
    } catch (_) {
      if (mounted) {
        toast(context, 'Paste is unavailable. Enter your TxID manually.');
      }
    }
  }

  Future<void> generateTestReference() async {
    if (!publicTestMode || busy) return;
    setState(() => busy = true);
    try {
      final result = await ref
          .read(apiSessionProvider)
          .request('/test/reference', method: 'POST', data: {});
      if (mounted) setState(() => hash.text = result['txHash'] as String);
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> useTestProof() async {
    final data = await rootBundle.load('assets/test/synthetic-receipt.png');
    if (mounted) {
      setState(() {
        file = PlatformFile(
          name: 'TEST-NO-PAYMENT.png',
          size: data.lengthInBytes,
          bytes: data.buffer.asUint8List(),
        );
        uploadedProof = null;
        error = null;
      });
    }
  }

  Future<void> submit() async {
    if (!widget.submissionEnabled) return;
    if (busy) return;
    FocusManager.instance.primaryFocus?.unfocus();
    if (!formKey.currentState!.validate()) return;
    if (file == null && (!publicTestMode || widget.resubmitId != null)) {
      setState(() => error = 'Attach your payment proof before submitting.');
      return;
    }
    if (widget.preview && ref.read(previewModeProvider)) {
      await showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Preview request recorded'),
          content: Text(
            '${amount.text.trim()} USDT · Sample review pending.\n\n'
            'This is a local demonstration. No proof was uploaded, no request '
            'was sent, and your balance has not changed.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Done'),
            ),
          ],
        ),
      );
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final api = ref.read(apiSessionProvider);
      if (uploadedProof == null && file != null) {
        final ext = file!.extension?.toLowerCase();
        final mime = ext == 'pdf'
            ? 'application/pdf'
            : ext == 'png'
            ? 'image/png'
            : 'image/jpeg';
        final uploaded = await api.request(
          '/manual/files',
          method: 'POST',
          data: FormData.fromMap({
            'purpose': 'proof',
            'file': MultipartFile.fromBytes(
              file!.bytes!,
              filename: file!.name,
              contentType: DioMediaType.parse(mime),
            ),
          }),
        );
        final proofId = uploaded['id'];
        if (proofId is! String || proofId.isEmpty) {
          throw StateError('Proof upload did not complete. Please try again.');
        }
        uploadedProof = proofId;
      }
      if (widget.resubmitId != null) {
        await api.request(
          '/manual/deposits/${widget.resubmitId}/resubmit',
          method: 'POST',
          data: {'proofId': uploadedProof, 'note': note.text.trim()},
        );
        if (mounted) Navigator.pop(context);
        return;
      }
      final r = await api.request(
        '/manual/deposits',
        method: 'POST',
        idempotencyKey: key,
        data: {
          'amountUsdt': amount.text.trim(),
          'network': 'TRC20',
          'txHash': hash.text.trim(),
          if (sender.text.trim().isNotEmpty) 'sender': sender.text.trim(),
          if (sentAt != null)
            'transactionTime': sentAt!.toUtc().toIso8601String(),
          if (uploadedProof != null) 'proofId': uploadedProof,
          'note': note.text.trim(),
        },
      );
      await widget.onSubmitted?.call();
      if (mounted) {
        HapticFeedback.lightImpact();
        // No wallet mutation or optimistic credit. A successful API response
        // only acknowledges receipt of unverified user evidence.
        final page = MaterialPageRoute<void>(
          builder: (_) => DepositSubmittedPage(
            id: r['id'],
            amount: amount.text.trim(),
            txId: hash.text.trim(),
            submittedAt:
                DateTime.tryParse(
                  r['created_at']?.toString() ?? '',
                )?.toLocal() ??
                DateTime.now(),
          ),
        );
        if (widget.embedded) {
          await Navigator.of(context).push(page);
          if (mounted) {
            setState(() {
              amount.clear();
              hash.clear();
              file = null;
              uploadedProof = null;
              key = requestKey();
            });
          }
        } else {
          await Navigator.of(context).pushReplacement(page);
        }
      }
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final reduced = MediaQuery.disableAnimationsOf(context);
    final ratePaise = ref.watch(previewProvider.select((s) => s.ratePaise));
    final units = PreviewMoney.parseUsdt(amount.text);
    final feeUnits = PreviewMoney.parseUsdt(widget.depositFeeUsdt);
    final netUnits = units != null && feeUnits != null && units > feeUnits
        ? units - feeUnits
        : null;
    final estimate = units != null && units > BigInt.zero && ratePaise > 0
        ? PreviewMoney.inr(PreviewMoney.gross(units, ratePaise))
        : null;
    final canSubmit =
        !busy &&
        widget.submissionEnabled &&
        (file != null || (publicTestMode && widget.resubmitId == null)) &&
        (widget.resubmitId != null ||
            (validateDepositAmount(
                      amount.text,
                      minimum: widget.minimumDeposit,
                      dailyLimit: widget.dailyDepositLimit,
                    ) ==
                    null &&
                validateDepositTxId(hash.text) == null));
    final children = <Widget>[
      Form(
        key: formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (widget.resubmitId == null) ...[
              const SizedBox(height: 24),
              TintedCard(
                key: const Key('deposit-amount-card'),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const _DepositHeading(
                      '1 · AMOUNT',
                      'Deposit amount',
                      Icons.account_balance_wallet_outlined,
                    ),
                    TextFormField(
                      key: const Key('deposit-amount'),
                      controller: amount,
                      enabled: !busy,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      inputFormatters: [
                        TextInputFormatter.withFunction(
                          (oldValue, newValue) =>
                              RegExp(
                                r'^\d{0,8}(\.\d{0,6})?$',
                              ).hasMatch(newValue.text)
                              ? newValue
                              : oldValue,
                        ),
                      ],
                      validator: (value) => validateDepositAmount(
                        value,
                        minimum: widget.minimumDeposit,
                        dailyLimit: widget.dailyDepositLimit,
                      ),
                      autovalidateMode: AutovalidateMode.onUserInteraction,
                      onChanged: (_) => setState(() {}),
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: dtColor(context, DtColors.white),
                        labelText: 'Deposit Amount (USDT)',
                        errorMaxLines: 3,
                        hintText: '100.00',
                        prefixIcon: Padding(
                          padding: EdgeInsets.all(12),
                          child: UsdtTokenIcon(size: 24),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Semantics(
                      liveRegion: true,
                      child: Container(
                        key: const Key('deposit-inr-estimate'),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: DtColors.mint.withValues(alpha: .10),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: DtColors.teal.withValues(alpha: .16),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Estimated INR value',
                              style: TextStyle(
                                fontSize: 12,
                                color: dtColor(context, DtColors.muted),
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              estimate == null ? '—' : '≈ $estimate INR',
                              style: TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.w700,
                                color: dtColor(context, DtColors.navy),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      ratePaise <= 0
                          ? 'Rate unavailable. You can still submit your USDT deposit proof.'
                          : '${ref.watch(previewModeProvider) ? 'Sample rate' : 'Indicative rate'} · '
                                '1 USDT = ${PreviewMoney.inr(BigInt.from(ratePaise))}. '
                                'Estimate only; not a locked quote or payout.',
                      style: TextStyle(
                        fontSize: 11,
                        color: dtColor(context, DtColors.muted),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              TintedCard(
                key: const Key('deposit-hash-card'),
                tint: dtColor(context, DtColors.softBlue),
                accent: DtColors.blue,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const _DepositHeading(
                      '2 · TRANSACTION HASH',
                      'Transaction Hash',
                      Icons.link_rounded,
                    ),
                    Text(
                      publicTestMode
                          ? 'Generate a simulated reference. No blockchain transaction is required.'
                          : 'Paste the TxID from the wallet or exchange you used to send USDT.',
                    ),
                    if (publicTestMode)
                      DtButton(
                        label: 'Generate simulated TxID',
                        onPressed: busy ? null : generateTestReference,
                      ),
                    const SizedBox(height: 16),
                    TextFormField(
                      key: const Key('deposit-txid'),
                      controller: hash,
                      enabled: !busy,
                      minLines: 2,
                      maxLines: 4,
                      autocorrect: false,
                      enableSuggestions: false,
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 13,
                      ),
                      autovalidateMode: AutovalidateMode.onUserInteraction,
                      validator: validateDepositTxId,
                      onChanged: (_) => setState(() {}),
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: dtColor(context, DtColors.white),
                        labelText: 'Transaction hash / TxID',
                        errorMaxLines: 3,
                        hintText: 'Paste your 64-character TxID',
                      ),
                    ),
                    Wrap(
                      alignment: WrapAlignment.end,
                      spacing: 8,
                      children: [
                        TextButton.icon(
                          onPressed: busy ? null : pasteHash,
                          icon: const Icon(
                            Icons.content_paste_rounded,
                            size: 18,
                          ),
                          label: const Text('Paste TxID'),
                        ),
                        TextButton(
                          onPressed: busy
                              ? null
                              : () => setState(() {
                                  hash.clear();
                                  pasted = false;
                                }),
                          child: const Text('Clear'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    AnimatedSwitcher(
                      duration: reduced
                          ? Duration.zero
                          : const Duration(milliseconds: 180),
                      child: pasted
                          ? Padding(
                              padding: EdgeInsets.only(bottom: 12),
                              child: Text(
                                'TxID pasted · Admin verification required',
                                key: ValueKey('txid-pasted'),
                                style: TextStyle(
                                  fontSize: 11,
                                  color: dtColor(context, Color(0xFF087E64)),
                                ),
                              ),
                            )
                          : const SizedBox.shrink(),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 24),
            AnimatedSize(
              duration: reduced
                  ? Duration.zero
                  : const Duration(milliseconds: 220),
              alignment: Alignment.topCenter,
              child: TintedCard(
                key: const Key('deposit-proof-card'),
                tint: Color.alphaBlend(
                  DtColors.aqua.withValues(alpha: .08),
                  dtColor(context, DtColors.white),
                ),
                accent: DtColors.aqua,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const _DepositHeading(
                      '3 · PAYMENT PROOF',
                      'Upload Deposit Proof',
                      Icons.image_outlined,
                    ),
                    Text(
                      publicTestMode
                          ? 'Optional demo proof. Do not upload real payment or personal documents.'
                          : 'Upload a screenshot showing the completed USDT transaction.',
                    ),
                    const SizedBox(height: 16),
                    DashedUploadFrame(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (file == null) ...[
                            const Icon(
                              Icons.add_photo_alternate_outlined,
                              size: 36,
                              color: DtColors.blue,
                            ),
                            const SizedBox(height: 12),
                            DtButton(
                              label: 'Upload Screenshot',
                              style: DtButtonStyle.secondary,
                              onPressed: busy ? null : pick,
                            ),
                            if (publicTestMode)
                              TextButton(
                                onPressed: busy ? null : useTestProof,
                                child: const Text(
                                  'Use demo proof — no payment',
                                ),
                              ),
                            const SizedBox(height: 8),
                            Text(
                              publicTestMode
                                  ? 'Synthetic JPG / PNG / PDF · Up to 1 MB'
                                  : 'JPG / JPEG / PNG · Up to 5 MB\nPDF also supported',
                              textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 11),
                            ),
                          ] else ...[
                            if (file!.extension?.toLowerCase() != 'pdf')
                              ClipRRect(
                                borderRadius: BorderRadius.circular(12),
                                child: Image.memory(
                                  file!.bytes!,
                                  height: 140,
                                  cacheWidth: 720,
                                  fit: BoxFit.contain,
                                  errorBuilder: (_, _, _) => const Padding(
                                    padding: EdgeInsets.all(20),
                                    child: Text(
                                      'Image preview unavailable. The file will be validated on submission.',
                                    ),
                                  ),
                                ),
                              )
                            else
                              const Icon(
                                Icons.picture_as_pdf_outlined,
                                size: 40,
                                color: DtColors.blue,
                              ),
                            const SizedBox(height: 10),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  Icons.check_circle_rounded,
                                  color: DtColors.teal,
                                  size: 18,
                                ),
                                SizedBox(width: 6),
                                Text(
                                  'Proof selected',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w600,
                                    color: dtColor(context, DtColors.navy),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              file!.name,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            Wrap(
                              alignment: WrapAlignment.center,
                              children: [
                                TextButton(
                                  onPressed: busy ? null : pick,
                                  child: const Text('Replace'),
                                ),
                                TextButton(
                                  onPressed: busy
                                      ? null
                                      : () => setState(() {
                                          file = null;
                                          uploadedProof = null;
                                        }),
                                  child: const Text('Remove'),
                                ),
                              ],
                            ),
                            Text(
                              widget.preview
                                  ? 'Selected for preview · stays on your device'
                                  : 'Ready to attach · uploaded only when you submit',
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontSize: 11),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            ExpansionTile(
              title: const Text('Optional details'),
              tilePadding: EdgeInsets.zero,
              children: [
                if (widget.resubmitId == null) ...[
                  TextField(
                    controller: sender,
                    enabled: !busy,
                    decoration: const InputDecoration(
                      labelText: 'Sender wallet (optional)',
                    ),
                  ),
                  TextButton(
                    onPressed: busy
                        ? null
                        : () async {
                            final date = await showDatePicker(
                              context: context,
                              firstDate: DateTime(2020),
                              lastDate: DateTime.now(),
                              initialDate: DateTime.now(),
                            );
                            if (date == null || !context.mounted) return;
                            final time = await showTimePicker(
                              context: context,
                              initialTime: TimeOfDay.now(),
                            );
                            if (time != null && mounted) {
                              setState(
                                () => sentAt = DateTime(
                                  date.year,
                                  date.month,
                                  date.day,
                                  time.hour,
                                  time.minute,
                                ),
                              );
                            }
                          },
                    child: Text(
                      sentAt == null
                          ? 'Transaction date / time (optional)'
                          : shortDate(sentAt!),
                    ),
                  ),
                ],
                TextField(
                  controller: note,
                  enabled: !busy,
                  maxLines: 3,
                  decoration: const InputDecoration(labelText: 'Note'),
                ),
              ],
            ),
            const SizedBox(height: 16),
            TintedCard(
              key: const Key('deposit-summary-card'),
              tint: dtColor(context, DtColors.softBlue),
              accent: DtColors.teal,
              child: Column(
                children: [
                  const DetailRow('Network', 'TRC20'),
                  if (widget.resubmitId == null) ...[
                    DetailRow(
                      'USDT amount',
                      amount.text.isEmpty ? '—' : '${amount.text} USDT',
                    ),
                    DetailRow(
                      'Deposit platform fee',
                      '${widget.depositFeeUsdt} USDT',
                    ),
                    DetailRow(
                      'Estimated net credit',
                      netUnits == null
                          ? '—'
                          : '${PreviewMoney.usdt(netUnits)} USDT',
                    ),
                    DetailRow('Estimated INR', estimate ?? '—', strong: true),
                    DetailRow(
                      'TxID',
                      hash.text.trim().isEmpty
                          ? '—'
                          : shortenedTxId(hash.text.trim()),
                    ),
                  ],
                  DetailRow(
                    'Proof',
                    file == null ? 'Not attached' : 'Attached',
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            InfoNote(
              widget.preview
                  ? 'Preview only. Your selected file stays on this device. Submitting simulates a review request and never credits your wallet.'
                  : 'A screenshot does not credit your wallet. Admin verification and approval are required before USDT is credited.',
            ),
            if (error != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Semantics(liveRegion: true, child: InfoNote(error!)),
              ),
            const SizedBox(height: 16),
            if (!widget.submissionEnabled) ...[
              Semantics(
                liveRegion: true,
                child: const InfoNote(
                  'Deposit submissions are unavailable. Check availability before submitting.',
                ),
              ),
              if (widget.onRefreshAvailability != null)
                TextButton(
                  onPressed: refreshingAvailability
                      ? null
                      : () async {
                          setState(() => refreshingAvailability = true);
                          try {
                            await widget.onRefreshAvailability!();
                          } catch (e) {
                            if (mounted) setState(() => error = apiMessage(e));
                          } finally {
                            if (mounted) {
                              setState(() => refreshingAvailability = false);
                            }
                          }
                        },
                  child: Text(
                    refreshingAvailability ? 'Checking…' : 'Check availability',
                  ),
                ),
            ],
            DtButton(
              label: busy ? 'Submitting…' : 'Submit Deposit Request',
              loading: busy,
              onPressed: canSubmit ? submit : null,
            ),
          ],
        ),
      ),
    ];
    return widget.embedded
        ? Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: children,
          )
        : AppPage(
            title: widget.resubmitId == null
                ? 'Submit Deposit Proof'
                : 'Provide More Information',
            subtitle: 'Your TxID is required for blockchain verification.',
            children: children,
          );
  }
}

class DepositSubmittedPage extends StatelessWidget {
  const DepositSubmittedPage({
    required this.id,
    required this.amount,
    required this.txId,
    required this.submittedAt,
    super.key,
  });
  final String id, amount, txId;
  final DateTime submittedAt;
  @override
  Widget build(BuildContext context) => AppPage(
    title: 'Deposit Submitted',
    children: [
      DtReveal(
        child: Center(
          child: CircleAvatar(
            radius: 36,
            backgroundColor: dtColor(context, DtColors.softMint),
            child: Icon(Icons.task_alt_rounded, size: 38, color: DtColors.teal),
          ),
        ),
      ),
      const SizedBox(height: 24),
      Text(
        'Deposit Submitted',
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.headlineSmall,
      ),
      const SizedBox(height: 12),
      const Text(
        'Your deposit proof has been submitted for review.',
        textAlign: TextAlign.center,
      ),
      const SizedBox(height: 24),
      SurfaceCard(
        child: Column(
          children: [
            DetailRow('USDT amount', '$amount USDT'),
            DetailRow('TxID', shortenedTxId(txId)),
            DetailRow('Submission time', shortDate(submittedAt)),
            const DetailRow('Status', 'Under Review'),
          ],
        ),
      ),
      const SizedBox(height: 16),
      const InfoNote(
        'Proof submitted · No balance has been credited. Admin approval is required.',
      ),
      const SizedBox(height: 24),
      DtButton(
        label: 'View Deposit Status',
        onPressed: () => Navigator.of(context).pushReplacement(
          MaterialPageRoute<void>(builder: (_) => ManualDepositDetail(id: id)),
        ),
      ),
    ],
  );
}

class ManualDepositDetail extends ConsumerStatefulWidget {
  const ManualDepositDetail({required this.id, super.key});
  final String id;
  @override
  ConsumerState<ManualDepositDetail> createState() => _DetailState();
}

class _DetailState extends ConsumerState<ManualDepositDetail> {
  Map<String, dynamic>? data;
  String? error;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final d = await ref
          .read(apiSessionProvider)
          .request('/manual/deposits/${widget.id}');
      if (!mounted) return;
      setState(() {
        data = Map<String, dynamic>.from(d);
        error = null;
      });
      if (d['status'] == 'CREDITED') {
        await ref.read(previewProvider.notifier).loadWalletApi();
      }
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    }
  }

  @override
  Widget build(BuildContext context) => AppPage(
    title: data?['status'] == 'CREDITED'
        ? 'Deposit Approved'
        : 'Deposit Review',
    children: [
      if (error != null) InfoNote(error!),
      if (data == null)
        const CircularProgressIndicator()
      else ...[
        if (data!['status'] == 'CREDITED') const Center(child: SuccessMark()),
        const SizedBox(height: 20),
        SurfaceCard(
          child: Column(
            children: [
              DetailRow('USDT', data!['submitted_amount'].toString()),
              DetailRow(
                'Status',
                data!['status'].toString().replaceAll('_', ' '),
              ),
              DetailRow('TxID', data!['tx_hash']),
              DetailRow('Deposit ID', widget.id),
            ],
          ),
        ),
        InfoNote(
          data!['status'] == 'CREDITED'
              ? 'Your verified USDT has been credited to your wallet.'
              : 'Your proof is being reviewed. No balance is credited until approval.',
        ),
        if (data!['reason'] != null) InfoNote(data!['reason']),
        ...((data!['timeline'] ?? []) as List).map(
          (r) => ListTile(
            leading: const Icon(
              Icons.check_circle_outline,
              color: DtColors.teal,
            ),
            title: Text(r['to_status'].toString().replaceAll('_', ' ')),
            subtitle: Text(r['created_at'].toString()),
          ),
        ),
        if (data!['proof_id'] != null)
          PrivateReceiptButton(
            id: data!['proof_id'],
            label: 'View submitted proof',
          ),
        if (['REJECTED', 'REQUIRES_MORE_INFORMATION'].contains(data!['status']))
          DtButton(
            label: 'Provide More Information',
            onPressed: () async {
              await Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => SubmitDepositPage(resubmitId: widget.id),
                ),
              );
              load();
            },
          ),
      ],
      DtButton(
        label: 'Refresh status',
        style: DtButtonStyle.secondary,
        onPressed: load,
      ),
    ],
  );
}

class PrivateReceiptButton extends ConsumerWidget {
  const PrivateReceiptButton({
    required this.id,
    this.label = 'View Payment Proof',
    super.key,
  });
  final String id, label;
  @override
  Widget build(BuildContext context, WidgetRef ref) => DtButton(
    label: label,
    style: DtButtonStyle.secondary,
    onPressed: () async {
      try {
        final f = await ref
            .read(apiSessionProvider)
            .request('/manual/files/$id');
        final bytes = base64Decode(f['base64']);
        if (!context.mounted) return;
        if (f['mime'] == 'application/pdf') {
          await FilePicker.saveFile(
            dialogTitle: label,
            fileName: 'DT-Exchange-receipt.pdf',
            bytes: bytes,
            type: FileType.custom,
            allowedExtensions: ['pdf'],
          );
        } else {
          await Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => AppPage(
                title: label,
                children: [
                  SizedBox(
                    height: MediaQuery.sizeOf(context).height * .6,
                    child: InteractiveViewer(
                      minScale: 1,
                      maxScale: 5,
                      child: Image.memory(bytes, fit: BoxFit.contain),
                    ),
                  ),
                  DtButton(
                    label: 'Download Payment Proof',
                    icon: Icons.download_rounded,
                    onPressed: () async {
                      try {
                        await FilePicker.saveFile(
                          dialogTitle: 'Save private payment proof',
                          fileName:
                              'DT-Exchange-proof.${f['mime'] == 'image/png' ? 'png' : 'jpg'}',
                          bytes: bytes,
                          type: FileType.custom,
                          allowedExtensions: [
                            f['mime'] == 'image/png' ? 'png' : 'jpg',
                          ],
                        );
                      } catch (_) {
                        if (context.mounted) {
                          toast(
                            context,
                            'Unable to save proof. Please try again.',
                          );
                        }
                      }
                    },
                  ),
                ],
              ),
            ),
          );
        }
      } catch (e) {
        if (context.mounted) toast(context, apiMessage(e));
      }
    },
  );
}
