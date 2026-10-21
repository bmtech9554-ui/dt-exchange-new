/// Exact, bounded arithmetic for the isolated UI preview. Not a live rate engine.
abstract final class PreviewMoney {
  static final scale = BigInt.from(1000000);
  static BigInt? parseUsdt(String text) {
    if (!RegExp(r'^\d{1,8}(\.\d{1,6})?$').hasMatch(text.trim())) return null;
    final parts = text.trim().split('.');
    return BigInt.parse(parts.first) * scale +
        BigInt.parse(parts.length == 2 ? parts[1].padRight(6, '0') : '0');
  }

  static String usdt(BigInt micros, {bool trim = true}) {
    final whole = micros ~/ scale;
    var fraction = (micros.abs() % scale).toString().padLeft(6, '0');
    if (trim) fraction = fraction.replaceFirst(RegExp(r'0+$'), '');
    return fraction.isEmpty ? '$whole' : '$whole.$fraction';
  }

  static BigInt gross(BigInt micros, int ratePaise) =>
      micros * BigInt.from(ratePaise) ~/ scale;
  static BigInt fee(BigInt grossPaise) =>
      (grossPaise * BigInt.from(50) + BigInt.from(9999)) ~/ BigInt.from(10000);
  static String inr(BigInt paise, {bool symbol = true}) {
    final negative = paise.isNegative;
    final digits = (paise.abs() ~/ BigInt.from(100)).toString();
    String grouped = digits;
    if (digits.length > 3) {
      final first = digits.substring(0, digits.length - 3);
      final groups = <String>[];
      for (var end = first.length; end > 0; end -= 2) {
        groups.insert(0, first.substring(end > 2 ? end - 2 : 0, end));
      }
      grouped = '${groups.join(',')},${digits.substring(digits.length - 3)}';
    }
    return '${negative ? '-' : ''}${symbol ? '₹' : ''}$grouped.${(paise.abs() % BigInt.from(100)).toString().padLeft(2, '0')}';
  }
}
