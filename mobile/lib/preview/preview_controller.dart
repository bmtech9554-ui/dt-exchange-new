import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'fixtures.dart';
import '../core/api/api_client.dart';
import 'models.dart';
import 'money.dart';

final previewModeProvider = Provider<bool>(
  (_) => const bool.fromEnvironment('DT_PREVIEW', defaultValue: false),
);
final previewClockProvider = Provider<DateTime Function()>((_) => DateTime.now);
final previewProvider = NotifierProvider<PreviewController, PreviewState>(
  PreviewController.new,
);

class PreviewController extends Notifier<PreviewState> {
  Timer? _simulation;
  int _sequence = 100;
  @override
  PreviewState build() {
    ref.onDispose(() => _simulation?.cancel());
    return ref.read(previewModeProvider) ? seedPreview() : _empty();
  }

  PreviewState _empty() => PreviewState(
    balance: BigInt.zero,
    banks: [],
    transactions: [],
    notices: [],
    verified: false,
    name: 'Your account',
    email: '',
    mobile: '',
    defaultBankId: '',
    ratePaise: 0,
    devices: [],
  );
  ApiSession get api => ref.read(apiSessionProvider);
  String? challengeId, developmentOtp, resetToken, registrationOtpContact;
  String userId = '', accountStatus = '', rateSource = 'Unavailable';
  String publicUserId = '';
  String? loadError;
  bool sandboxRate = false, mobileVerified = false;
  bool contactOtp = false;
  Future<void> requestContactOtp() async {
    final r = await api.request(
      '/auth/contact/request-otp',
      method: 'POST',
      data: {'contact': state.mobile},
    );
    challengeId = r['challengeId'];
    developmentOtp = r['developmentOtp'];
    contactOtp = true;
  }

  List<Map<String, dynamic>> liveSessions = [];
  String _contact(String input) {
    final c = input.trim();
    return RegExp(r'^\d{10}$').hasMatch(c) ? '+91$c' : c;
  }

  Future<void> requestOtp(String contact, String purpose) async {
    final r = await api.request(
      '/auth/request-otp',
      method: 'POST',
      authenticated: false,
      data: {'contact': _contact(contact), 'purpose': purpose},
    );
    contactOtp = false;
    challengeId = r['challengeId'];
    developmentOtp = r['developmentOtp'];
  }

  Future<void> registerApi(
    String name,
    String email,
    String mobile,
    String password, {
    String? referralCode,
  }) async {
    final r = await api.request(
      '/auth/register',
      method: 'POST',
      authenticated: false,
      data: {
        'fullName': name.trim(),
        if (referralCode != null && referralCode.trim().isNotEmpty)
          'referralCode': referralCode.trim().toUpperCase(),
        'email': email.trim(),
        'mobile': _contact(mobile),
        'password': password,
        'termsAccepted': true,
      },
    );
    challengeId = r['challengeId'];
    developmentOtp = r['developmentOtp'];
    registrationOtpContact = r['otpContact'] as String? ?? email.trim();
  }

  Future<void> loginApi(String contact, String password) async {
    final r = await api.request(
      '/auth/login',
      method: 'POST',
      authenticated: false,
      data: {
        'contact': _contact(contact),
        'password': password,
        'deviceId': await api.deviceId(),
        'deviceLabel': 'DT Exchange app',
      },
    );
    await api.accept(Map<String, dynamic>.from(r));
    await loadAccount();
  }

  Future<void> verifyOtpApi(String code) async {
    if (challengeId == null) throw StateError('Request a new code');
    final r = await api.request(
      contactOtp ? '/auth/contact/verify-otp' : '/auth/verify-otp',
      method: 'POST',
      authenticated: contactOtp,
      data: {
        'challengeId': challengeId,
        'code': code,
        'deviceId': await api.deviceId(),
      },
    );
    if (r['contactVerified'] == true) {
      contactOtp = false;
      await loadAccount();
      return;
    }
    if (r['resetToken'] != null) {
      resetToken = r['resetToken'];
      return;
    }
    await api.accept(Map<String, dynamic>.from(r));
    await loadAccount();
  }

