/** Enrollment must require recent primary authentication and verified recovery.
 * No adapter is registered and no TOTP secret is issued in Phase 3. */
export interface SecondFactorVerifier {
  verify(input: {
    userId: string;
    challengeId: string;
    code: string;
  }): Promise<{ verified: boolean; consumed: boolean }>;
}
