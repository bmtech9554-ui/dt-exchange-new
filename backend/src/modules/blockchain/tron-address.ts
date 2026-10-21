import { createHash } from "node:crypto";
const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const sha = (b: Buffer) => createHash("sha256").update(b).digest();
export function tronAddress(hex: string): string {
  if (!/^(41)?[0-9a-fA-F]{40}$/.test(hex)) throw new Error("INVALID_ADDRESS");
  const body = Buffer.from(hex.length === 40 ? "41" + hex : hex, "hex");
  const bytes = Buffer.concat([body, sha(sha(body)).subarray(0, 4)]);
  let n = BigInt("0x" + bytes.toString("hex")),
    out = "";
  while (n) {
    out = alphabet[Number(n % 58n)] + out;
    n /= 58n;
  }
  return out;
}
export function validTronAddress(address: string) {
  try {
    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) return false;
    let n = 0n;
    for (const c of address) n = n * 58n + BigInt(alphabet.indexOf(c));
    const raw = Buffer.from(n.toString(16).padStart(50, "0"), "hex");
    return (
      raw.length === 25 &&
      raw[0] === 0x41 &&
      raw.subarray(21).equals(sha(sha(raw.subarray(0, 21))).subarray(0, 4))
    );
  } catch {
    return false;
  }
}
