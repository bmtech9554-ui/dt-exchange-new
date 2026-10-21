import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dt_exchange/core/api/api_client.dart';

void main() {
  test('maintenance responses do not leak server details', () {
    final options = RequestOptions(path: '/sell/orders');
    final error = DioException(
      requestOptions: options,
      response: Response(
        requestOptions: options,
        statusCode: 503,
        data: {
          'error': {'message': 'Internal provider credential failure'},
        },
      ),
    );
    expect(apiMessage(error), contains('Existing transactions remain tracked'));
    expect(apiMessage(error), isNot(contains('credential')));
  });
}
