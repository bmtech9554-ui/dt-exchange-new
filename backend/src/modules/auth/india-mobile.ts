/** Canonical identity prevents alternate phone formatting from bypassing OTP limits. */
export function normalizeIndiaMobile(value: string): string {
  const compact = value.trim().replace(/[ ()-]/g, "");
  if (/^[6-9][0-9]{9}$/.test(compact)) return "+91" + compact;
  if (/^91[6-9][0-9]{9}$/.test(compact)) return "+" + compact;
  if (/^0[6-9][0-9]{9}$/.test(compact)) return "+91" + compact.slice(1);
  if (/^\+91[6-9][0-9]{9}$/.test(compact)) return compact;
  return value.trim();
}
