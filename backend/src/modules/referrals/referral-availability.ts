/** Staged reversible switch: deploy/configure only after explicit approval.
 * Unset preserves existing behavior. Invalid nonempty values fail closed.
 * Apply consistently to API and engagement worker. Never alters existing data.
 */
export function referralProgramPaused(value = process.env.REFERRAL_PROGRAM_PAUSED) {
  return value !== undefined && value !== '' && value !== 'false';
}
