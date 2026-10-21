import 'package:dt_exchange/core/design/appearance.dart';
import '../referral/referral_availability.dart';
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/presentation/kit.dart';
import '../../core/api/api_client.dart';
import '../../preview/preview_controller.dart';
import '../../preview/fixtures.dart';
import '../settings/biometric_page.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});
  @override
  ConsumerState<LoginPage> createState() => _LoginState();
}

class _LoginState extends ConsumerState<LoginPage> {
  final form = GlobalKey<FormState>();
  final contact = TextEditingController();
  final password = TextEditingController();
  bool otp = false;
  bool loading = false;
  @override
  void dispose() {
    contact.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (!form.currentState!.validate()) return;
    setState(() => loading = true);
    if (!ref.read(previewModeProvider)) {
      try {
        final c = ref.read(previewProvider.notifier);
        if (otp) {
          await c.requestOtp(contact.text, 'login');
          if (mounted) {
            context.push(
              '/otp?purpose=login&contact=${Uri.encodeComponent(contact.text)}',
            );
          }
        } else {
          await c.loginApi(contact.text, password.text);
          if (mounted) context.go('/home');
        }
      } catch (e) {
        if (mounted) toast(context, apiMessage(e));
      } finally {
        if (mounted) setState(() => loading = false);
      }
      return;
    }
    await Future<void>.delayed(const Duration(milliseconds: 550));
    if (!mounted) return;
    setState(() => loading = false);
    context.push(
      '/otp?purpose=login&contact=${Uri.encodeComponent(contact.text.trim())}',
    );
  }

  @override
  Widget build(BuildContext context) => AppPage(
    title: 'Welcome back',
    back: false,
    children: [
      const DtLogo(size: 54),
      const SizedBox(height: 20),
      Text(
        'Your next move,\nmade simple.',
        style: Theme.of(context).textTheme.headlineMedium,
      ),
      const SizedBox(height: 10),
      const Text('Sign in to DT Exchange.'),
      if (!ref.watch(previewModeProvider) &&
          ref.watch(biometricPreferenceProvider).asData?.value == true)
        Padding(
          padding: const EdgeInsets.only(top: 20),
          child: DtButton(
            label: 'Unlock with biometrics',
            icon: Icons.fingerprint_rounded,
            style: DtButtonStyle.secondary,
            loading: loading,
            onPressed: loading
                ? null
                : () async {
                    setState(() => loading = true);
                    await ref.read(previewProvider.notifier).restore();
                    if (!context.mounted) return;
                    setState(() => loading = false);
                    if (ref.read(previewProvider).signedIn) {
                      context.go('/home');
                    } else {
                      toast(
                        context,
                        'Session could not be unlocked. Try again or sign in normally.',
                      );
                    }
                  },
          ),
        ),
      const SizedBox(height: 28),
      DtReveal(
        child: SurfaceCard(
          child: Form(
            key: form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SegmentedButton<bool>(
                  segments: const [
                    ButtonSegment(value: false, label: Text('Password')),
                    ButtonSegment(value: true, label: Text('OTP')),
                  ],
                  selected: {otp},
                  onSelectionChanged: (v) => setState(() => otp = v.first),
                ),
                const SizedBox(height: 24),
                DtField(
                  label: 'Mobile or email',
                  controller: contact,
                  keyboardType: TextInputType.emailAddress,
                  validator: contactValidator,
                ),
                if (!otp) ...[
                  const SizedBox(height: 18),
                  DtField(
                    label: 'Password',
                    controller: password,
                    obscureText: true,
                    validator: passwordValidator,
                  ),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: () => context.push('/forgot-password'),
                      child: Text(
                        'Forgot password?',
                        style: TextStyle(
                          color: dtColor(context, DtColors.navy),
                        ),
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 20),
                DtButton(
                  label: otp ? 'Send OTP' : 'Sign in',
                  loading: loading,
                  onPressed: submit,
                  icon: Icons.arrow_forward_rounded,
                ),
              ],
            ),
          ),
        ),
      ),
      const SizedBox(height: 20),
      const Text('New to DT Exchange?', textAlign: TextAlign.center),
      const SizedBox(height: 12),
      DtButton(
        label: 'Create account',
        style: DtButtonStyle.secondary,
        icon: Icons.person_add_alt_1_rounded,
        onPressed: loading ? null : () => context.push('/register'),
      ),
      const SizedBox(height: 12),
      if (ref.watch(previewModeProvider)) ...[
        const InfoNote(
          'Use a sample email/mobile and any 8-character password. Preview OTP: 123456. No SMS or email is sent.',
        ),
        const SizedBox(height: 14),
        DtButton(
          label: 'Explore the preview',
          style: DtButtonStyle.secondary,
          onPressed: () {
            ref.read(previewProvider.notifier).login();
            context.go('/home');
          },
        ),
      ],
      const SizedBox(height: 18),
      Text(
        'Sell USDT. Receive INR.',
        textAlign: TextAlign.center,
        style: TextStyle(fontSize: 12, color: dtColor(context, DtColors.muted)),
      ),
    ],
  );
}

