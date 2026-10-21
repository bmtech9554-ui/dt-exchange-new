import 'money.dart';

enum TransactionKind { deposit, sell, payout }

enum TransactionState { pending, processing, completed, failed, reversed }

enum FundingMode { wallet, onchain }

class PreviewBank {
  const PreviewBank({
    required this.id,
    required this.holder,
    required this.number,
    required this.ifsc,
    required this.name,
    this.verified = true,
    bool? available,
  }) : available = available ?? verified;
  final String id, holder, number, ifsc, name;
  final bool verified;
  final bool available;
  String get last4 => number.substring(number.length - 4);
}

class PreviewQuote {
  PreviewQuote({
    required this.id,
    required this.amount,
    required this.ratePaise,
    required this.bank,
    required this.mode,
    required this.expiresAt,
    this.serverFee,
    this.serverNet,
    this.serverRate,
  });
  final String id;
  final BigInt amount;
  final int ratePaise;
  final PreviewBank bank;
  final FundingMode mode;
  final DateTime expiresAt;
  final BigInt? serverFee, serverNet;
  final String? serverRate;
  BigInt get gross => serverNet != null
      ? serverNet! + serverFee!
      : PreviewMoney.gross(amount, ratePaise);
  BigInt get fee => serverFee ?? PreviewMoney.fee(gross);
  BigInt get net => serverNet ?? gross - fee;
}

class PreviewTransaction {
  const PreviewTransaction({
    required this.id,
    required this.kind,
    required this.amount,
    required this.inrPaise,
    required this.date,
    this.status = TransactionState.completed,
    this.quote,
    this.stage = 6,
    this.txId = 'DEMO-TRON-TX-93F8A621',
    this.utr = 'DEMO-UTR-626304582719',
  });
  final String id, txId, utr;
  final TransactionKind kind;
  final TransactionState status;
  final BigInt amount, inrPaise;
  final DateTime date;
  final PreviewQuote? quote;
  final int stage;
  String get title => switch (kind) {
    TransactionKind.deposit => 'USDT Deposit',
    TransactionKind.sell => 'USDT Sell',
    TransactionKind.payout => 'INR Payout',
  };
  PreviewTransaction withStage(int next) => PreviewTransaction(
    id: id,
    kind: kind,
    amount: amount,
    inrPaise: inrPaise,
    date: date,
    quote: quote,
    stage: next,
    status: next == 6
        ? TransactionState.completed
        : TransactionState.processing,
    txId: txId,
    utr: utr,
  );
}

class PreviewNotice {
  const PreviewNotice({
    required this.id,
    required this.title,
    required this.body,
    required this.time,
    required this.route,
    this.read = false,
  });
  final String id, title, body, time, route;
  final bool read;
  PreviewNotice markRead() => PreviewNotice(
    id: id,
    title: title,
    body: body,
    time: time,
    route: route,
    read: true,
  );
}

class PreviewTicket {
  const PreviewTicket(this.id, this.subject, this.message, this.category);
  final String id, subject, message, category;
}

class PreviewState {
  PreviewState({
    required this.balance,
    required this.banks,
    required this.transactions,
    required this.notices,
    this.signedIn = false,
    this.verified = true,
    this.name = 'Ashik Omer',
    this.email = 'ashik@example.com',
    this.mobile = '9000000000',
    this.defaultBankId = 'bank-hdfc',
    this.ratePaise = 0,
    this.hideBalance = false,
    this.biometric = false,
    this.twoFactor = false,
    this.pinSet = false,
    this.transactionAlerts = true,
    this.rateAlerts = true,
    this.marketing = false,
    this.reducedMotion = false,
    this.devices = const ['iPhone · Current device', 'Chrome · Windows'],
    this.tickets = const [],
    this.acceptedQuotes = const {},
    this.activeOrderId,
    this.quote,
  });
  final BigInt balance;
  final List<PreviewBank> banks;
  final List<PreviewTransaction> transactions;
  final List<PreviewNotice> notices;
  final List<String> devices;
  final List<PreviewTicket> tickets;
  final Set<String> acceptedQuotes;
  final bool signedIn,
      verified,
      hideBalance,
      biometric,
      twoFactor,
      pinSet,
      transactionAlerts,
      rateAlerts,
      marketing,
      reducedMotion;
  final String name, email, mobile, defaultBankId;
  final int ratePaise;
  final PreviewQuote? quote;
  final String? activeOrderId;
  PreviewBank get defaultBank =>
      banks.firstWhere((b) => b.id == defaultBankId, orElse: () => banks.first);
  int get unread => notices.where((n) => !n.read).length;
  PreviewState copyWith({
    BigInt? balance,
    List<PreviewBank>? banks,
    List<PreviewTransaction>? transactions,
    List<PreviewNotice>? notices,
    List<String>? devices,
    List<PreviewTicket>? tickets,
    Set<String>? acceptedQuotes,
    bool? signedIn,
    bool? verified,
    bool? hideBalance,
    bool? biometric,
    bool? twoFactor,
    bool? pinSet,
    bool? transactionAlerts,
    bool? rateAlerts,
    bool? marketing,
    bool? reducedMotion,
    String? name,
    String? email,
    String? mobile,
    String? defaultBankId,
    int? ratePaise,
    PreviewQuote? quote,
    String? activeOrderId,
    bool clearQuote = false,
    bool clearOrder = false,
  }) => PreviewState(
    balance: balance ?? this.balance,
    banks: banks ?? this.banks,
    transactions: transactions ?? this.transactions,
    notices: notices ?? this.notices,
    devices: devices ?? this.devices,
    tickets: tickets ?? this.tickets,
    acceptedQuotes: acceptedQuotes ?? this.acceptedQuotes,
    signedIn: signedIn ?? this.signedIn,
    verified: verified ?? this.verified,
    hideBalance: hideBalance ?? this.hideBalance,
    biometric: biometric ?? this.biometric,
    twoFactor: twoFactor ?? this.twoFactor,
    pinSet: pinSet ?? this.pinSet,
    transactionAlerts: transactionAlerts ?? this.transactionAlerts,
    rateAlerts: rateAlerts ?? this.rateAlerts,
    marketing: marketing ?? this.marketing,
    reducedMotion: reducedMotion ?? this.reducedMotion,
    name: name ?? this.name,
    email: email ?? this.email,
    mobile: mobile ?? this.mobile,
    defaultBankId: defaultBankId ?? this.defaultBankId,
    ratePaise: ratePaise ?? this.ratePaise,
    quote: clearQuote ? null : quote ?? this.quote,
    activeOrderId: clearOrder ? null : activeOrderId ?? this.activeOrderId,
  );
}
