/** Pure validation for a manually executed, multi-bank INR payout plan.
 * This function never transfers money or changes a ledger.
 * Call it inside the same DB transaction that locks the order and banks.
 */
export type ManualSplitLeg = {bankAccountId:string; amountInrMinor:string};
export function validateManualSplitPlan(
  expectedInrMinor: string,
  legs: ManualSplitLeg[],
  maxAccounts = 50,
): ManualSplitLeg[] {
  if (!/^[1-9]\d*$/.test(expectedInrMinor)) throw new Error('Invalid withdrawal total');
  if (!Array.isArray(legs) || legs.length < 1 || legs.length > maxAccounts)
    throw new Error('Invalid number of payout accounts');
  const seen = new Set<string>();
  let total = 0n;
  for (const leg of legs) {
    if (!leg || typeof leg.bankAccountId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(leg.bankAccountId))
      throw new Error('Invalid bank account ID');
    if (seen.has(leg.bankAccountId.toLowerCase())) throw new Error('Duplicate payout account');
    seen.add(leg.bankAccountId.toLowerCase());
    if (typeof leg.amountInrMinor !== 'string' || !/^[1-9]\d*$/.test(leg.amountInrMinor))
      throw new Error('Invalid payout amount');
    total += BigInt(leg.amountInrMinor);
  }
  if (total !== BigInt(expectedInrMinor)) throw new Error('Payout allocations do not equal withdrawal total');
  return legs;
}
