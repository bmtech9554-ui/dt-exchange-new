// UI-only release switch. Backend reward policy is separately controlled.
const referralComingSoon = bool.fromEnvironment(
  'REFERRAL_COMING_SOON',
  defaultValue: true,
);
