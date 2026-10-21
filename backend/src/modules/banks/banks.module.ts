import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import { AuthRequest } from "../../common/auth.guard";
import { VerificationModule } from "../verification/verification.module";
import { BanksService, BankDto } from "./banks.service";
@Controller("bank-accounts")
class BanksController {
  constructor(private readonly service: BanksService) {}
  @Get() list(@Req() r: AuthRequest) {
    return this.service.list(r.user.userId);
  }
  @Get(":id") get(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.get(r.user.userId, id);
  }
  @Post() add(
    @Req() r: AuthRequest,
    @Body() dto: BankDto,
    @Headers("idempotency-key") key?: string,
  ) {
    return this.service.add(r.user.userId, dto, key);
  }
  @Patch(":id/default") default(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.modify(r.user.userId, id);
  }
  @Delete(":id") remove(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.modify(r.user.userId, id, true);
  }
}
@Module({
  imports: [VerificationModule],
  controllers: [BanksController],
  providers: [BanksService],
  exports: [BanksService],
})
export class BanksModule {}
