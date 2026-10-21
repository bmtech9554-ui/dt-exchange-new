import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:file_picker/src/platform/file_picker_method_channel.dart';
import 'package:dt_exchange/core/api/api_client.dart';
import 'package:dt_exchange/core/presentation/kit.dart';
import 'package:dt_exchange/features/manual/manual_pages.dart';
import 'package:dt_exchange/features/transactions/transaction_pages.dart';
import 'phase3_api_test.dart' show MemoryStore;

class ProofAdapter implements HttpClientAdapter {
  int firstStatus = 200, reads = 0, refreshes = 0;
  bool invalidRefresh = false, missing = false;
  final bytes = File(
    'test/assets/manual-receipt-preview.png',
  ).readAsBytesSync();
  ResponseBody response(Object data, int status) => ResponseBody.fromString(
    jsonEncode(data),
    status,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );
  @override
  Future<ResponseBody> fetch(
    RequestOptions o,
    Stream<Uint8List>? body,
    Future<void>? cancel,
  ) async {
    if (o.path == '/auth/refresh') {
      refreshes++;
      return invalidRefresh
          ? response({
              'error': {'message': 'Session expired. Please sign in.'},
            }, 401)
          : response({
              'accessToken': 'fresh-test-token',
              'refreshToken': 'rotated-test-refresh',
            }, 200);
    }
    if (o.path.startsWith('/history/')) {
      return response({
        'id': 'payout-fixture',
        'type': 'payouts',
        'status': 'PROCESSING',
        'amount_inr_minor': '100',
        'order_id': 'test-order',
        'created_at': '2026-10-09T00:00:00Z',
        'sandbox': true,
        'manual_receipt_id': missing ? null : 'receipt-fixture',
      }, 200);
    }
    if (o.path.startsWith('/manual/files/')) {
      reads++;
      final status = reads == 1 ? firstStatus : 200;
      return status == 200
          ? response({'mime': 'image/png', 'base64': base64Encode(bytes)}, 200)
          : response({
              'error': {
                'message': status == 404
                    ? 'Receipt unavailable.'
                    : 'Proof request failed.',
              },
            }, status);
    }
    throw StateError('Unexpected fixture endpoint');
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('miguelruivo.flutter.plugins.filepicker');
  Future<void> mount(
    WidgetTester t,
    ProofAdapter a, {
    bool details = false,
  }) async {
    t.view.physicalSize = const Size(390, 900);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.resetPhysicalSize);
    addTearDown(t.view.resetDevicePixelRatio);
    final dio = Dio()..httpClientAdapter = a;
    final store = MemoryStore()..token = 'test-refresh';
    await t.pumpWidget(
      ProviderScope(
        overrides: [
          apiSessionProvider.overrideWithValue(
            ApiSession(dio, store)..accessToken = 'test-access',
          ),
        ],
        child: MaterialApp(
          home: details
              ? const ApiDepositDetailsPage(id: 'payout-fixture')
              : const AppPage(
                  title: 'History proof test',
                  children: [PrivateReceiptButton(id: 'receipt-fixture')],
                ),
        ),
      ),
    );
    await t.pumpAndSettle();
    addTearDown(dio.close);
  }

  tearDown(
    () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null),
  );
  for (final status in [401, 404, 503]) {
    testWidgets('receipt $status is handled safely and retry recovers', (
      t,
    ) async {
      final a = ProofAdapter()..firstStatus = status;
      await mount(t, a);
      await t.tap(find.text('View Payment Proof'));
      await t.pumpAndSettle();
      if (status == 401) {
        expect(a.refreshes, 1);
        expect(find.byType(InteractiveViewer), findsOneWidget);
      } else {
        expect(find.byType(InteractiveViewer), findsNothing);
        expect(
          find.text(
            status == 404
                ? 'Receipt unavailable.'
                : 'Service temporarily unavailable. Existing transactions remain tracked. Please try again shortly.',
          ),
          findsOneWidget,
        );
        await t.tap(find.text('View Payment Proof'));
        await t.pumpAndSettle();
        expect(find.byType(InteractiveViewer), findsOneWidget);
      }
      expect(t.takeException(), isNull);
    });
  }
  testWidgets('expired refresh cannot expose proof', (t) async {
    final a = ProofAdapter()
      ..firstStatus = 401
      ..invalidRefresh = true;
    await mount(t, a);
    await t.tap(find.text('View Payment Proof'));
    await t.pumpAndSettle();
    expect(a.refreshes, 1);
    expect(a.reads, 1);
    expect(find.byType(InteractiveViewer), findsNothing);
    expect(find.text('Session expired. Please sign in.'), findsOneWidget);
  });
  testWidgets('missing payout proof has no download/view action', (t) async {
    final a = ProofAdapter()..missing = true;
    await mount(t, a, details: true);
    expect(find.text('View Payment Proof'), findsNothing);
    expect(find.text('Download Payment Proof'), findsNothing);
    expect(a.reads, 0);
  });
  testWidgets('History receipt zooms and save failure can retry intact bytes', (
    t,
  ) async {
    MethodChannelFilePicker.registerWith();
    int saves = 0;
    Uint8List? saved;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
          expect(call.method, 'save');
          saves++;
          saved = call.arguments['bytes'] as Uint8List;
          expect(call.arguments['fileName'], 'DT-Exchange-proof.png');
          if (saves == 1) {
            throw PlatformException(
              code: 'save_failed',
              message: 'Synthetic disk failure',
            );
          }
          return '/isolated-test/receipt.png';
        });
    final a = ProofAdapter();
    await mount(t, a, details: true);
    await t.tap(find.text('View Payment Proof'));
    await t.pumpAndSettle();
    final viewer = find.byType(InteractiveViewer);
    expect(viewer, findsOneWidget);
    final center = t.getCenter(viewer),
        g1 = await t.createGesture(pointer: 1),
        g2 = await t.createGesture(pointer: 2);
    await g1.down(center - const Offset(25, 0));
    await g2.down(center + const Offset(25, 0));
    await t.pump();
    await g1.moveTo(center - const Offset(85, 0));
    await g2.moveTo(center + const Offset(85, 0));
    await t.pump();
    await g1.up();
    await g2.up();
    await t.pumpAndSettle();
    final transforms = t.widgetList<Transform>(
      find.descendant(of: viewer, matching: find.byType(Transform)),
    );
    expect(transforms.any((x) => x.transform.getMaxScaleOnAxis() > 1), isTrue);
    await t.ensureVisible(find.text('Download Payment Proof'));
    await t.tap(find.text('Download Payment Proof'));
    await t.pumpAndSettle();
    expect(
      find.text('Unable to save proof. Please try again.'),
      findsOneWidget,
    );
    expect(saved, orderedEquals(a.bytes));
    await t.tap(find.text('Download Payment Proof'));
    await t.pumpAndSettle();
    expect(saves, 2);
    expect(saved, orderedEquals(a.bytes));
    expect(t.takeException(), isNull);
  });
}
