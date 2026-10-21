import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dt_exchange/preview/preview_controller.dart';
import 'package:dt_exchange/preview/money.dart';
import 'package:dt_exchange/preview/models.dart';
import 'package:dt_exchange/preview/fixtures.dart';

void main() {
  test(
    'USDT parsing preserves six decimals and rejects ambiguous or unsafe inputs',
    () {
      expect(PreviewMoney.parseUsdt('1248.500001'), BigInt.from(1248500001));
      for (final text in [
        '1e3',
        '-10',
        'NaN',
        'Infinity',
        '1,000',
        '1.0000001',
        '100000000',
        '',
      ]) {
        expect(PreviewMoney.parseUsdt(text), isNull, reason: text);
      }
      expect(PreviewMoney.usdt(BigInt.from(1)), '0.000001');
      expect(PreviewMoney.inr(BigInt.from(11542383)), '₹1,15,423.83');
    },
  );
  test('preview execution requires explicit opt-in', () {
    final c = ProviderContainer();
    addTearDown(c.dispose);
    expect(() => c.read(previewProvider.notifier).login(), throwsStateError);
    expect(c.read(previewProvider).ratePaise, 0);
  });
  test('preview rate and exact conversions remain 103 after refresh', () {
    final c = ProviderContainer(
      overrides: [previewModeProvider.overrideWithValue(true)],
    );
    addTearDown(c.dispose);
    expect(previewRatePaise, 10300);
    for (final input in {
      '1': '₹103.00',
      '100': '₹10,300.00',
      '250': '₹25,750.00',
      '1.25': '₹128.75',
      '0.000001': '₹0.00',
    }.entries) {
      expect(
        PreviewMoney.inr(
          PreviewMoney.gross(
            PreviewMoney.parseUsdt(input.key)!,
            c.read(previewProvider).ratePaise,
          ),
        ),
        input.value,
      );
    }
    c.read(previewProvider.notifier).refreshRate();
    expect(c.read(previewProvider).ratePaise, 10300);
    expect(
      c
          .read(previewProvider)
          .transactions
          .where((t) => t.kind == TransactionKind.deposit)
          .every((t) => t.inrPaise == PreviewMoney.gross(t.amount, 10300)),
      true,
    );
  });
  group('isolated preview state', () {
    late ProviderContainer c;
    late PreviewController controller;
    late DateTime clock;
    setUp(() {
      clock = DateTime(2026, 9, 20, 12);
      c = ProviderContainer(
        overrides: [
          previewModeProvider.overrideWithValue(true),
          previewClockProvider.overrideWithValue(() => clock),
        ],
      );
      controller = c.read(previewProvider.notifier);
      controller.login();
    });
    tearDown(() => c.dispose());
    test(
      'wallet confirmation locks rate and beneficiary; replay debits exactly once',
      () {
        final initial = c.read(previewProvider).balance;
        final q = controller.makeQuote('250', FundingMode.wallet, 'bank-hdfc');
        expect(q.gross, BigInt.from(2575000));
        expect(q.fee, BigInt.from(12875));
        expect(q.net, BigInt.from(2562125));
        controller.refreshRate();
        controller.setDefaultBank('bank-federal');
        final id = controller.confirmQuote();
        expect(controller.confirmQuote(), id);
        final t = controller.findTransaction(id)!;
        expect(t.quote!.ratePaise, 10300);
        expect(t.quote!.bank.id, 'bank-hdfc');
        expect(c.read(previewProvider).balance, initial - q.amount);
        expect(
          c.read(previewProvider).transactions.where((t) => t.id == id).length,
          1,
        );
      },
    );
    test('quote expiry and insufficient balance block confirmation', () {
      controller.makeQuote('10', FundingMode.wallet, 'bank-hdfc');
      clock = clock.add(const Duration(seconds: 91));
      expect(controller.confirmQuote, throwsStateError);
      expect(
        () => controller.makeQuote('9999', FundingMode.wallet, 'bank-hdfc'),
        throwsStateError,
      );
      for (final value in ['0', '9.99', '10000.000001', '-1']) {
        expect(
          () => controller.makeQuote(value, FundingMode.onchain, 'bank-hdfc'),
          throwsStateError,
        );
      }
    });
    test('preview quotes do not require or fabricate identity approval', () {
      controller.register('Sample User', 'sample@example.com', '9000000001');
      expect(c.read(previewProvider).verified, false);
      expect(
        controller.makeQuote('10', FundingMode.wallet, 'bank-hdfc').amount,
        BigInt.from(10000000),
      );
    });
    test(
      'on-chain preview does not debit wallet; repeated completion has one payout',
      () {
        final initial = c.read(previewProvider).balance;
        controller.makeQuote('100', FundingMode.onchain, 'bank-hdfc');
        final id = controller.confirmQuote();
        expect(controller.findTransaction(id)!.stage, 0);
        expect(c.read(previewProvider).balance, initial);
        for (var i = 0; i < 10; i++) {
          controller.advance(id);
        }
        expect(controller.findTransaction(id)!.stage, 6);
        expect(
          c
              .read(previewProvider)
              .transactions
              .where((t) => t.id == '$id-PAYOUT')
              .length,
          1,
        );
        expect(
          c
              .read(previewProvider)
              .notices
              .where((n) => n.id == 'notice-$id')
              .length,
          1,
        );
        expect(c.read(previewProvider).balance, initial);
      },
    );
    test('a deposit record cannot be advanced as a sell payout', () {
      final count = c.read(previewProvider).transactions.length;
      controller.advance('DT-DEMO-240917');
      expect(c.read(previewProvider).transactions.length, count);
      expect(controller.findTransaction('DT-DEMO-240917')!.stage, 2);
    });
    test(
      'bank selection, duplicate validation, notices and logout are consistent',
      () {
        controller.addBank(
          holder: 'Sample User',
          number: '000000001234',
          ifsc: 'SBIN0000001',
          name: 'State Bank',
        );
        final bank = c.read(previewProvider).banks.last;
        controller.setDefaultBank(bank.id);
        expect(c.read(previewProvider).defaultBank.id, bank.id);
        expect(
          () => controller.addBank(
            holder: bank.holder,
            number: bank.number,
            ifsc: bank.ifsc,
            name: bank.name,
          ),
          throwsStateError,
        );
        controller.markAllRead();
        expect(c.read(previewProvider).unread, 0);
        controller.preference('biometric', true);
        controller.createTicket(
          'Sample help',
          'Sample support description',
          'Account',
        );
        controller.logout();
        final s = c.read(previewProvider);
        expect(s.signedIn, false);
        expect(s.banks.length, 2);
        expect(s.biometric, false);
        expect(s.tickets, isEmpty);
        expect(s.acceptedQuotes, isEmpty);
      },
    );
  });
}