  Future<void> restore() async {
    if (ref.read(previewModeProvider)) return;
    try {
      await api.refresh();
      await loadAccount();
    } catch (_) {
      state = _empty();
    }
  }

  Future<void> loadAccount() async {
    final u = await api.request('/users/me');
    userId = u['id'];
    publicUserId = u['publicUserId']?.toString() ?? '';
    mobileVerified = u['mobileVerified'] == true;
    accountStatus = u['accountStatus'];
    state = state.copyWith(
      signedIn: true,
      name: u['fullName'],
      email: u['email'] ?? '',
      mobile: u['mobile'] ?? '',
      verified: u['verificationStatus'] == 'VERIFIED',
    );
    try {
      await loadBanks();
      await refreshRateApi();
      await loadWalletApi();
      await loadRecentApi();
      final settings = await api.request('/settings');
      if (settings is Map && settings['preferences'] is Map) {
        state = state.copyWith(
          pinSet: settings['pinSet'] == true,
          reducedMotion: settings['preferences']['animations'] == false,
        );
      }
      loadError = null;
    } catch (e) {
      loadError = apiMessage(e);
      state = state.copyWith();
    }
  }

  Future<void> loadRecentApi() async {
    final response = await api.request('/history?limit=5');
    final items = (response['items'] as List).map((dynamic t) {
      final text = (t['amount_usdt'] ?? '0').toString().split('.');
      final amount =
          BigInt.parse(text[0]) * BigInt.from(1000000) +
          BigInt.parse(
            (text.length > 1 ? text[1] : '').padRight(6, '0').substring(0, 6),
          );
      final status = t['status'] as String;
      return PreviewTransaction(
        id: t['id'],
        kind: t['type'] == 'sell'
            ? TransactionKind.sell
            : t['type'] == 'deposits'
            ? TransactionKind.deposit
            : TransactionKind.payout,
        amount: amount,
        inrPaise: BigInt.parse(t['inr_minor'] ?? '0'),
        date: DateTime.parse(t['created_at']),
        status: ['credited', 'success', 'completed'].contains(status)
            ? TransactionState.completed
            : ['failed', 'expired', 'cancelled'].contains(status)
            ? TransactionState.failed
            : status == 'reversed'
            ? TransactionState.reversed
            : TransactionState.processing,
        stage: 0,
        txId: '',
        utr: '',
      );
    }).toList();
    state = state.copyWith(transactions: items);
  }

  Future<void> loadWalletApi() async {
    final w = await api.request('/wallet');
    updateWalletSnapshot(Map<String, dynamic>.from(w));
  }

  // Share only the server's authoritative wallet snapshot across screens.
  void updateWalletSnapshot(Map<String, dynamic> w) {
    final text = w['availableUsdt'] as String;
    final parts = text.split('.');
    final amount =
        BigInt.parse(parts[0]) * BigInt.from(1000000) +
        BigInt.parse(
          (parts.length > 1 ? parts[1] : '').padRight(6, '0').substring(0, 6),
        );
    state = state.copyWith(balance: amount);
  }

  Future<void> refreshRateApi() async {
    try {
      final r = await api.request('/rates/usdt-inr');
      final parts = (r['exchangeRate'] as String).split('.');
      rateSource = r['source'];
      sandboxRate = r['sandbox'] == true;
      state = state.copyWith(
        ratePaise:
            int.parse(parts[0]) * 100 +
            int.parse(
              (parts.length > 1 ? parts[1] : '')
                  .padRight(2, '0')
                  .substring(0, 2),
            ),
      );
    } catch (_) {
      // A failed rate read must not present a previous value as current.
      state = state.copyWith(ratePaise: 0);
      rethrow;
    }
  }

