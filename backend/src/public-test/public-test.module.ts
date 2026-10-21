import { Body, Controller, Get, Post, Req, Param, ParseUUIDPipe, UseGuards, Module, ConflictException } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AppModule } from '../app.module';
import { AuthModule } from '../modules/auth/auth.module';
import { AuthService } from '../modules/auth/auth.service';
import { BanksModule } from '../modules/banks/banks.module';
import { BanksService } from '../modules/banks/banks.service';
import { AdminModule, AdminGuard, SensitiveAdmin } from '../modules/admin/admin.module';
import { ManualModule } from '../modules/manual/manual.module';
import { ManualService, input } from '../modules/manual/manual.service';
import { DatabaseService } from '../common/database.service';
import { SecurityService } from '../common/security.service';
import { Public } from '../common/auth.guard';
import { format, databaseUnits } from '../modules/rates/money';
import { TEST_ADDRESS, TEST_LABEL } from './isolation';

const credentials = z.object({username:z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_]{4,29}$/),password:z.string().min(12).max(128),deviceId:z.string().min(8).max(128)}).strict();
@Controller('test')
class PublicTestController {
  constructor(private auth:AuthService, private banks:BanksService, private db:DatabaseService, private security:SecurityService) {}
  @Public() @Get('status') status(){return {mode:'PUBLIC_SOFTWARE_TEST',label:TEST_LABEL,realMoney:false};}
  @Public() @Post('register') async register(@Body() body:unknown,@Req() r:any) {
    const challenge=await this.registration(body,r.ip);
    const b=input(credentials,body);
    return this.auth.verifyOtp({challengeId:challenge.challengeId,code:challenge.developmentOtp!,deviceId:b.deviceId},r.ip);
  }
  @Public() @Post('register-challenge') async challenge(@Body() body:unknown,@Req() r:any) {
    const challenge=await this.registration(body,r.ip);
    return {challengeId:challenge.challengeId,simulationCode:challenge.developmentOtp,expiresInSeconds:300,realSms:false};
  }
  @Public() @Post('verify') async verify(@Body() body:unknown,@Req() r:any) {
    const b=input(z.object({challengeId:z.string().uuid(),code:z.string().regex(/^\d{6}$/),deviceId:z.string().min(8).max(128)}).strict(),body);
    return this.auth.verifyOtp(b,r.ip);
  }
  private async registration(body:unknown,ip:string) {
    const b=input(credentials,body);
    if((await this.db.query('SELECT count(*)::int n FROM users')).rows[0]!.n>=1000) throw new ConflictException('Test account capacity reached');
    // Synthetic contact values are never sent to an email/SMS service. Only this
    // newly created account may consume its generated registration challenge.
    const mobile='+999'+BigInt('0x'+randomBytes(4).toString('hex')).toString().padStart(11,'0');
    const challenge=await this.auth.register({fullName:b.username,email:b.username+'@public-test.invalid',mobile,password:b.password,termsAccepted:true},ip);
    if(!challenge.developmentOtp) throw new Error('TEST_REGISTRATION_CHALLENGE_UNAVAILABLE');
    return challenge;
  }
  @Public() @Post('login') login(@Body() body:unknown,@Req() r:any){
    const b=input(credentials,body);
    return this.auth.login({contact:b.username+'@public-test.invalid',password:b.password,deviceId:b.deviceId,deviceLabel:'DT Exchange simulation'},r.ip);
  }
  @Post('bank') async bank(@Req() r:any){
    const current=await this.banks.list(r.user.userId);if(current.length)return current[0];
    const bank=await this.banks.add(r.user.userId,{accountHolderName:'DEMO TEST USER',accountNumber:'000000000000',ifsc:'DEMO0000000',bankName:'DEMO NON-PAYABLE BANK'},'public-test-bank-'+r.user.userId);
    // This generated fixture models an established demo beneficiary. The real
    // manual payout cooldown remains unchanged, including in this test stack.
    await this.db.query("UPDATE bank_accounts SET created_at=now()-interval '2 days' WHERE id=$1 AND user_id=$2 AND ifsc='DEMO0000000'",[bank.id,r.user.userId]);
    return bank;
  }
  @Post('reference') async reference(@Req() r:any){
    await this.security.limit('test-reference:'+r.user.userId,20,3600);
    const txHash=randomBytes(32).toString('hex');
    await this.db.query('INSERT INTO public_test_references(tx_hash,user_id) VALUES($1,$2)',[txHash,r.user.userId]);
    return {txHash,label:TEST_LABEL};
  }
}
@Public() @UseGuards(AdminGuard) @Controller('test/admin')
class PublicTestAdminController {
  constructor(private manual:ManualService,private db:DatabaseService){}
  @Post('users/:id/status') @SensitiveAdmin('users.edit') async userStatus(@Req() r:any,@Param('id',ParseUUIDPipe) id:string,@Body() body:unknown){
    await this.manual.permission(r.admin.id,'users.edit');
    const b=input(z.object({status:z.enum(['active','frozen']),confirm:z.literal(true),version:z.number().int().nonnegative()}).strict(),body);
    return this.db.transaction(async tx=>{
      const u=(await tx.query('SELECT status,admin_version FROM users WHERE id=$1 FOR UPDATE',[id])).rows[0];
      if(!u || !['active','frozen'].includes(u.status) || u.admin_version!==b.version)throw new ConflictException('Reload the user before changing demo access');
      await tx.query('UPDATE users SET status=$2,updated_at=now() WHERE id=$1',[id,b.status]);
      if(b.status==='frozen')await tx.query("UPDATE sessions SET revoked_at=now(),revoke_reason='DEMO_ADMIN_FREEZE' WHERE user_id=$1 AND revoked_at IS NULL",[id]);
      await tx.query("INSERT INTO audit_logs(actor_type,actor_id,action,entity_type,entity_id,request_id,sanitized_changes) VALUES('admin',$1,'simulation.user.status','user',$2,gen_random_uuid(),$3)",[r.admin.id,id,JSON.stringify({from:u.status,to:b.status,realMoney:false})]);
      return {status:b.status};
    });
  }
  @Post('deposits/:id/approve') @SensitiveAdmin('DEPOSIT_APPROVE') async approve(@Req() r:any,@Param('id',ParseUUIDPipe) id:string,@Body() body:unknown){
    input(z.object({confirmSimulation:z.literal(true)}).strict(),body);
    await this.manual.permission(r.admin.id,'DEPOSIT_APPROVE');
    const p=(await this.db.query('SELECT * FROM manual_deposit_requests WHERE id=$1',[id])).rows[0];
    if(!p || p.receiver!==TEST_ADDRESS || p.network_code!=='tron-mock')throw new ConflictException('Test deposit required');
    // The normal manual service retains review, journal, limit and idempotency
    // checks. The evidence below belongs exclusively to the mock network.
    return this.manual.review(r.admin.id,id,{action:'approve',note:TEST_LABEL+' — administrator approved simulation',verifiedAmount:format(databaseUnits(p.submitted_amount,6),6),txHash:p.tx_hash,receiver:TEST_ADDRESS,contract:'DT-MOCK-USDT-CONTRACT',sender:'DT-TEST-SENDER',blockNumber:'1',blockHash:p.tx_hash,confirmations:3,transactionTime:new Date(p.created_at).toISOString(),chainSucceeded:true});
  }
  @Post('payouts/:id/simulate') @SensitiveAdmin('PAYOUT_CONFIRM') async settle(@Req() r:any,@Param('id',ParseUUIDPipe) id:string,@Body() body:unknown){
    const b=input(z.object({confirmSimulation:z.literal(true),receiptId:z.string().uuid(),demoUtr:z.string().trim().regex(/^[A-Za-z0-9-]{6,64}$/).optional()}).strict(),body);
    await this.manual.permission(r.admin.id,'PAYOUT_CONFIRM');
    const p=(await this.db.query("SELECT p.*,b.ifsc,b.bank_name FROM payouts p JOIN bank_accounts b ON b.id=p.bank_account_id WHERE p.order_id=$1 AND p.provider='manual'",[id])).rows[0];
    if(!p || p.ifsc!=='DEMO0000000' || p.bank_name!=='DEMO NON-PAYABLE BANK')throw new ConflictException('Test payout required');
    return this.manual.confirm(r.admin.id,id,{amountInr:format(BigInt(p.amount_inr_minor),2),utr:'SIMULATED-'+(b.demoUtr??p.id),paidAt:new Date().toISOString(),bankUsed:'DEMO NON-PAYABLE BANK',note:TEST_LABEL+' — no bank transfer occurred',receiptId:b.receiptId,bankTransferConfirmed:true});
  }
}
@Module({imports:[AppModule,AuthModule,BanksModule,AdminModule,ManualModule],controllers:[PublicTestController,PublicTestAdminController]})
export class PublicTestModule {}
