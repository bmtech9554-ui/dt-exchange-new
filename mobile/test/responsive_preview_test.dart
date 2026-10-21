import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dt_exchange/preview/models.dart';
import 'test_support.dart';

const capture = bool.fromEnvironment('DT_CAPTURE');
const screens = <String, String>{
  '01_splash': '/splash',
  '02_login': '/login',
  '03_register': '/register',
  '04_otp': '/otp?purpose=login&contact=ashik@example.com',
  '05_home': '/home',
  '06_wallet': '/wallet',
  '07_deposit': '/deposit',
  '08_sell_amount': '/sell/amount',
  '09_sell_confirm': '/sell/confirm',
  '10_sell_send': '/sell/send/DT-DEMO-102',
  '11_sell_track': '/sell/track/DT-DEMO-102',
  '12_sell_success': '/sell/track/DT-DEMO-240920',
  '13_history': '/history',
  '14_transaction_details': '/history/DT-DEMO-240920',
  '15_profile': '/profile',
  '16_banks': '/banks',
  '17_add_bank': '/banks/add',
  '18_referral': '/referral',
  '19_settings': '/settings',
  '20_notifications': '/notifications',
  '21_support': '/support',
  '22_support_ticket': '/support/new',
  '24_password': '/settings/password',
  '25_pin': '/settings/pin',
  '26_biometrics': '/settings/biometric',
  '27_2fa': '/settings/2fa',
  '28_devices': '/settings/devices',
  '29_preferences': '/settings/preferences',
  '30_alerts': '/settings/notifications',
  '31_user_details': '/profile/details',
  '32_privacy': '/legal/privacy',
  '33_terms': '/legal/terms',
  '34_delete': '/settings/delete',
  '35_forgot_password': '/forgot-password',
  '36_reset_password': '/reset-password',
};
void main() {
  setUpAll(loadPreviewFonts);
  for (final config in [
    ('iphone', const Size(390, 844), 1.0),
    ('android', const Size(412, 915), 1.0),
    ('small_large_text', const Size(320, 700), 1.3),
    ('landscape', const Size(844, 390), 1.0),
  ]) {
    for (final entry in screens.entries) {
      testWidgets(
        '${config.$1}: ${entry.key} lays out and scrolls without errors',
        (t) async {
          final key = GlobalKey();
          final c = await pumpPreview(
            t,
            route: entry.value,
            size: config.$2,
            scale: config.$3,
            boundary: key,
            setup: (x) {
              x.makeQuote('250', FundingMode.onchain, 'bank-hdfc');
              x.confirmQuote();
            },
          );
          addTearDown(() => closePreview(t, c));
          expect(
            t.takeException(),
            isNull,
            reason: 'Initial layout ${entry.key}',
          );
          if (capture && config.$1 == 'iphone') {
            await t.runAsync(() async {
              final boundary =
                  key.currentContext!.findRenderObject()!
                      as RenderRepaintBoundary;
              final picture = await boundary.toImage(pixelRatio: 2);
              final data = await picture.toByteData(
                format: ui.ImageByteFormat.png,
              );
              picture.dispose();
              final out = File('../docs/${const String.fromEnvironment('DT_CAPTURE_PHASE', defaultValue: 'phase2')}/previews/${entry.key}.png');
              out.parent.createSync(recursive: true);
              out.writeAsBytesSync(data!.buffer.asUint8List());
            });
          }
          // Exercise every vertical region, including controls initially below the fold.
          final scrollables = find.byType(Scrollable);
          ScrollableState? vertical;
          for (final e in scrollables.evaluate()) {
            final state = (e as StatefulElement).state as ScrollableState;
            if (state.axisDirection == AxisDirection.down) {
              vertical = state;
              break;
            }
          }
          if (vertical != null) {
            for (
              var i = 0;
              i < 30 &&
                  vertical.position.pixels < vertical.position.maxScrollExtent;
              i++
            ) {
              vertical.position.jumpTo(
                (vertical.position.pixels + config.$2.height * .65).clamp(
                  0,
                  vertical.position.maxScrollExtent,
                ),
              );
              await t.pump(const Duration(milliseconds: 50));
              expect(
                t.takeException(),
                isNull,
                reason: 'Scrolled layout ${entry.key}',
              );
            }
          }
        },
      );
    }
  }
}
