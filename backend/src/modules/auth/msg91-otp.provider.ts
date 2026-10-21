import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { OtpProvider, OtpDelivery } from "./otp.provider";
/** Uses an approved MSG91 SMS template; OTP verification remains server-owned. */
@Injectable()
export class Msg91OtpProvider extends OtpProvider {
  async send(d: OtpDelivery): Promise<void> {
    const s = process.env;
    if (s.OTP_PROVIDER !== "msg91" || d.channel !== "sms" || !/^\+91[6-9][0-9]{9}$/.test(d.destination) || !/^[0-9]{6}$/.test(d.code) || d.expiresAt <= new Date() || !s.MSG91_AUTH_KEY || !/^[a-zA-Z0-9]{8,100}$/.test(s.MSG91_TEMPLATE_ID ?? "") || !/^[a-zA-Z][a-zA-Z0-9_]{0,30}$/.test(s.MSG91_OTP_VARIABLE ?? "") || s.MSG91_OTP_VARIABLE === "mobiles") throw new ServiceUnavailableException("SMS authentication unavailable");
    try {
      const response = await fetch("https://control.msg91.com/api/v5/flow", {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(10000),
        headers: {authkey: s.MSG91_AUTH_KEY, "content-type": "application/json", accept: "application/json"},
        body: JSON.stringify({template_id: s.MSG91_TEMPLATE_ID, short_url: "0", recipients: [{mobiles: d.destination.slice(1), [s.MSG91_OTP_VARIABLE!]: d.code}]}),
      });
      if (!response.ok) throw new Error("REJECTED");
      const body = await response.json() as {type?: unknown; message?: unknown};
      if (body.type !== "success" || typeof body.message !== "string" || !body.message.length || body.message.length > 200) throw new Error("REJECTED");
    } catch { throw new ServiceUnavailableException("SMS authentication unavailable"); }
  }
}