  Future<void> loadBanks() async {
    final rows = await api.request('/bank-accounts') as List;
    final banks = rows
        .map(
          (b) => PreviewBank(
            id: b['id'],
            holder: b['accountHolderName'],
            number: b['accountNumber'],
            ifsc: b['ifsc'],
            name: b['bankName'],
            verified: b['verificationStatus'] == 'VERIFIED',
            available:
                b['available'] == true || b['verificationStatus'] == 'VERIFIED',
          ),
        )
        .toList();
    String id = '';
    for (final b in rows) {
      if (b['isDefault'] == true) id = b['id'];
    }
    state = state.copyWith(banks: banks, defaultBankId: id);
  }

  Future<void> addBankApi(
    String holder,
    String number,
    String ifsc,
    String name,
  ) async {
    await api.request(
      '/bank-accounts',
      method: 'POST',
      idempotencyKey: requestKey(),
      data: {
        'accountHolderName': holder.trim(),
        'accountNumber': number,
        'ifsc': ifsc.toUpperCase(),
        'bankName': name.trim(),
      },
    );
    await loadBanks();
  }

  Future<void> defaultBankApi(String id) async {
    await api.request('/bank-accounts/$id/default', method: 'PATCH');
    await loadBanks();
  }

  Future<void> removeBankApi(String id) async {
    await api.request('/bank-accounts/$id', method: 'DELETE');
    await loadBanks();
  }

  Future<void> _quoteQueue = Future.value();
  Future<PreviewQuote> quoteApi(
    String input,
    String bankId, {
    FundingMode mode = FundingMode.onchain,
  }) {
    final next = _quoteQueue.then((_) => _quoteApi(input, bankId, mode));
    _quoteQueue = next.then<void>((_) {}, onError: (Object _, StackTrace _) {});
    return next;
  }

  Future<PreviewQuote> _quoteApi(
    String input,
    String bankId,
    FundingMode mode,
  ) async {
    if (state.quote?.serverNet != null) {
      try {
        await api.request('/sell/quote/${state.quote!.id}', method: 'DELETE');
      } catch (_) {
        /* Expired/used quotes remain server-controlled. */
      }
    }
    final r = await api.request(
      '/sell/quote',
      method: 'POST',
      idempotencyKey: requestKey(),
      data: {
        'amountUsdt': input,
        if (mode == FundingMode.wallet) 'fundingSource': mode.name,
        if (bankId.isNotEmpty) 'bankAccountId': bankId,
      },
    );
    final bank = state.banks.firstWhere((b) => b.id == r['bankAccountId']);
    final a = (r['amountUsdt'] as String).split('.');
    final amount = PreviewMoney.parseUsdt(
      '${a[0]}.${(a.length > 1 ? a[1] : '').padRight(6, '0').substring(0, 6)}',
    )!;
    final rate = (r['exchangeRate'] as String).split('.');
    final q = PreviewQuote(
      id: r['quoteId'],
      amount: amount,
      ratePaise: int.parse(rate[0]) * 100 + int.parse(rate[1].substring(0, 2)),
      bank: bank,
      mode: r['fundingSource'] == 'wallet'
          ? FundingMode.wallet
          : r['fundingSource'] == 'onchain'
          ? FundingMode.onchain
          : mode,
      expiresAt: DateTime.parse(r['expiresAt']),
      serverRate: r['exchangeRate'],
      serverFee: BigInt.parse(r['feeInrMinor']),
      serverNet: BigInt.parse(r['finalInrMinor']),
    );
    state = state.copyWith(quote: q);
    return q;
  }

  Future<void> activateApi() async {
    final r = await api.request(
      '/verification/start',
      method: 'POST',
      data: {},
      idempotencyKey: requestKey(),
    );
    for (final record in r['records']) {
      await api.request(
        '/verification/submit',
        method: 'POST',
        idempotencyKey: requestKey(),
        data: {'verificationId': record['id']},
      );
    }
    await loadAccount();
  }

  Future<void> logoutApi() async {
    try {
      await api.request('/auth/logout', method: 'POST');
    } finally {
      await api.clear();
      state = _empty();
    }
  }

  Future<void> loadSessions() async {
    liveSessions = (await api.request('/sessions') as List)
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
    state = state.copyWith();
  }

