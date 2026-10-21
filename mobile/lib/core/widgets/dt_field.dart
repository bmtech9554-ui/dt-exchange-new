import 'package:flutter/material.dart';

class DtField extends StatelessWidget {
  const DtField({
    required this.label,
    this.hint,
    this.controller,
    this.keyboardType,
    this.validator,
    this.obscureText = false,
    super.key,
  });
  final String label;
  final String? hint;
  final TextEditingController? controller;
  final TextInputType? keyboardType;
  final String? Function(String?)? validator;
  final bool obscureText;
  @override
  Widget build(BuildContext context) => TextFormField(
    controller: controller,
    keyboardType: keyboardType,
    validator: validator,
    obscureText: obscureText,
    enableSuggestions: !obscureText,
    autocorrect: !obscureText,
    decoration: InputDecoration(labelText: label, hintText: hint),
  );
}
