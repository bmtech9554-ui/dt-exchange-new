import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dt_exchange/core/api/api_client.dart';
import 'package:dt_exchange/core/presentation/kit.dart';
import 'package:dt_exchange/features/manual/manual_pages.dart';
import 'phase3_api_test.dart' show MemoryStore;
import 'manual_ui_test.dart' show ManualFixture;
import 'test_support.dart';

class SubmissionAdapter extends ManualFixture {
  final pending = Completer<ResponseBody>();
  int uploads = 0, submissions = 0;
  bool failUpload = true;
  dynamic submittedPayload;
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
    Stream<Uint8List>? stream,
    Future<void>? cancel,
  ) async {
    if (o.path == '/manual/files' && o.method == 'POST') {
      uploads++;
      return failUpload
          ? response({
              'error': {'message': 'Upload unavailable. Please retry.'},
            }, 400)
          : response({'id': 'proof-fixture'}, 201);
    }
    if (o.path == '/manual/deposits' && o.method == 'POST') {
      submissions++;
      submittedPayload = o.data is String ? jsonDecode(o.data) : o.data;
      if (submissions == 1) return pending.future;
      return response({
        'id': 'synthetic-request',
        'status': 'UNDER_REVIEW',
      }, 201);
    }
    return super.fetch(o, stream, cancel);
  }
}

void main() {
  setUpAll(loadPreviewFonts);
  testWidgets(
    'valid evidence enables intake, failures retry, rapid taps cannot duplicate',
    (t) async {
      final adapter = SubmissionAdapter();
      final dio = Dio()..httpClientAdapter = adapter;
      final c = ProviderContainer(
        overrides: [
          apiSessionProvider.overrideWithValue(
            ApiSession(dio, MemoryStore())..accessToken = 'synthetic',
          ),
          depositProofPickerProvider.overrideWithValue(
            () async => PlatformFile(
              name: 'synthetic.pdf',
              size: 12,
              bytes: Uint8List.fromList(utf8.encode('%PDF-fixture')),
            ),
          ),
        ],
      );
      await t.pumpWidget(
        UncontrolledProviderScope(
          container: c,
          child: const MaterialApp(
            home: SubmitDepositPage(
              minimumDeposit: '100',
              dailyDepositLimit: '20000',
            ),
          ),
        ),
      );
      await t.pumpAndSettle();
      Finder button() =>
          find.widgetWithText(DtButton, 'Submit Deposit Request');
      Future<void> enter(String key, String value) async {
        final f = find.byKey(Key(key));
        await t.ensureVisible(f);
        await t.enterText(f, value);
        await t.pumpAndSettle();
      }

      await enter('deposit-amount', '100');
      expect(t.widget<DtButton>(button()).onPressed, isNull);
      await enter('deposit-txid', ' ${'a' * 64} ');
      expect(t.widget<DtButton>(button()).onPressed, isNull);
      final upload = find.text('Upload Screenshot');
      await t.ensureVisible(upload);
      await t.tap(upload);
      await t.pumpAndSettle();
      await enter('deposit-amount', '99');
      expect(t.widget<DtButton>(button()).onPressed, isNull);
      await enter('deposit-amount', '100');
      expect(t.widget<DtButton>(button()).onPressed, isNotNull);
      await t.ensureVisible(button());
      await t.pumpAndSettle();
      await t.tap(button());
      await t.pumpAndSettle();
      expect(find.text('Upload unavailable. Please retry.'), findsOneWidget);
      expect(t.widget<DtButton>(button()).onPressed, isNotNull);
      expect(adapter.submissions, 0);
      adapter.failUpload = false;
      final submit = t.widget<DtButton>(button()).onPressed!;
      submit();
      submit();
      await t.pump();
      await t.pump(const Duration(milliseconds: 100));
      expect(adapter.submissions, 1);
      expect(adapter.submittedPayload['txHash'], 'a' * 64);
      expect(adapter.submittedPayload['proofId'], 'proof-fixture');
      expect(adapter.uploads, 2);
      expect(
        t
            .widget<DtButton>(
              find.byWidgetPredicate((w) => w is DtButton && w.loading),
            )
            .onPressed,
        isNull,
      );
      adapter.pending.complete(
        adapter.response({
          'error': {
            'message': 'This TxID has already been submitted or credited.',
          },
        }, 409),
      );
      await t.pumpAndSettle();
      expect(t.widget<DtButton>(button()).onPressed, isNotNull);
      expect(
        find.text('This TxID has already been submitted or credited.'),
        findsOneWidget,
      );
      t.widget<DtButton>(button()).onPressed!();
      await t.pumpAndSettle();
      expect(adapter.uploads, 2);
      expect(adapter.submissions, 2);
      expect(find.text('Under Review'), findsOneWidget);
      await t.pumpWidget(const SizedBox());
      c.dispose();
      dio.close();
    },
  );
  testWidgets(
    'paused intake explains disabled button and supports availability refresh',
    (t) async {
      var checked = false;
      await t.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: SubmitDepositPage(
              submissionEnabled: false,
              onRefreshAvailability: () async {
                checked = true;
              },
            ),
          ),
        ),
      );
      await t.pumpAndSettle();
      final check = find.text('Check availability');
      await t.ensureVisible(check);
      await t.pumpAndSettle();
      await t.tap(check);
      await t.pumpAndSettle();
      expect(checked, isTrue);
      expect(
        find.text(
          'Deposit submissions are unavailable. Check availability before submitting.',
        ),
        findsOneWidget,
      );
      expect(
        t
            .widget<DtButton>(
              find.widgetWithText(DtButton, 'Submit Deposit Request'),
            )
            .onPressed,
        isNull,
      );
    },
  );
}