class RegisterPage extends ConsumerStatefulWidget {
  const RegisterPage({super.key, this.referralCode});
  final String? referralCode;
  @override
  ConsumerState<RegisterPage> createState() => _RegisterState();
}

class _RegisterState extends ConsumerState<RegisterPage> {
  late final referral = TextEditingController(text: widget.referralCode);
  final form = GlobalKey<FormState>();
  final name = TextEditingController(),
      email = TextEditingController(),
      mobile = TextEditingController(),
      password = TextEditingController();
  bool accepted = false, loading = false;
  @override
  void dispose() {
    for (final c in [name, email, mobile, password, referral]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> submit() async {
    if (!form.currentState!.validate()) return;
    if (!accepted) {
      toast(context, 'Please accept the preview terms to continue.');
      return;
    }
    setState(() => loading = true);
    if (!ref.read(previewModeProvider)) {
      if (password.text.length < 12) {
        toast(context, 'Use at least 12 characters');
        setState(() => loading = false);
        return;
      }
      try {
        await ref
            .read(previewProvider.notifier)
            .registerApi(
              name.text,
              email.text,
              mobile.text,
              password.text,
              referralCode: referralComingSoon ? null : referral.text,
            );
        if (mounted) {
          context.push(
            '/otp?purpose=register&contact=${Uri.encodeComponent(ref.read(previewProvider.notifier).registrationOtpContact ?? email.text)}',
          );
        }
      } catch (e) {
        if (mounted) toast(context, apiMessage(e));
      } finally {
        if (mounted) setState(() => loading = false);
      }
      return;
    }
    await Future<void>.delayed(const Duration(milliseconds: 500));
    if (!mounted) return;
    ref
        .read(previewProvider.notifier)
        .register(name.text, email.text, mobile.text);
    setState(() => loading = false);
    context.push(
      '/otp?purpose=register&contact=${Uri.encodeComponent(mobile.text)}',
    );
  }

  @override
  Widget build(BuildContext context) => AppPage(
    title: 'Create account',
    children: [
      Text('A fresh start.', style: Theme.of(context).textTheme.headlineMedium),
      const SizedBox(height: 8),
      const Text('Your details. One simple account.'),
      const SizedBox(height: 24),
      SurfaceCard(
        child: Form(
          key: form,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              DtField(
                label: 'Full name',
                controller: name,
                validator: (v) =>
                    (v?.trim().length ?? 0) > 1 ? null : 'Enter your full name',
              ),
              const SizedBox(height: 18),
              DtField(
                label: 'Mobile number',
                controller: mobile,
                keyboardType: TextInputType.phone,
                validator: (v) => RegExp(r'^\+?\d{10,13}$').hasMatch(v ?? '')
                    ? null
                    : 'Enter a valid mobile number',
              ),
              const SizedBox(height: 18),
              DtField(
                label: 'Email',
                controller: email,
                keyboardType: TextInputType.emailAddress,
                validator: emailValidator,
              ),
              const SizedBox(height: 18),
              DtField(
                label: 'Password',
                controller: password,
                obscureText: true,
                validator: passwordValidator,
              ),
              const SizedBox(height: 14),
              if (!ref.read(previewModeProvider) && !referralComingSoon) ...[
                DtField(
                  label: 'Referral code (optional)',
                  controller: referral,
                ),
                const SizedBox(height: 14),
              ],
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                value: accepted,
                onChanged: (v) => setState(() => accepted = v ?? false),
                title: const Text(
                  'I accept the Terms and Privacy Policy',
                  style: TextStyle(fontSize: 12),
                ),
              ),
              Wrap(
                children: [
                  TextButton(
                    onPressed: () => context.push('/legal/terms'),
                    child: const Text('Terms'),
                  ),
                  TextButton(
                    onPressed: () => context.push('/legal/privacy'),
                    child: const Text('Privacy'),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              DtButton(
                label: 'Create account',
                loading: loading,
                onPressed: submit,
                icon: Icons.arrow_forward_rounded,
              ),
            ],
          ),
        ),
      ),
      const SizedBox(height: 20),
      if (ref.watch(previewModeProvider))
        const InfoNote(
          'Preview registration uses sample data and does not create a live account.',
        ),
    ],
  );
}

class OtpPage extends ConsumerStatefulWidget {
  const OtpPage({required this.purpose, required this.contact, super.key});
  final String purpose, contact;
  @override
  ConsumerState<OtpPage> createState() => _OtpState();
}

class _OtpState extends ConsumerState<OtpPage> {
  final code = TextEditingController();
  Timer? timer;
  int remaining = 30;
  bool busy = false, success = false;
  String? error;
  @override
  void initState() {
    super.initState();
    startTimer();
  }

  void startTimer() {
    timer?.cancel();
    remaining = ref.read(previewModeProvider) ? 30 : 60;
    timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return;
      if (remaining <= 1) {
        t.cancel();
        setState(() => remaining = 0);
      } else {
        setState(() => remaining--);
      }
    });
  }

