/** DV Connect v1 transport. Never log the URL or upstream response. */
import { ServiceUnavailableException } from "@nestjs/common";
import { OtpDelivery } from "./otp.provider";
export const DVCONNECT_V1_ENDPOINT = "https://otp.dvconnect.in/api-sms-v1.php";
export function validDvConnectConfig(s: NodeJS.ProcessEnv): boolean {
  return !!s.DVCONNECT_API_KEY && /^[\x21-\x7e]{8,4096}$/.test(s.DVCONNECT_API_KEY);
}
/** Returns a bounded response for the acceptance parser; HTTP 200 is not success. */
export async function requestDvConnectV1(d: OtpDelivery): Promise<string> {
  const s = process.env;
  if (s.OTP_PROVIDER !== "dvconnect" || !validDvConnectConfig(s) ||
      d.channel !== "sms" || !/^\+91[6-9][0-9]{9}$/.test(d.destination) ||
      !/^[0-9]{6}$/.test(d.code) || !Number.isFinite(d.expiresAt.getTime()) ||
      d.expiresAt <= new Date())
    throw new ServiceUnavailableException("SMS authentication unavailable");
  try {
    const url = new URL(DVCONNECT_V1_ENDPOINT);
    url.searchParams.set("api_key", s.DVCONNECT_API_KEY!);
    url.searchParams.set("number", d.destination.slice(3));
    url.searchParams.set("otp", d.code);
    // v1 documents query parameters. Keep this server-side, with TLS verified,
    // redirects forbidden, no automatic retry and no request/response logging.
    const response = await fetch(url, {
      method: "GET", redirect: "error", cache: "no-store",
      signal: AbortSignal.timeout(10000),
      headers: { accept: "application/json, text/plain", "cache-control": "no-store" },
    });
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      throw new Error("REJECTED");
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 8192) { await reader.cancel(); throw new Error("REJECTED"); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    if (!size) throw new Error("REJECTED");
    return Buffer.concat(chunks).toString("utf8");
  } catch { throw new ServiceUnavailableException("SMS authentication unavailable"); }
}
