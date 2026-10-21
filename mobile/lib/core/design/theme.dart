import 'package:flutter/material.dart';
import 'tokens.dart';

final dtLightTheme = ThemeData(
  useMaterial3: true,
  brightness: Brightness.light,
  scaffoldBackgroundColor: DtColors.background,
  colorScheme: const ColorScheme.light(
    primary: DtColors.emerald,
    onPrimary: DtColors.navy,
    secondary: DtColors.teal,
    onSecondary: DtColors.navy,
    surface: DtColors.white,
    onSurface: DtColors.navy,
    error: DtColors.red,
    onError: DtColors.white,
    outline: DtColors.border,
  ),
  textTheme: const TextTheme(
    displaySmall: TextStyle(
      fontSize: 40,
      fontWeight: FontWeight.w600,
      letterSpacing: -1.5,
      color: DtColors.navy,
    ),
    headlineMedium: TextStyle(
      fontSize: 28,
      fontWeight: FontWeight.w600,
      letterSpacing: -.7,
      color: DtColors.navy,
    ),
    titleLarge: TextStyle(
      fontSize: 20,
      fontWeight: FontWeight.w600,
      color: DtColors.navy,
    ),
    titleMedium: TextStyle(
      fontSize: 16,
      fontWeight: FontWeight.w600,
      color: DtColors.navy,
    ),
    bodyLarge: TextStyle(fontSize: 16, height: 1.5, color: DtColors.navy),
    bodyMedium: TextStyle(fontSize: 14, height: 1.5, color: DtColors.muted),
    labelLarge: TextStyle(
      fontSize: 14,
      fontWeight: FontWeight.w600,
      color: DtColors.navy,
    ),
    labelSmall: TextStyle(fontSize: 12, color: DtColors.muted),
  ),
  appBarTheme: const AppBarTheme(
    backgroundColor: DtColors.background,
    foregroundColor: DtColors.navy,
    elevation: 0,
    scrolledUnderElevation: 0,
    centerTitle: false,
  ),
  cardTheme: CardThemeData(
    color: DtColors.white,
    surfaceTintColor: Colors.transparent,
    elevation: 0,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(DtRadius.card),
    ),
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: DtColors.background,
    contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(DtRadius.control),
      borderSide: const BorderSide(color: DtColors.border),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(DtRadius.control),
      borderSide: const BorderSide(color: DtColors.border),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(DtRadius.control),
      borderSide: const BorderSide(color: DtColors.blue, width: 2),
    ),
    errorBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(DtRadius.control),
      borderSide: const BorderSide(color: DtColors.red),
    ),
  ),
  navigationBarTheme: NavigationBarThemeData(
    backgroundColor: DtColors.white,
    indicatorColor: DtColors.softMint,
    surfaceTintColor: Colors.transparent,
    elevation: 0,
    height: 76,
    labelTextStyle: WidgetStateProperty.resolveWith(
      (states) => TextStyle(
        fontSize: 12,
        fontWeight: states.contains(WidgetState.selected)
            ? FontWeight.w600
            : FontWeight.w400,
        color: states.contains(WidgetState.selected)
            ? DtColors.navy
            : DtColors.muted,
      ),
    ),
  ),
  dividerColor: DtColors.border,
);

final dtDarkTheme = dtLightTheme.copyWith(
  brightness: Brightness.dark,
  scaffoldBackgroundColor: DtColors.darkBackground,
  colorScheme: const ColorScheme.dark(
    primary: DtColors.mint,
    onPrimary: DtColors.navy,
    secondary: DtColors.aqua,
    onSecondary: DtColors.navy,
    surface: DtColors.darkSurface,
    onSurface: DtColors.darkText,
    outline: DtColors.darkBorder,
    error: Color(0xFFFFA3AD),
  ),
  textTheme: dtLightTheme.textTheme.apply(
    bodyColor: DtColors.darkText,
    displayColor: DtColors.darkText,
  ),
  iconTheme: const IconThemeData(color: DtColors.darkText),
  appBarTheme: dtLightTheme.appBarTheme.copyWith(
    backgroundColor: DtColors.darkBackground,
    foregroundColor: DtColors.darkText,
  ),
  cardTheme: dtLightTheme.cardTheme.copyWith(color: DtColors.darkSurface),
  inputDecorationTheme: dtLightTheme.inputDecorationTheme.copyWith(
    fillColor: DtColors.darkSurface,
    labelStyle: const TextStyle(color: DtColors.darkMuted),
    hintStyle: const TextStyle(color: DtColors.darkMuted),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(DtRadius.control),
      borderSide: const BorderSide(color: DtColors.darkBorder),
    ),
  ),
  navigationBarTheme: dtLightTheme.navigationBarTheme.copyWith(
    backgroundColor: DtColors.darkSurface,
    indicatorColor: DtColors.darkMint,
    iconTheme: WidgetStateProperty.resolveWith(
      (states) => IconThemeData(
        color: states.contains(WidgetState.selected)
            ? DtColors.darkText
            : DtColors.darkMuted,
      ),
    ),
    labelTextStyle: const WidgetStatePropertyAll(
      TextStyle(color: DtColors.darkText, fontSize: 12),
    ),
  ),
  dividerColor: DtColors.darkBorder,
);
