import 'package:flutter_test/flutter_test.dart';
import 'package:dt_exchange/features/manual/manual_pages.dart';

void main() {
  test('production deposit validation uses configured decimal-safe limits', () {
    String? check(String value) =>
        validateDepositAmount(value, minimum: '100', dailyLimit: '20000');
    expect(check('99'), 'Minimum deposit is 100 USDT.');
    expect(check('99.999999'), 'Minimum deposit is 100 USDT.');
    expect(check('100'), isNull);
    expect(check('100.000001'), isNull);
    expect(check('20000'), isNull);
    expect(check('20000.000001'), 'Daily deposit limit is 20000 USDT.');
    expect(check(''), isNotNull);
  });
}
