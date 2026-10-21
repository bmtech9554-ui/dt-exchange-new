import 'package:flutter_test/flutter_test.dart';
import 'package:dt_exchange/features/manual/android_update.dart';

void main() {
  test(
    'update URL accepts configured official HTTPS download only',
    () => expect(
      approvedDownloadUrl(
        'https://official.example/download',
        'https://official.example',
      ),
      true,
    ),
  );
  for (final url in [
    'http://official.example/download',
    'https://evil.example/download',
    'https://official.example.evil.test/download',
    'https://u:p@official.example/download',
    'https://official.example/download?redirect=https://evil.test',
    'https://official.example/download#x',
    'https://official.example/other',
  ]) {
    test(
      'update URL rejects $url',
      () => expect(approvedDownloadUrl(url, 'https://official.example'), false),
    );
  }
  test(
    'minimum version requires update',
    () => expect(
      updateRequired({
        'available': true,
        'minimumVersionCode': 8002,
        'latestVersionCode': 8002,
      }, 8001),
      true,
    ),
  );
  test(
    'mandatory newer release requires update',
    () => expect(
      updateRequired({
        'available': true,
        'minimumVersionCode': 8000,
        'latestVersionCode': 8002,
        'mandatory': true,
      }, 8001),
      true,
    ),
  );
  test(
    'current supported version continues',
    () => expect(
      updateRequired({
        'available': true,
        'minimumVersionCode': 8002,
        'latestVersionCode': 8002,
        'mandatory': true,
      }, 8002),
      false,
    ),
  );
  test(
    'unpublished metadata does not invent update',
    () => expect(updateRequired({'available': false}, 8001), false),
  );
}
