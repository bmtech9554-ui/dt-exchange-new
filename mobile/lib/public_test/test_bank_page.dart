import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api/api_client.dart';
import '../core/presentation/kit.dart';
import '../preview/preview_controller.dart';

class PublicTestBankPage extends ConsumerStatefulWidget {
  const PublicTestBankPage({super.key});
  @override
  ConsumerState<PublicTestBankPage> createState() => _TestBankState();
}

class _TestBankState extends ConsumerState<PublicTestBankPage> {
  bool busy = false;
  String? error;
  @override
  Widget build(BuildContext context) => AppPage(
    title: 'Demo bank account',
    children: [
      const InfoNote(
        'The test server generates a non-payable bank fixture. Do not enter real bank details.',
      ),
      const SizedBox(height: 20),
      if (error != null) InfoNote(error!),
      DtButton(
        label: 'Use demo bank account',
        loading: busy,
        onPressed: busy
            ? null
            : () async {
                setState(() => busy = true);
                try {
                  await ref
                      .read(apiSessionProvider)
                      .request('/test/bank', method: 'POST', data: {});
                  await ref.read(previewProvider.notifier).loadBanks();
                  if (context.mounted) context.pop();
                } catch (e) {
                  if (mounted) setState(() => error = apiMessage(e));
                } finally {
                  if (mounted) setState(() => busy = false);
                }
              },
      ),
    ],
  );
}