  @override
  void dispose() {
    timer?.cancel();
    code.dispose();
    super.dispose();
  }

  Future<void> verify() async {
    if (!ref.read(previewModeProvider)) {
      if (busy) return;
      setState(() => busy = true);
      try {
        await ref.read(previewProvider.notifier).verifyOtpApi(code.text);
        if (!mounted) return;
        setState(() => success = true);
        await Future<void>.delayed(const Duration(milliseconds: 450));
        if (!mounted) return;
        context.go(widget.purpose == 'reset' ? '/reset-password' : '/home');
      } catch (e) {
        if (mounted) setState(() => error = apiMessage(e));
      } finally {
        if (mounted) setState(() => busy = false);
      }
      return;
    }
    if (code.text != previewOtp) {
      setState(() => error = 'Use the preview code 123456.');
      return;
    }
    setState(() => busy = true);
    await Future<void>.delayed(const Duration(milliseconds: 500));
    if (!mounted) return;
    setState(() {
      busy = false;
      success = true;
    });
    await Future<void>.delayed(const Duration(milliseconds: 600));
    if (!mounted) return;
    if (widget.purpose == 'reset') {
      context.go('/reset-password');
    } else {
      ref.read(previewProvider.notifier).login();
      context.go('/home');
    }
  }

  @override
  Widget build(BuildContext context) => AppPage(
    title: 'Verify your number',
    children: [
      Center(
        child: success
            ? const SuccessMark()
            : Container(
                padding: const EdgeInsets.all(22),
                decoration: BoxDecoration(
                  color: dtColor(context, DtColors.softBlue),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.sms_outlined,
                  size: 35,
                  color: dtColor(context, DtColors.navy),
                ),
              ),
      ),
      const SizedBox(height: 26),
      Text(
        success ? 'Youâ€™re all set.' : 'Enter the 6-digit code',
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.headlineMedium,
      ),
      const SizedBox(height: 12),
      Text(
        'For ${widget.contact.isEmpty ? 'your preview account' : widget.contact}',
        textAlign: TextAlign.center,
      ),
      const SizedBox(height: 26),
      SurfaceCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: code,
              keyboardType: TextInputType.number,
              autofillHints: const [AutofillHints.oneTimeCode],
              maxLength: 6,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              textAlign: TextAlign.center,
              style: TextStyle(
                letterSpacing: 12,
                fontSize: 28,
                fontWeight: FontWeight.w600,
                color: dtColor(context, DtColors.navy),
              ),
              decoration: InputDecoration(
                labelText: 'Verification code',
                counterText: '',
                errorText: error,
              ),
              onSubmitted: (_) => verify(),
            ),
            const SizedBox(height: 24),
            DtButton(
              label: 'Verify & continue',
              loading: busy,
              onPressed: success ? null : verify,
            ),
            const SizedBox(height: 16),
            TextButton(
              onPressed: remaining == 0
                  ? () async {
                      if (!ref.read(previewModeProvider)) {
                        try {
                          final controller = ref.read(previewProvider.notifier);
                          if (widget.purpose == 'contact') {
                            await controller.requestContactOtp();
                          } else {
                            await controller.requestOtp(
                              widget.contact,
                              widget.purpose,
                            );
                          }
                          if (mounted) setState(startTimer);
                        } catch (e) {
                          if (context.mounted) toast(context, apiMessage(e));
                        }
                        return;
                      }
                      setState(startTimer);
                      toast(context, 'Preview code is still 123456.');
                    }
                  : null,
              child: Text(
                remaining == 0 ? 'Resend code' : 'Resend in ${remaining}s',
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: 20),
      if (ref.watch(previewModeProvider))
        const InfoNote('Demo OTP: 123456. This preview does not send messages.')
      else if (ref.read(previewProvider.notifier).developmentOtp != null)
        InfoNote(
          'Development inbox code: ${ref.read(previewProvider.notifier).developmentOtp}. Sandbox only.',
        ),
    ],
  );
}

