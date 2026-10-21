import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { CryptoService } from "../../common/crypto.service";
export interface OtpDelivery {
  challengeId: string;
  destination: string;
  channel: "email" | "sms";
  code: string;
  expiresAt: Date;
}
export abstract class OtpProvider {
  abstract send(delivery: OtpDelivery): Promise<void>;
  takeForDevelopment(_id: string): string | undefined {
    return undefined;
  }
}
/** Explicit local developer inbox. No log output or persistent plaintext storage. */
@Injectable()
export class DevOtpProvider extends OtpProvider {
  constructor(private readonly crypto: CryptoService) {
    super();
  }
  private inbox = new Map<string, { ciphertext: Buffer; expiresAt: Date }>();
  async send(delivery: OtpDelivery) {
    if (
      process.env.NODE_ENV === "production" ||
      process.env.OTP_PROVIDER !== "dev"
    )
      throw new ServiceUnavailableException();
    for (const [id, v] of this.inbox)
      if (v.expiresAt <= new Date()) this.inbox.delete(id);
    this.inbox.set(delivery.challengeId, {
      ciphertext: this.crypto.encrypt(
        delivery.code,
        "dev-otp:" + delivery.challengeId,
      ),
      expiresAt: delivery.expiresAt,
    });
  }
  takeForDevelopment(id: string) {
    if (
      process.env.NODE_ENV === "production" ||
      process.env.DEV_OTP_EXPOSE !== "true"
    )
      return undefined;
    const value = this.inbox.get(id);
    return value && value.expiresAt > new Date()
      ? this.crypto.decrypt(value.ciphertext, "dev-otp:" + id)
      : undefined;
  }
}

/** Vendor-neutral email/SMS bridge. Bind this explicitly after audited delivery adapters are configured. */
import { EmailProvider,SmsProvider } from '../notifications/delivery.providers';
@Injectable()
export class MessagingOtpProvider extends OtpProvider {
 constructor(private readonly email:EmailProvider,private readonly sms:SmsProvider){super();}
 async send(d:OtpDelivery){const provider=d.channel==='email'?this.email:this.sms;const result=await provider.send({key:'otp:'+d.challengeId,destination:d.destination,title:'Your verification code',message:`Your DT Exchange verification code is ${d.code}. Do not share it.`,template:'OTP',signal:AbortSignal.timeout(10000)});if(process.env.NODE_ENV==='production'&&result.sandbox)throw new ServiceUnavailableException();}
}
