import {
  Body,
  Controller,
  Get,
  Headers,
  Module,
  Post,
  Req,
} from "@nestjs/common";
import { IsUUID } from "class-validator";
import { AuthRequest } from "../../common/auth.guard";
import {
  MockVerificationProvider,
  ManualBankVerificationProvider,
  VerificationProvider,
} from "./verification.provider";
import { VerificationService } from "./verification.service";
class SubmitDto {
  @IsUUID() verificationId!: string;
}
@Controller("verification")
class VerificationController {
  constructor(private readonly service: VerificationService) {}
  @Get("status") status(@Req() r: AuthRequest) {
    return this.service.status(r.user.userId);
  }
  @Post("start") start(
    @Req() r: AuthRequest,
    @Headers("idempotency-key") key?: string,
  ) {
    return this.service.start(r.user.userId, key);
  }
  @Post("submit") submit(
    @Req() r: AuthRequest,
    @Body() dto: SubmitDto,
    @Headers("idempotency-key") key?: string,
  ) {
    return this.service.submit(r.user.userId, dto.verificationId, key);
  }
}
@Module({
  controllers: [VerificationController],
  providers: [
    VerificationService,
    { provide: VerificationProvider, useFactory: () => process.env.BANK_VERIFICATION_PROVIDER === "manual-review" ? new ManualBankVerificationProvider() : new MockVerificationProvider() },
  ],
  exports: [VerificationProvider],
})
export class VerificationModule {}
