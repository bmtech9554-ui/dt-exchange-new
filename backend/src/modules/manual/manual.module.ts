import {
  Module,
  Controller,
  Get,
  Post,
  Header,
  Body,
  Req,
  Param,
  Query,
  Headers,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Public } from "../../common/auth.guard";
import { AdminModule, AdminGuard, SensitiveAdmin } from "../admin/admin.module";
import { LedgerModule } from "../ledger/ledger.module";
import { OrdersModule } from "../orders/orders.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ManualService } from "./manual.service";
import { AndroidService } from "./android.service";
const page = (s: string) => {
  if (!/^\d{1,5}$/.test(s) || +s < 1) throw new BadRequestException();
  return +s;
};
@Controller("manual")
class ManualUserController {
  constructor(private s: ManualService) {}
  @Get("configuration") config(@Req() r: any) {
    return this.s.configuration(r.user.userId);
  }
  @Get("deposits") list(@Req() r: any, @Query("page") p = "1") {
    return this.s.deposits(r.user.userId, false, page(p));
  }
  @Get("deposits/:id") detail(
    @Req() r: any,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.s.detail(r.user.userId, id);
  }
  @Post("deposits") submit(
    @Req() r: any,
    @Body() b: any,
    @Headers("idempotency-key") key?: string,
  ) {
    return this.s.submit(r.user.userId, b, key);
  }
  @Post("deposits/:id/resubmit") resubmit(
    @Req() r: any,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: any,
  ) {
    return this.s.resubmit(r.user.userId, id, b);
  }
  @Post("files")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 5242880, files: 1, fields: 1 },
    }),
  )
  upload(@Req() r: any, @UploadedFile() f: any, @Body("purpose") p: string) {
    return this.s.upload(r.user.userId, false, f, p);
  }
  @Get("files/:id") @Header("Cache-Control", "no-store") file(
    @Req() r: any,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.s.file(r.user.userId, false, id);
  }
}
@Public()
@UseGuards(AdminGuard)
@Controller("admin/manual")
class ManualAdminController {
  constructor(
    private s: ManualService,
    private android: AndroidService,
  ) {}
  @Get('deposit-policy') depositPolicy(@Req() r:any) { return this.s.readDepositPolicy(r.admin.id); }
  @Post('deposit-policy') updateDepositPolicy(@Req() r:any,@Body() body:any) { return this.s.updateDepositPolicy(r.admin.id,body); }
  @Get('deposit-wallet') depositWallet(@Req() r:any) { return this.s.depositWallet(r.admin.id); }
  @Post('deposit-wallet') updateDepositWallet(@Req() r:any,@Body() body:any) { return this.s.updateDepositWallet(r.admin.id,body); }
  @Get("dashboard") dashboard(@Req() r: any) {
    return this.s.dashboard(r.admin.id);
  }
  @Get("deposits") deposits(@Req() r: any, @Query("page") p = "1") {
    return this.s.deposits(r.admin.id, true, page(p));
  }
  @Get('deposits/:id') async depositRecord(@Req() r:any,@Param('id',ParseUUIDPipe) id:string){return (await this.s.deposits(r.admin.id,true,1,id))[0]??null;}
  @Post("deposits/:id/review") review(
    @Req() r: any,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: any,
  ) {
    return this.s.review(r.admin.id, id, b);
  }
  @Get("payouts") payouts(@Req() r: any, @Query("page") p = "1") {
    return this.s.payoutList(r.admin.id, page(p));
  }
  @Post('orders/:id/review') reviewOrder(@Req() r:any,@Param('id',ParseUUIDPipe) id:string,@Body() body:unknown){return this.s.reviewOrder(r.admin.id,id,body);}
  @Get('payouts/:id') async payoutRecord(@Req() r:any,@Param('id',ParseUUIDPipe) id:string){return (await this.s.payoutList(r.admin.id,1,id))[0]??null;}
  @Post('payouts/:id/beneficiary') @SensitiveAdmin('PAYOUT_PROCESS') @Header('Cache-Control','no-store') beneficiary(@Req() r:any,@Param('id',ParseUUIDPipe) id:string,@Body() b:unknown){return this.s.beneficiary(r.admin.id,id,b);}
  @Post("payouts/:id/process") @SensitiveAdmin('PAYOUT_PROCESS') @Header('Cache-Control','no-store') process(
    @Req() r: any,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: any,
  ) {
    return this.s.process(r.admin.id, id, b);
  }
  @Post("payouts/:id/fail") fail(@Req() r:any,@Param("id",ParseUUIDPipe) id:string,@Body() b:unknown){return this.s.failPayout(r.admin.id,id,b);}
  @Post("payouts/:id/refund") refund(@Req() r:any,@Param("id",ParseUUIDPipe) id:string,@Body() b:unknown){return this.s.refundFailed(r.admin.id,id,b);}
  @Post("payouts/:id/review") reviewPayout(
    @Req() r: any,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: any,
  ) {
    return this.s.payoutReview(r.admin.id, id, b);
  }
  @Post("payouts/:id/confirm") confirm(
    @Req() r: any,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: any,
  ) {
    return this.s.confirm(r.admin.id, id, b);
  }
  @Post("files")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 5242880, files: 1, fields: 1 },
    }),
  )
  upload(@Req() r: any, @UploadedFile() f: any, @Body("purpose") p: string) {
    return this.s.upload(r.admin.id, true, f, p);
  }
  @Get("files/:id") @Header("Cache-Control", "no-store") file(
    @Req() r: any,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.s.file(r.admin.id, true, id);
  }
  @Get("releases") releases(@Req() r: any) {
    return this.android.history(r.admin.id);
  }
  @Post("releases") publish(@Req() r: any, @Body() b: any) {
    return this.android.publish(r.admin.id, b);
  }
}
@Public()
@Controller("app/version")
class AndroidController {
  constructor(private s: AndroidService) {}
  @Get("android") get() {
    return this.s.current();
  }
}
@Public()
@Controller('app/terms')
class ProductTermsController {
  constructor(private s: ManualService) {}
  @Get() @Header('Cache-Control','no-store') get() { return this.s.publicTerms(); }
}
@Module({
  imports: [AdminModule, LedgerModule, OrdersModule, NotificationsModule],
  controllers: [ManualUserController, ManualAdminController, AndroidController, ProductTermsController],
  providers: [ManualService, AndroidService],
  exports: [ManualService, AndroidService],
})
export class ManualModule {}
