import 'models.dart';
import 'money.dart';

const previewDepositAddress = 'DT-PREVIEW-TRC20-NOT-A-PAYMENT-ADDRESS';
const previewReferralLink = 'https://example.com/dt-exchange/ref/DTASHIK20';
const previewOtp = '123456';
// Sample data only. Connected mode obtains its rate from /rates/usdt-inr.
const previewRatePaise = 10300;
PreviewState seedPreview() {
  const banks = [
    PreviewBank(
      id: 'bank-hdfc',
      holder: 'Ashik Omer',
      number: '000000008421',
      ifsc: 'HDFC0000001',
      name: 'HDFC Bank',
    ),
    PreviewBank(
      id: 'bank-federal',
      holder: 'Ashik Omer',
      number: '000000002390',
      ifsc: 'FDRL0000001',
      name: 'Federal Bank',
    ),
  ];
  final now = DateTime(2026, 9, 20, 15, 30);
  final q = PreviewQuote(
    id: 'DEMO-Q-1001',
    amount: PreviewMoney.parseUsdt('250')!,
    ratePaise: previewRatePaise,
    bank: banks.first,
    mode: FundingMode.wallet,
    expiresAt: now,
  );
  return PreviewState(
    ratePaise: previewRatePaise,
    balance: PreviewMoney.parseUsdt('1248.50')!,
    banks: banks,
    transactions: [
      PreviewTransaction(
        id: 'DT-DEMO-240920',
        kind: TransactionKind.sell,
        amount: q.amount,
        inrPaise: q.net,
        date: now,
        quote: q,
      ),
      PreviewTransaction(
        id: 'DT-DEMO-240919',
        kind: TransactionKind.deposit,
        amount: PreviewMoney.parseUsdt('500')!,
        inrPaise: PreviewMoney.gross(
          PreviewMoney.parseUsdt('500')!,
          previewRatePaise,
        ),
        date: now.subtract(const Duration(hours: 3)),
        txId: 'DEMO-TRON-TX-A91C52DE',
      ),
      PreviewTransaction(
        id: 'DT-DEMO-240918',
        kind: TransactionKind.payout,
        amount: q.amount,
        inrPaise: q.net,
        date: now.subtract(const Duration(days: 1)),
        quote: q,
      ),
      PreviewTransaction(
        id: 'DT-DEMO-240917',
        kind: TransactionKind.deposit,
        amount: PreviewMoney.parseUsdt('100')!,
        inrPaise: PreviewMoney.gross(
          PreviewMoney.parseUsdt('100')!,
          previewRatePaise,
        ),
        date: now.subtract(const Duration(days: 1, hours: 2)),
        status: TransactionState.processing,
        stage: 2,
        txId: 'DEMO-TRON-TX-8BC012FA',
        utr: '',
      ),
    ],
    notices: [
      const PreviewNotice(
        id: 'n1',
        title: 'Your INR payout is complete',
        body: 'Your sample payout reached HDFC Bank ••8421.',
        time: '10 min ago',
        route: '/history/DT-DEMO-240918',
      ),
      const PreviewNotice(
        id: 'n2',
        title: '500 USDT received',
        body: 'Your sample deposit is confirmed and available.',
        time: '3 hours ago',
        route: '/history/DT-DEMO-240919',
      ),
      const PreviewNotice(
        id: 'n3',
        title: 'Welcome to DT Exchange',
        body: 'A simpler way to sell USDT and receive INR.',
        time: 'Yesterday',
        route: '/home',
        read: true,
      ),
    ],
  );
}
