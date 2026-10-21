import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api/api_client.dart';
import '../core/presentation/kit.dart';
import '../preview/preview_controller.dart';

class PublicTestAuthPage extends ConsumerStatefulWidget {
  const PublicTestAuthPage({this.register = false, super.key});
  final bool register;
  @override
  ConsumerState<PublicTestAuthPage> createState() => _TestAuthState();
}

class _TestAuthState extends ConsumerState<PublicTestAuthPage> {
  final username = TextEditingController(),
      password = TextEditingController(),
      code = TextEditingController();
  final form = GlobalKey<FormState>();
  bool busy = false;
  String? error;
  String? challengeId, simulationCode;
  @override
  void dispose() {
    username.dispose();
    password.dispose();
    code.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (!form.currentState!.validate() || busy) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final api = ref.read(apiSessionProvider);
      if (widget.register && challengeId == null) {
        final challenge = await api.request(
          '/test/register-challenge',
          method: 'POST',
          authenticated: false,
          data: {
            'username': username.text.trim().toLowerCase(),
            'password': password.text,
            'deviceId': await api.deviceId(),
          },
        );
        if (mounted) {
          setState(() {
            challengeId = challenge['challengeId'];
            simulationCode = challenge['simulationCode'];
          });
        }
        return;
      }
      final result = await api.request(
        widget.register ? '/test/verify' : '/test/login',
        method: 'POST',
        authenticated: false,
        data: widget.register
            ? {
                'challengeId': challengeId,
                'code': code.text.trim(),
                'deviceId': await api.deviceId(),
              }
            : {
                'username': username.text.trim().toLowerCase(),
                'password': password.text,
                'deviceId': await api.deviceId(),
              },
      );
      await api.accept(Map<String, dynamic>.from(result));
      await ref.read(previewProvider.notifier).loadAccount();
      if (mounted) context.go('/home');
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => AppPage(
    title: widget.register ? 'Create account' : 'Sign in',
    back: false,
    children: [
      const DtLogo(size: 54),
      const SizedBox(height: 20),
      const InfoNote(
        'Use a made-up username and a unique demo password. No real phone, email, SMS or bank details are required. Simulated balances have no monetary value.',
      ),
      const SizedBox(height: 20),
      Form(
        key: form,
        child: Column(
          children: [
            if (challengeId == null)
              DtField(
                label: 'Demo username',
                controller: username,
                validator: (v) =>
                    RegExp(
                      r'^[a-z][a-z0-9_]{4,29}$',
                    ).hasMatch((v ?? '').trim().toLowerCase())
                    ? null
                    : 'Use 5–30 letters, numbers or underscores; start with a letter.',
              ),
            const SizedBox(height: 16),
            if (challengeId == null)
              DtField(
                label: 'Demo password',
                controller: password,
                obscureText: true,
                validator: (v) =>
                    (v ?? '').length >= 12 && (v ?? '').length <= 128
                    ? null
                    : 'Use 12–128 characters.',
              ),
            if (challengeId != null) ...[
              InfoNote(
                'Simulation verification code: $simulationCode\nExpires in 5 minutes. No SMS was sent.',
              ),
              const SizedBox(height: 16),
              DtField(
                label: 'Verification code',
                controller: code,
                keyboardType: TextInputType.number,
                validator: (v) => RegExp(r'^\d{6}$').hasMatch((v ?? '').trim())
                    ? null
                    : 'Enter the current 6-digit simulation code.',
              ),
            ],
          ],
        ),
      ),
      if (error != null) InfoNote(error!),
      const SizedBox(height: 20),
      DtButton(
        label: widget.register
            ? (challengeId == null ? 'Create account' : 'Verify code')
            : 'Sign in',
        loading: busy,
        onPressed: submit,
      ),
      TextButton(
        onPressed: busy
            ? null
            : () => context.go(widget.register ? '/login' : '/register'),
        child: Text(
          widget.register ? 'Already have an account?' : 'Create account',
        ),
      ),
    ],
  );
}
