import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dt_exchange/app/app.dart';
import 'package:dt_exchange/app/router.dart';
import 'package:dt_exchange/preview/preview_controller.dart';

Future<void> loadPreviewFonts() async {
  for (final item in [
    ('Roboto', ['Roboto-Regular.ttf', 'Roboto-Medium.ttf']),
    ('MaterialIcons', ['MaterialIcons-Regular.otf']),
  ]) {
    final loader = FontLoader(item.$1);
    for (final name in item.$2) {
      loader.addFont(
        Future.value(
          ByteData.sublistView(File('test/assets/$name').readAsBytesSync()),
        ),
      );
    }
    await loader.load();
  }
}

Future<ProviderContainer> pumpPreview(
  WidgetTester tester, {
  String route = '/home',
  bool signedIn = true,
  Size size = const Size(390, 844),
  double scale = 1,
  GlobalKey? boundary,
  void Function(PreviewController)? setup,
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  tester.platformDispatcher.textScaleFactorTestValue = scale;
  final container = ProviderContainer(
    overrides: [
      previewModeProvider.overrideWithValue(true),
      initialRouteProvider.overrideWithValue(route),
    ],
  );
  if (signedIn) container.read(previewProvider.notifier).login();
  setup?.call(container.read(previewProvider.notifier));
  final previousShadows = debugDisableShadows;
  debugDisableShadows = false;
  try {
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: RepaintBoundary(key: boundary, child: const DtExchangeApp()),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 700));
    await tester.pump(const Duration(milliseconds: 750));
  } finally {
    debugDisableShadows = previousShadows;
  }
  return container;
}

Future<void> closePreview(WidgetTester tester, ProviderContainer c) async {
  await tester.pumpWidget(const SizedBox());
  c.dispose();
  await tester.pump();
  tester.view.resetPhysicalSize();
  tester.view.resetDevicePixelRatio();
  tester.platformDispatcher.clearTextScaleFactorTestValue();
}

Future<void> revealText(WidgetTester tester, String text) async {
  if (find.text(text).evaluate().isEmpty) {
    final scrollables = tester
        .stateList<ScrollableState>(find.byType(Scrollable))
        .where((s) => s.axisDirection == AxisDirection.down);
    if (scrollables.isNotEmpty) {
      final position = scrollables.first.position;
      position.jumpTo(0);
      await tester.pump();
      for (
        var i = 0;
        i < 30 &&
            find.text(text).evaluate().isEmpty &&
            position.pixels < position.maxScrollExtent;
        i++
      ) {
        position.jumpTo(
          (position.pixels + 350).clamp(0, position.maxScrollExtent),
        );
        await tester.pump();
      }
    }
  }
  await tester.ensureVisible(find.text(text).last);
  await tester.pump();
}

Future<void> tapText(WidgetTester tester, String text) async {
  await revealText(tester, text);
  await tester.tap(find.text(text).last);
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
}