  Future<void> logoutDevice(String id) async {
    await api.request('/sessions/$id', method: 'DELETE');
    await loadSessions();
  }

  Future<void> logoutOthers() async {
    await api.request('/sessions/logout-others', method: 'POST');
    await loadSessions();
  }

  Future<void> passwordApi(String password, {String? current}) async {
    if (current == null) {
      await api.request(
        '/auth/reset-password',
        method: 'POST',
        authenticated: false,
        data: {'resetToken': resetToken, 'password': password},
      );
      resetToken = null;
    } else {
      await api.request(
        '/auth/change-password',
        method: 'POST',
        data: {'currentPassword': current, 'password': password},
      );
    }
    await api.clear();
    state = _empty();
  }

  void _requirePreview() {
    if (!ref.read(previewModeProvider)) {
      throw StateError('Preview mode is disabled');
    }
  }

  void login() {
    _requirePreview();
    state = state.copyWith(signedIn: true);
  }

  void register(String name, String email, String mobile) {
    _requirePreview();
    state = state.copyWith(
      name: name.trim(),
      email: email.trim(),
      mobile: mobile.trim(),
      verified: false,
    );
  }

  void activate() {
    _requirePreview();
    state = state.copyWith(verified: true);
  }

  void logout() {
    _simulation?.cancel();
    state = ref.read(previewModeProvider) ? seedPreview() : _empty();
  }

  void updateProfile(String name, String email, String mobile) {
    state = state.copyWith(
      name: name,
      email: email,
      mobile: mobile,
      verified:
          email == state.email && mobile == state.mobile && state.verified,
    );
  }

  void hideBalance() {
    state = state.copyWith(hideBalance: !state.hideBalance);
  }

  void refreshRate() {
    _requirePreview();
    state = state.copyWith(ratePaise: previewRatePaise);
  }

  void preference(String key, bool value) {
    state = switch (key) {
      'biometric' => state.copyWith(biometric: value),
      'twoFactor' => state.copyWith(twoFactor: value),
      'pin' => state.copyWith(pinSet: value),
      'transactions' => state.copyWith(transactionAlerts: value),
      'rates' => state.copyWith(rateAlerts: value),
      'marketing' => state.copyWith(marketing: value),
      'motion' => state.copyWith(reducedMotion: value),
      _ => state,
    };
  }

  void revokeDevice(String device) {
    if (!device.contains('Current')) {
      state = state.copyWith(
        devices: state.devices.where((d) => d != device).toList(),
      );
    }
  }

  void addBank({
    required String holder,
    required String number,
    required String ifsc,
    required String name,
  }) {
    _requirePreview();
    if (state.banks.any((b) => b.number == number && b.ifsc == ifsc)) {
      throw StateError('This bank account is already added.');
    }
    state = state.copyWith(
      banks: [
        ...state.banks,
        PreviewBank(
          id: 'bank-${++_sequence}',
          holder: holder,
          number: number,
          ifsc: ifsc.toUpperCase(),
          name: name,
        ),
      ],
    );
  }

  void setDefaultBank(String id) {
    if (state.banks.any((b) => b.id == id && b.verified)) {
      state = state.copyWith(defaultBankId: id);
    }
  }

  PreviewQuote makeQuote(String input, FundingMode mode, String bankId) {
    _requirePreview();
    final amount = PreviewMoney.parseUsdt(input);
    if (amount == null ||
        amount < PreviewMoney.scale * BigInt.from(10) ||
        amount > PreviewMoney.scale * BigInt.from(10000)) {
      throw StateError(
        'Enter between 10 and 10,000 USDT, with up to 6 decimals.',
      );
    }
    if (mode == FundingMode.wallet && amount > state.balance) {
      throw StateError('Amount exceeds your available USDT balance.');
    }
    final bank = state.banks.firstWhere((b) => b.id == bankId && b.verified);
    final quote = PreviewQuote(
      id: 'DEMO-Q-${++_sequence}',
      amount: amount,
      ratePaise: state.ratePaise,
      bank: bank,
      mode: mode,
      expiresAt: ref
          .read(previewClockProvider)()
          .add(const Duration(seconds: 90)),
    );
    state = state.copyWith(quote: quote);
    return quote;
  }

