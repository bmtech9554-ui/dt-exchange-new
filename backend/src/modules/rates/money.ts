import { BadRequestException } from "@nestjs/common";
export function decimal(value: string, places: number): bigint {
  if (!new RegExp(`^\\d{1,12}(?:\\.\\d{1,${places}})?$`).test(value))
    throw new BadRequestException("Invalid decimal amount");
  const [a, b = ""] = value.split(".");
  return BigInt(a!) * 10n ** BigInt(places) + BigInt(b.padEnd(places, "0"));
}
export function format(value: bigint, places: number) {
  const scale = 10n ** BigInt(places);
  return `${value / scale}.${(value % scale).toString().padStart(places, "0")}`;
}
export function databaseUnits(value: string, places: number) {
  const [a, b = ""] = value.split(".");
  return decimal(a + "." + b.slice(0, places).padEnd(places, "0"), places);
}
export function calculateRate(
  market: bigint,
  mode: string,
  manual: bigint | null,
  margin: number,
  spread: number,
) {
  let rate =
    mode === "manual"
      ? manual!
      : mode === "market_plus_margin"
        ? (market * (10000n + BigInt(margin))) / 10000n
        : mode === "market_minus_margin"
          ? (market * (10000n - BigInt(margin))) / 10000n
          : market;
  rate = (rate * (10000n - BigInt(spread))) / 10000n;
  if (rate <= 0n) throw new BadRequestException("Invalid rate policy");
  return rate;
}
export function calculateFee(gross: bigint, flat: bigint, bps: number) {
  return flat + (gross * BigInt(bps) + 9999n) / 10000n;
}
