import 'dart:math';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../storage/session_store.dart';
import '../../public_test/test_mode.dart';
import 'app_version.dart';

final apiClientProvider = Provider<Dio>((ref) {
  validateAppVersion(release: kReleaseMode);
  const baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:4000/api/v1',
  );
  final uri = Uri.parse(baseUrl);
  if (publicTestMode && baseUrl != publicTestApi) {
    throw StateError('Test builds require the isolated test API');
  }
  if (kReleaseMode && uri.scheme != 'https') {
    throw StateError('Release builds require an HTTPS API_BASE_URL');
  }
  final dio = Dio(
    BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 20),
      headers: {
        'Accept': 'application/json',
        'x-dt-version-code': appVersionCode.toString(),
      },
    ),
  );
  if (publicTestMode) {
    dio.options.followRedirects = false;
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (!isPublicTestApiRequest(options.uri)) {
            handler.reject(
              DioException(
                requestOptions: options,
                error: 'Test API isolation blocked this request',
              ),
            );
          } else {
            handler.next(options);
          }
        },
      ),
    );
  }
  ref.onDispose(() => dio.close(force: true));
  return dio;
});
final apiSessionProvider = Provider<ApiSession>(
  (ref) =>
      ApiSession(ref.watch(apiClientProvider), ref.watch(sessionStoreProvider)),
);
String requestKey() => List.generate(
  24,
  (_) => Random.secure().nextInt(256).toRadixString(16).padLeft(2, '0'),
).join();
String apiMessage(Object e) {
  if (e is DioException) {
    if (e.response?.statusCode == 503) {
      return 'Service temporarily unavailable. Existing transactions remain tracked. Please try again shortly.';
    }
    final data = e.response?.data;
    if (data is Map && data['error'] is Map) {
      return data['error']['message'] as String? ??
          'Request failed. Please try again.';
    }
    return 'Unable to connect. Please try again.';
  }
  return e is StateError ? e.message : 'Unable to complete this request.';
}

class ApiSession {
  ApiSession(this.dio, this.store);
  final Dio dio;
  final SessionStore store;
  String? accessToken;
  Future<void>? _refreshing;
  int _generation = 0;
  bool _deviceUnlocked = false;
  Future<void> accept(Map<String, dynamic> response) async {
    await store.writeRefreshToken(response['refreshToken'] as String);
    accessToken = response['accessToken'] as String;
    _deviceUnlocked = true;
  }

  Future<void> clear() async {
    _generation++;
    accessToken = null;
    _deviceUnlocked = false;
    await store.clear();
  }

  Future<void> refresh() =>
      _refreshing ??= _rotate().whenComplete(() => _refreshing = null);
  Future<void> _rotate() async {
    final generation = _generation;
    if (!_deviceUnlocked && !await store.unlockSession()) {
      throw StateError('Unlock with biometrics or sign in normally.');
    }
    _deviceUnlocked = true;
    final token = await store.readRefreshToken();
    if (token == null) throw StateError('Please sign in');
    try {
      final response = await dio.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': token},
      );
      if (generation != _generation) return;
      await accept(response.data!);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) await clear();
      rethrow;
    }
  }

  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Object? data,
    bool authenticated = true,
    String? idempotencyKey,
  }) async {
    if (authenticated && accessToken == null) await refresh();
    final usedToken = accessToken;
    Future<Response<dynamic>> send() => dio.request<dynamic>(
      path,
      // Multipart bodies are consumed by Dio. A refreshed session must send a
      // fresh body, including fresh file streams, rather than replaying it.
      data: data is FormData ? data.clone() : data,
      options: Options(
        method: method,
        headers: {
          if (authenticated) 'Authorization': 'Bearer $accessToken',
          'Idempotency-Key': ?idempotencyKey,
        },
      ),
    );
    try {
      return (await send()).data;
    } on DioException catch (e) {
      if (authenticated && e.response?.statusCode == 401) {
        if (accessToken == usedToken) await refresh();
        return (await send()).data;
      }
      rethrow;
    }
  }

  Future<String> deviceId() async => store.deviceId();
}