  String confirmQuote() {
    _requirePreview();
    final q = state.quote;
    if (q == null) throw StateError('Enter an amount to create a quote.');
    if (state.acceptedQuotes.contains(q.id)) {
      return state.transactions
          .firstWhere(
            (t) => t.quote?.id == q.id && t.kind == TransactionKind.sell,
          )
          .id;
    }
    if (ref.read(previewClockProvider)().isAfter(q.expiresAt)) {
      throw StateError('Your quote expired. Please refresh the quote.');
    }
    if (q.mode == FundingMode.wallet && q.amount > state.balance) {
      throw StateError('Insufficient available balance.');
    }
    final id = 'DT-DEMO-${++_sequence}';
    final tx = PreviewTransaction(
      id: id,
      kind: TransactionKind.sell,
      amount: q.amount,
      inrPaise: q.net,
      date: ref.read(previewClockProvider)(),
      status: TransactionState.pending,
      quote: q,
      stage: q.mode == FundingMode.wallet ? 3 : 0,
      txId: 'DEMO-TRON-$id',
      utr: 'DEMO-UTR-${100000 + _sequence}',
    );
    state = state.copyWith(
      activeOrderId: id,
      acceptedQuotes: {...state.acceptedQuotes, q.id},
      transactions: [tx, ...state.transactions],
      balance: q.mode == FundingMode.wallet
          ? state.balance - q.amount
          : state.balance,
    );
    return id;
  }

  PreviewTransaction? findTransaction(String id) {
    for (final t in state.transactions) {
      if (t.id == id) return t;
    }
    return null;
  }

  /// Simulates provider events only after the user explicitly starts the demo.
  /// The "I have sent" UI action never calls this or changes a balance.
  void simulate(String id) {
    _requirePreview();
    _simulation?.cancel();
    final tx = findTransaction(id);
    if (tx == null || tx.kind != TransactionKind.sell || tx.stage >= 6) return;
    _simulation = Timer.periodic(const Duration(milliseconds: 1000), (timer) {
      advance(id);
      if (findTransaction(id)?.stage == 6) timer.cancel();
    });
  }

  void advance(String id) {
    _requirePreview();
    final tx = findTransaction(id);
    if (tx == null || tx.kind != TransactionKind.sell || tx.stage >= 6) return;
    final next = tx.withStage(tx.stage + 1);
    final transactions = state.transactions
        .map((t) => t.id == id ? next : t)
        .toList();
    var notices = state.notices;
    if (next.stage == 6) {
      transactions.insert(
        0,
        PreviewTransaction(
          id: '$id-PAYOUT',
          kind: TransactionKind.payout,
          amount: tx.amount,
          inrPaise: tx.inrPaise,
          date: ref.read(previewClockProvider)(),
          quote: tx.quote,
          utr: tx.utr,
          txId: tx.txId,
        ),
      );
      notices = [
        PreviewNotice(
          id: 'notice-$id',
          title: 'Preview payout completed',
          body: 'Your simulated INR payout is complete.',
          time: 'Just now',
          route: '/history/$id',
        ),
        ...notices,
      ];
    }
    state = state.copyWith(transactions: transactions, notices: notices);
  }

  void markRead(String id) {
    state = state.copyWith(
      notices: state.notices.map((n) => n.id == id ? n.markRead() : n).toList(),
    );
  }

  void markAllRead() {
    state = state.copyWith(
      notices: state.notices.map((n) => n.markRead()).toList(),
    );
  }

  String createTicket(String subject, String message, String category) {
    _requirePreview();
    final id = 'DT-HELP-${++_sequence}';
    state = state.copyWith(
      tickets: [
        PreviewTicket(id, subject, message, category),
        ...state.tickets,
      ],
    );
    return id;
  }
}
