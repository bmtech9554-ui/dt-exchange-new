import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dt_exchange/features/wallet/wallet_pages.dart';
import 'package:dt_exchange/core/presentation/kit.dart';

void main() {
  testWidgets(
    'configured production address wraps, copies exactly and supplies the QR without preview semantics',
    (tester) async {
      const address = 'TReyJ2Amq4GhmrwdCuVwLPtpQCk1SUhBmn';
      String? copied;
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        (call) async {
          if (call.method == 'Clipboard.setData') {
            copied = (call.arguments as Map)['text'] as String;
          }
          return null;
        },
      );
      tester.view.physicalSize = const Size(320, 740);
      tester.view.devicePixelRatio = 1;
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: DepositAddressCard(
                address: address,
                sandbox: false,
                preview: false,
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text(address), findsOneWidget);
      final qr = tester.widget<PreviewQr>(find.byType(PreviewQr));
      expect(qr.data, address);
      expect(qr.preview, false);
      await tester.ensureVisible(find.text('Copy address'));
      await tester.tap(find.text('Copy address'));
      await tester.pump();
      expect(copied, address);
      expect(find.text('Copied'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        null,
      );
    },
  );
}
