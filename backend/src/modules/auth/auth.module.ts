import { DvConnectOtpProvider } from "./dvconnect-otp.provider";
import { ReferralsModule } from "../referrals/referrals.module";
import { Module } from "@nestjs/common";
import { AuthController, SessionsController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { BlackSmsOtpProvider } from "./blacksms-otp.provider";
import { CryptoService } from "../../common/crypto.service";
import { DevOtpProvider, OtpProvider } from "./otp.provider";
@Module({
  imports:[ReferralsModule],
  controllers: [AuthController, SessionsController],
  providers: [AuthService, { provide: OtpProvider, inject: [CryptoService], useFactory: (crypto: CryptoService) => process.env.OTP_PROVIDER === "dvconnect" ? new DvConnectOtpProvider() : process.env.OTP_PROVIDER === "blacksms" ? new BlackSmsOtpProvider() : new DevOtpProvider(crypto) }],
  exports: [AuthService],
})
export class AuthModule {}
