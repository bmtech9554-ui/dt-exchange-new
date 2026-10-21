import 'api_client.dart';

/// Native FCM/APNs adapter supplies a token only after platform permission.
/// Token values stay inside this service and secure native SDK storage.
abstract class DevicePushAdapter {
  Future<String?> requestToken();
  String get platform;
}

class PushRegistration {
  PushRegistration(this.api, this.adapter);
  final ApiSession api;
  final DevicePushAdapter adapter;
  Future<String?> register() async {
    final token = await adapter.requestToken();
    if (token == null) return null;
    final result = await api.request(
      '/notifications/devices',
      method: 'POST',
      data: {'token': token, 'platform': adapter.platform},
    );
    return result['id'] as String;
  }

  Future<void> remove(String id) async {
    await api.request('/notifications/devices/$id', method: 'DELETE');
  }
}
