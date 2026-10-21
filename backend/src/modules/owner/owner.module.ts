import {
  Module,
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  Header,
  ParseUUIDPipe,
} from "@nestjs/common";
import { OwnerService } from "./owner.service";
import { Public } from "../../common/auth.guard";
import { AdminGuard, AdminModule, SensitiveAdmin } from "../admin/admin.module";
import { LedgerModule } from "../ledger/ledger.module";
import { ReferralsModule } from '../referrals/referrals.module';
import { ReferralsService } from '../referrals/referrals.service';
import { AdminInbox } from './admin-inbox';
import { DatabaseService } from '../../common/database.service';
@Public()
@Controller("admin/owner")
@UseGuards(AdminGuard)
export class OwnerController {
  constructor(private owner: OwnerService,private referrals:ReferralsService,private db:DatabaseService) {}
  @Get('notifications') inbox(@Req() r:any,@Query('page') page='1'){return new AdminInbox(this.db).list(r.admin.id,Number(page));}
  @Post('notifications/:id/read') inboxRead(@Req() r:any,@Param('id') id:string,@Body('read') read:unknown){return new AdminInbox(this.db).mark(r.admin.id,id,read);}
  @Get('referrals') referralsList(@Req() r:any,@Query('page') page='1'){return this.referrals.registration.admin(r.admin.id,Number(page));}
  @Get('referral-settings') referralSettings(@Req() r:any){return this.referrals.registration.settings(r.admin.id);}
  @Post('referral-settings') saveReferral(@Req() r:any,@Body() body:unknown){return this.referrals.registration.save(r.admin.id,body);}
  @Post('referral-rewards/:id/release') releaseReferral(@Req() r:any,@Param('id',ParseUUIDPipe) id:string,@Body() body:unknown){return this.referrals.registration.release(r.admin.id,id,body);}
  @Get("reconciliation") reconciliation(@Req() r:any){return this.owner.reconciliation(r.admin.id);}
  @Get("health") health(@Req() r: any) {
    return this.owner.health(r.admin.id);
  }
  @Get("dashboard") dashboard(@Req() r: any) {
    return this.owner.dashboard(r.admin.id);
  }
  @Get("users") users(@Req() r: any, @Query() q: any) {
    return this.owner.users(r.admin.id, q);
  }
  @Get("users/:id") user(
    @Req() r: any,
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: any,
  ) {
    return this.owner.user(r.admin.id, id, query);
  }
  @Post("users/:id") editUser(
    @Req() r: any,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: unknown,
  ) {
    return this.owner.editUser(r.admin.id, id, b);
  }
  @Post("users/:id/notes") note(
    @Req() r: any,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: unknown,
  ) {
    return this.owner.note(r.admin.id, id, b);
  }
  @Post('users/:id/close') closeUser(@Req() r:any,@Param('id',ParseUUIDPipe) id:string,@Body() b:unknown){return this.owner.closeUser(r.admin.id,id,b);}
  @Post('banks/:id/reveal') @SensitiveAdmin('banks.reveal') @Header('Cache-Control','no-store') revealBank(@Req() r:any,@Param('id',ParseUUIDPipe) id:string,@Body() b:unknown){return this.owner.revealBank(r.admin.id,id,b);}
  @Post('banks/:id/disable') disableBank(@Req() r:any,@Param('id',ParseUUIDPipe) id:string,@Body() b:unknown){return this.owner.disableBank(r.admin.id,id,b);}
  @Get("banks") banks(@Req() r: any, @Query("page") page = "1") {
    return this.owner.banks(r.admin.id, Number(page));
  }
  @Get('orders/:id') order(@Req() r:any,@Param('id',ParseUUIDPipe) id:string){return this.owner.order(r.admin.id,id);}
  @Post("banks/:id") editBank(
    @Req() r: any,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: unknown,
  ) {
    return this.owner.editBank(r.admin.id, id, b);
  }
  @Get("wallets/:id") wallet(
    @Req() r: any,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.owner.wallet(r.admin.id, id);
  }
  @Post("wallets/:id/adjust") adjust(
    @Req() r: any,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: unknown,
  ) {
    return this.owner.adjust(r.admin.id, id, b);
  }
  @Get("deposits") deposits(@Req() r:any,@Query() q:any){return this.owner.deposits(r.admin.id,q);}
  @Get("deposits/:id") deposit(
    @Req() r: any,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.owner.deposit(r.admin.id, id);
  }
  @Post("deposits/:id/amend") amend(
    @Req() r: any,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: unknown,
  ) {
    return this.owner.amendDeposit(r.admin.id, id, b);
  }
  @Get("config/:section") config(@Req() r: any, @Param("section") s: string) {
    return this.owner.config(r.admin.id, s);
  }
  @Post("config/:section") saveConfig(
    @Req() r: any,
    @Param("section") s: string,
    @Body() b: unknown,
  ) {
    return this.owner.saveConfig(r.admin.id, s, b);
  }
  @Get("admins") admins(@Req() r: any) {
    return this.owner.admins(r.admin.id);
  }
}
@Public()
@Controller("app")
class PublicOwnerConfigController {
  constructor(private owner: OwnerService) {}
  @Get("configuration") config() {
    return this.owner.publicConfig();
  }
}
@Module({
  imports: [AdminModule, LedgerModule,ReferralsModule],
  controllers: [OwnerController, PublicOwnerConfigController],
  providers: [OwnerService],
  exports: [OwnerService],
})
export class OwnerModule {}
