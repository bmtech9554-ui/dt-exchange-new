import { Module, Controller, Get, Post, Req, Body } from "@nestjs/common";
import { Matches } from "class-validator";
import { AuthRequest } from "../../common/auth.guard";
import { LedgerModule } from "../ledger/ledger.module";
import { ReferralsService } from "./referrals.service";
class ClaimDto {
  @Matches(/^DT[A-Z0-9]{8,32}$/) code!: string;
}
@Controller("referrals")
class ReferralsController {
  constructor(private readonly service: ReferralsService) {}
  @Get("me") me(@Req() r: AuthRequest) {
    return this.service.overview(r.user.userId);
  }
  @Post("claim") claim(@Req() r: AuthRequest, @Body() d: ClaimDto) {
    return this.service.claim(r.user.userId, d.code);
  }
}
@Module({
  imports: [LedgerModule],
  controllers: [ReferralsController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
