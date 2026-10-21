import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { OtpProvider, OtpDelivery } from "./otp.provider";
export function validBlackSmsConfig(s: NodeJS.ProcessEnv): boolean {
  return !!s.BLACKSMS_API_KEY && /^[\x21-\x7e]{8,4096}$/.test(s.BLACKSMS_API_KEY) &&
    /^[a-zA-Z0-9_-]{1,64}$/.test(s.BLACKSMS_SENDER_ID ?? "") && /^[1-9]$/.test(s.BLACKSMS_ROUTE ?? "");
}
/** Delivery acceptance is not proof of receipt; verification stays server-owned. */
@Injectable()
export class BlackSmsOtpProvider extends OtpProvider {
  async send(d: OtpDelivery): Promise<void> {
    const s = process.env;
    if (s.OTP_PROVIDER !== "blacksms" || !validBlackSmsConfig(s) || d.channel !== "sms" ||
      !/^\+91[6-9][0-9]{9}$/.test(d.destination) || !/^[0-9]{6}$/.test(d.code) ||
      !Number.isFinite(d.expiresAt.getTime()) || d.expiresAt <= new Date())
      throw new ServiceUnavailableException("SMS authentication unavailable");
    try {
      const response = await fetch("https://blacksms.in/sms", {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(10000),
        headers: { Authorization: s.BLACKSMS_API_KEY!, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ sender_id: s.BLACKSMS_SENDER_ID, variables_values: d.code,
          numbers: d.destination.slice(3), route: Number(s.BLACKSMS_ROUTE) }),
      });
      if (!response.ok) throw new Error("REJECTED");
      const body = await response.json() as {status?: unknown};
      if (body?.status !== 1) throw new Error("REJECTED");
    } catch { throw new ServiceUnavailableException("SMS authentication unavailable"); }
  }
}
