/** REST amounts are base-10 strings. Never use JS number for financial arithmetic. */
export type DecimalString = string & { readonly __decimal: unique symbol };
export type MinorUnitString = string & { readonly __minor: unique symbol };
export type Asset = "USDT" | "INR";
export type Network = "TRON" | "ETHEREUM" | "BSC";
export interface Money {
  readonly asset: Asset;
  readonly amount: DecimalString;
}
export interface AcceptedQuote {
  readonly id: string;
  readonly amountUsdt: DecimalString;
  readonly rateInr: DecimalString;
  readonly grossInrMinor: MinorUnitString;
  readonly feeInrMinor: MinorUnitString;
  readonly netInrMinor: MinorUnitString;
  readonly expiresAt: string;
  readonly bankAccountId: string;
  readonly fundingSource: "wallet" | "onchain";
}
