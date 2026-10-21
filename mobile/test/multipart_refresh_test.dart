import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dt_exchange/core/api/api_client.dart';
import 'phase3_api_test.dart' show MemoryStore, FixtureAdapter;

class ExpiredUploadAdapter extends FixtureAdapter {
  final uploads = <List<int>>[];
  final bodies = <Object?>[];
  @override
  Future<ResponseBody> fetch(
    RequestOptions o,
    Stream<Uint8List>? stream,
    Future<void>? cancel,
  ) async {
    if (o.path != '/manual/files') return super.fetch(o, stream, cancel);
    bodies.add(o.data);
    uploads.add(await stream!.fold<List<int>>([], (a, b) => a..addAll(b)));
    return ResponseBody.fromString(
      jsonEncode(
        uploads.length == 1
            ? {
                'error': {'message': 'Expired'},
              }
            : {'id': 'synthetic-proof'},
      ),
      uploads.length == 1 ? 401 : 201,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }
}

void main() {
  test(
    'expired session refresh retries a fresh multipart body with intact proof bytes',
    () async {
      final adapter = ExpiredUploadAdapter();
      final dio = Dio()..httpClientAdapter = adapter;
      final store = MemoryStore()..token = 'test-refresh';
      final api = ApiSession(dio, store)..accessToken = 'old';
      final data = FormData.fromMap({
        'purpose': 'proof',
        'file': MultipartFile.fromBytes(
          utf8.encode('SYNTHETIC PROOF'),
          filename: 'fixture.png',
        ),
      });
      final result = await api.request(
        '/manual/files',
        method: 'POST',
        data: data,
      );
      expect(result['id'], 'synthetic-proof');
      expect(adapter.rotations, 1);
      expect(adapter.uploads.length, 2);
      expect(identical(adapter.bodies[0], adapter.bodies[1]), isFalse);
      for (final body in adapter.uploads) {
        expect(utf8.decode(body), contains('SYNTHETIC PROOF'));
      }
      expect(data.isFinalized, isFalse);
      dio.close();
    },
  );
}
