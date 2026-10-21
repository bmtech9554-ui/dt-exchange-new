import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dt_exchange/core/api/api_client.dart';
void main() {
  for(final type in [DioExceptionType.connectionError,DioExceptionType.connectionTimeout,DioExceptionType.receiveTimeout,DioExceptionType.sendTimeout]) {
    test('RC1 $type presents a safe retry message', () {
      final e=DioException(requestOptions:RequestOptions(path:'/transactions'),type:type,error:'socket credential diagnostic');
      expect(apiMessage(e),'Unable to connect. Please try again.');
      expect(apiMessage(e),isNot(contains('credential')));
    });
  }
  test('RC1 unknown exceptions do not leak diagnostic detail',()=>expect(apiMessage(Exception('internal connection diagnostic')),'Unable to complete this request.'));
}
