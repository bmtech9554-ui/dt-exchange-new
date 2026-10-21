import 'package:flutter_test/flutter_test.dart';
import 'package:dt_exchange/public_test/test_mode.dart';

void main() {
  test('test app accepts only the dedicated HTTPS API path', () {
    expect(
      isPublicTestApiRequest(Uri.parse('$publicTestApi/test/login')),
      isTrue,
    );
    for (final url in [
      'https://api.dtexchange.app/api/v1/auth/login',
      'https://dtexchange.app/api/v1/auth/login',
      'http://dtexchange.app/test-api/api/v1/test/login',
      'https://dtexchange.app/test-api/api/v1/../../../api/v1',
      'https://dtexchange.app.evil.example/test-api/api/v1',
      'https://dtexchange.app:444/test-api/api/v1',
    ]) {
      expect(isPublicTestApiRequest(Uri.parse(url)), isFalse, reason: url);
    }
  });
}
