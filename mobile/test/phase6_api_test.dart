import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dt_exchange/app/app.dart';
import 'package:dt_exchange/app/router.dart';
import 'package:dt_exchange/core/api/api_client.dart';
import 'package:dt_exchange/preview/preview_controller.dart';
import 'phase3_api_test.dart' show FixtureAdapter, MemoryStore;
import 'test_support.dart';

class EngagementAdapter extends FixtureAdapter {
  @override
  Future<ResponseBody> fetch(
    RequestOptions o,
    Stream<Uint8List>? stream,
    Future<void>? cancel,
  ) async {
    dynamic data;
    if (o.path.startsWith('/notifications?page')) {
      data = [
        {
          'id': 'notice-6',
          'title': 'Support replied',
          'body': 'Your payout question has a new reply.',
          'created_at': '2026-09-20T13:00:00Z',
          'read_at': null,
          'deep_link': '/support/tickets/ticket-6',
        },
        {
          'id': 'notice-7',
          'title': 'Security PIN updated',
          'body': 'Your security settings were updated.',
          'created_at': '2026-09-20T12:00:00Z',
          'read_at': '2026-09-20T12:30:00Z',
        },
      ];
    } else if (o.path == '/notifications/announcements') {
      data = [];
    } else if (o.path == '/notifications/preferences') {
      data = {
        'push': true,
        'email': true,
        'sms': false,
        'transactions': true,
        'security': true,
        'referrals': true,
        'support': true,
      };
    } else if (o.path == '/referrals/me') {
      data = {
        'code': 'DT6A82CFE0486BD127',
        'inviteLink': 'https://example.invalid/register?ref=DT6A82CFE0486BD127',
        'enabled': true,
        'totalReferrals': 4,
        'qualifiedReferrals': 2,
        'rewardsEarnedMinor': '5000',
        'history': [],
      };
    } else if (o.path == '/support/faq') {
      data = [
        {
          'question': 'Where can I find my payout reference?',
          'answer':
              'Open your transaction details. The UTR appears when the provider confirms it.',
        },
        {
          'question': 'Which network should I use?',
          'answer': 'Use only TRC20 and the address shown for your order.',
        },
      ];
    } else if (o.path == '/support/tickets') {
      data = [
        {
          'id': 'ticket-6',
          'subject': 'Payout status question',
          'category': 'PAYOUT',
          'status': 'WAITING_FOR_USER',
        },
      ];
    } else if (o.path == '/support/tickets/ticket-6') {
      data = {
        'id': 'ticket-6',
        'subject': 'Payout status question',
        'category': 'PAYOUT',
        'status': 'WAITING_FOR_USER',
        'messages': [
          {
            'authorType': 'USER',
            'message': 'Please help me check my payout status.',
          },
          {
            'authorType': 'ADMIN',
            'message':
                'We are reviewing the provider update and will keep you informed.',
          },
        ],
      };
    } else if (o.path == '/settings') {
      data = {
        'pinSet': true,
        'preferences': {'animations': true, 'haptics': true},
      };
    } else {
      return super.fetch(o, stream, cancel);
    }
    calls.add(o);
    return ResponseBody.fromString(
      jsonEncode(data),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }
}

void main() {
  setUpAll(loadPreviewFonts);
  for (final config in [
    ('iphone', const Size(390, 844), 1.0),
    ('android', const Size(412, 915), 1.0),
    ('small', const Size(320, 700), 1.3),
    ('landscape', const Size(844, 390), 1.0),
  ]) {
    for (final item in [
      ('01_notifications', '/notifications', 'Notifications'),
      ('02_referral', '/referral', 'Referral Program'),
      ('03_support', '/support', 'Help & Support'),
      ('04_settings', '/settings', 'Settings'),
      ('05_preferences', '/settings/notifications', 'Notification preferences'),
      ('06_ticket', '/support/tickets/ticket-6', 'Support ticket'),
    ]) {
      testWidgets(
        'Phase 6 ${config.$1} ${item.$1} provider status and responsive layout',
        (t) async {
          final adapter = EngagementAdapter();
          final dio = Dio(BaseOptions(baseUrl: 'https://test.invalid'))
            ..httpClientAdapter = adapter;
          final c = ProviderContainer(
            overrides: [
              apiSessionProvider.overrideWithValue(
                ApiSession(dio, MemoryStore())..accessToken = 'access',
              ),
              initialRouteProvider.overrideWithValue(item.$2),
            ],
          );
          await t.runAsync(() async {
            await c.read(previewProvider.notifier).loadAccount();
          });
          t.view.physicalSize = config.$2;
          t.view.devicePixelRatio = 1;
          t.platformDispatcher.textScaleFactorTestValue = config.$3;
          final key = GlobalKey();
          await t.pumpWidget(
            UncontrolledProviderScope(
              container: c,
              child: RepaintBoundary(key: key, child: const DtExchangeApp()),
            ),
          );
          await t.pump();
          await t.runAsync(
            () => Future<void>.delayed(const Duration(milliseconds: 150)),
          );
          await t.pump(const Duration(seconds: 1));
          await t.pump(const Duration(milliseconds: 750));
          expect(t.takeException(), isNull);
          expect(find.text('Simulate blockchain & payout'), findsNothing);
          expect(find.text(item.$3), findsWidgets);
          if (const bool.fromEnvironment('DT_CAPTURE') &&
              config.$1 == 'iphone') {
            await t.runAsync(() async {
              final boundary =
                  key.currentContext!.findRenderObject()!
                      as RenderRepaintBoundary;
              final picture = await boundary.toImage(pixelRatio: 2);
              final bytes = await picture.toByteData(
                format: ui.ImageByteFormat.png,
              );
              picture.dispose();
              final file = File('../docs/phase6/previews/${item.$1}.png');
              file.parent.createSync(recursive: true);
              file.writeAsBytesSync(bytes!.buffer.asUint8List());
            });
          }
          final vertical = t
              .stateList<ScrollableState>(find.byType(Scrollable))
              .where((s) => s.axisDirection == AxisDirection.down)
              .firstOrNull;
          if (vertical != null) {
            for (
              var n = 0;
              n < 30 &&
                  vertical.position.pixels < vertical.position.maxScrollExtent;
              n++
            ) {
              vertical.position.jumpTo(
                (vertical.position.pixels + 250).clamp(
                  0,
                  vertical.position.maxScrollExtent,
                ),
              );
              await t.pump(const Duration(milliseconds: 40));
              expect(t.takeException(), isNull);
            }
          }
          await t.pumpWidget(const SizedBox.shrink());
          await t.pump();
          c.dispose();
          t.view.resetPhysicalSize();
          t.view.resetDevicePixelRatio();
          t.platformDispatcher.clearTextScaleFactorTestValue();
        },
      );
    }
  }
}