class ForgotPasswordPage extends ConsumerStatefulWidget {
  const ForgotPasswordPage({super.key});
  @override
  ConsumerState<ForgotPasswordPage> createState() => _ForgotState();
}

class _ForgotState extends ConsumerState<ForgotPasswordPage> {
  final c = TextEditingController();
  final form = GlobalKey<FormState>();
  @override
  void dispose() {
    c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AppPage(
    title: 'Forgot password',
    children: [
      Text(
        'Letâ€™s get you back in.',
        style: Theme.of(context).textTheme.headlineMedium,
      ),
      const SizedBox(height: 20),
      Form(
        key: form,
        child: DtField(
          label: 'Mobile or email',
          controller: c,
          validator: contactValidator,
        ),
      ),
      const SizedBox(height: 24),
      DtButton(
        label: 'Send reset code',
        onPressed: () async {
          if (form.currentState!.validate()) {
            if (!ref.read(previewModeProvider)) {
              try {
                await ref
                    .read(previewProvider.notifier)
                    .requestOtp(c.text, 'reset');
              } catch (e) {
                if (context.mounted) toast(context, apiMessage(e));
                return;
              }
              if (!context.mounted) return;
            }
            context.push(
              '/otp?purpose=reset&contact=${Uri.encodeComponent(c.text)}',
            );
          }
        },
      ),
      const SizedBox(height: 20),
      if (ref.watch(previewModeProvider))
        const InfoNote(
          'Use preview code 123456. No reset email or SMS is sent.',
        ),
    ],
  );
}
