import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/app.dart';
import 'preview/preview_controller.dart';

/// Explicitly isolated, in-memory Phase 2 preview. Never a live financial client.
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    ProviderScope(
      overrides: [previewModeProvider.overrideWithValue(true)],
      child: const DtExchangeApp(),
    ),
  );
}
