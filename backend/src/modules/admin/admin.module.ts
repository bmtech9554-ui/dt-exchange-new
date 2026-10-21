import { OperationsService } from '../../common/operations.service';
import {
  Module,
  Controller,
  Get,
  Post,
  Body,
  Req,
  Param,
  Query,
  ParseUUIDPipe,
  Injectable,
  CanActivate,
  ExecutionContext,
  UseGuards,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  SetMetadata,
  applyDecorators,
} from "@nestjs/common";
import { Reflector } from '@nestjs/core';
import {
  IsEmail,
  IsString,
  Length,
  IsOptional,
  Matches,
} from "class-validator";
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { DatabaseService } from "../../common/database.service";
import { CryptoService } from "../../common/crypto.service";
import { SecurityService } from "../../common/security.service";
import { Public } from "../../common/auth.guard";
import { EngagementAdminService } from "../../common/engagement-admin.service";
import { SupportModule } from "../support/support.module";
import { ReferralsModule } from "../referrals/referrals.module";
import { OrdersModule } from "../orders/orders.module";
import { PayoutsModule } from "../payouts/payouts.module";
import { PayoutsService } from "../payouts/payouts.service";
import { OrdersService } from "../orders/orders.service";
class LoginDto {
  @IsEmail() email!: string;
  @IsString() @Length(12, 256) password!: string;
  @IsOptional() @Matches(/^\d{6}$/) code?: string;
}
class ReasonDto {
  @IsString() @Length(10, 500) reason!: string;
}
export function totp(secret: string, step: number) {
  let bits = "";
  for (const char of secret.toUpperCase().replaceAll("=", "")) {
    const n = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(char);
    if (n < 0) throw new Error("INVALID_TOTP_SECRET");
    bits += n.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8)
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", Buffer.from(bytes)).update(counter).digest(),
    offset = h[19]! & 15;
  return ((h.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly db: DatabaseService,
    private readonly crypto: CryptoService,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest(),
      token = req.headers.authorization?.replace(/^Bearer /, "");
    if (!token || !/^[\w-]{43}$/.test(token)) throw new UnauthorizedException();
    const a = (
      await this.db.query(
        "SELECT s.id session_id,u.id FROM admin_sessions s JOIN admin_users u ON u.id=s.admin_user_id WHERE s.refresh_token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.status='active'",
        [this.crypto.digest(token, "admin-session")],
      )
    ).rows[0];
    if (!a) throw new UnauthorizedException();
    req.admin = a;
    return true;
  }
}
/** Step-up is per action: a code never extends an existing session. */
@Injectable()
export class AdminSensitiveGuard implements CanActivate {
  constructor(private db: DatabaseService, private crypto: CryptoService,
    private security: SecurityService, private reflector: Reflector) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const permission = this.reflector.get<string>('admin-sensitive-permission', ctx.getHandler());
    if (!permission || !req.admin) throw new ForbiddenException();
    const code = req.headers['x-dt-admin-totp'];
    if (code !== undefined && (typeof code !== 'string' || !/^\d{6}$/.test(code)))
      throw new BadRequestException();
    await this.security.limit('admin-sensitive:' + req.admin.id, 20, 300);
    const outcome = await this.db.transaction(async tx => {
      const row = (await tx.query(`SELECT u.id,u.totp_secret_ciphertext,u.last_totp_step,
        (s.created_at<=now() AND s.created_at>now()-interval '5 minutes') recent
        FROM admin_sessions s JOIN admin_users u ON u.id=s.admin_user_id
        WHERE s.id=$1 AND u.id=$2 AND u.status='active' AND s.revoked_at IS NULL AND s.expires_at>now()
        AND EXISTS(SELECT 1 FROM admin_user_roles r JOIN admin_role_permissions p ON p.role_id=r.role_id
          WHERE r.admin_user_id=u.id AND p.permission_code=$3) FOR UPDATE OF u`,
        [req.admin.session_id,req.admin.id,permission])).rows[0];
      if (!row) return 'denied';
      if (row.recent && (row.totp_secret_ciphertext || process.env.NODE_ENV !== 'production')) return 'allowed';
      if (!code || !row.totp_secret_ciphertext) return 'required';
      const secret = this.crypto.decrypt(row.totp_secret_ciphertext,'admin-totp:' + row.id);
      const now = Math.floor(Date.now()/30000);
      const step = [now-1,now,now+1].find(s => s>Number(row.last_totp_step??-1) &&
        timingSafeEqual(Buffer.from(totp(secret,s)),Buffer.from(code)));
      if (step === undefined) {
        await tx.query("INSERT INTO audit_logs(actor_type,actor_id,action,entity_type,entity_id,request_id,sanitized_changes) VALUES('admin',$1,'admin.sensitive_auth.failed','admin',$1,gen_random_uuid(),'{}')",[row.id]);
        return 'required';
      }
      await tx.query('UPDATE admin_users SET last_totp_step=$2 WHERE id=$1',[row.id,step]);
      await tx.query("INSERT INTO audit_logs(actor_type,actor_id,action,entity_type,entity_id,request_id,sanitized_changes) VALUES('admin',$1,'admin.sensitive_auth.confirmed','admin',$1,gen_random_uuid(),'{}')",[row.id]);
      return 'allowed';
    });
    if (outcome === 'required') throw new ForbiddenException('ADMIN_RECENT_AUTH_REQUIRED');
    if (outcome !== 'allowed') throw new ForbiddenException();
    return true;
  }
}
export const SensitiveAdmin = (permission: string) => applyDecorators(
  SetMetadata('admin-sensitive-permission',permission),UseGuards(AdminSensitiveGuard));
@Public()
@Controller("admin")
class AdminController {
  constructor(
    private readonly db: DatabaseService,
    private readonly crypto: CryptoService,
    private readonly security: SecurityService,
    private readonly orders: OrdersService,
    private readonly payouts: PayoutsService,
    private readonly operations: OperationsService,
    private readonly engagement: EngagementAdminService,
  ) {}
  private async permission(req: any, code: string) {
    const p = (
      await this.db.query(
        "SELECT 1 FROM admin_user_roles u JOIN admin_role_permissions p ON p.role_id=u.role_id WHERE u.admin_user_id=$1 AND p.permission_code=$2",
        [req.admin.id, code],
      )
    ).rows;
    if (!p.length) throw new ForbiddenException();
  }
  @Get('access') @UseGuards(AdminGuard) async access(@Req() req:any){
    // One capability query replaces probing every module on every page load.
    // Module services still enforce all permissions independently.
    const rows=(await this.db.query('SELECT DISTINCT p.permission_code FROM admin_user_roles r JOIN admin_role_permissions p ON p.role_id=r.role_id WHERE r.admin_user_id=$1 ORDER BY p.permission_code',[req.admin.id])).rows;
    return {authenticated:true,permissions:rows.map(r=>r.permission_code)};
  }
  @Get("payout-provider/balance") @UseGuards(AdminGuard) async providerBalance(
    @Req() r: any,
  ) {
    await this.permission(r, "payouts.read");
    return this.payouts.providerBalance();
  }
  @Get("payouts") @UseGuards(AdminGuard) async payoutList(
    @Req() r: any,
    @Query("status") status?: string,
    @Query("page") page = "1",
  ) {
    await this.permission(r, "payouts.read");
    if (!/^\d{1,5}$/.test(page) || +page < 1) throw new BadRequestException();
    const rows = (
      await this.db.query(
        "SELECT id FROM payouts WHERE ($1::text IS NULL OR lifecycle=$1) ORDER BY created_at DESC,id DESC LIMIT 50 OFFSET $2",
        [status ?? null, (+page - 1) * 50],
      )
    ).rows;
    return Promise.all(rows.map((p) => this.payouts.view(p.id)));
  }
  @Get("payouts/:id") @UseGuards(AdminGuard) async payoutDetail(
    @Req() r: any,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    await this.permission(r, "payouts.read");
    return {
      ...(await this.payouts.view(id)),
      attempts: (
        await this.db.query(
          "SELECT attempt_number,lifecycle,provider_ref,response_code,started_at,resolved_at FROM payout_attempts WHERE payout_id=$1 ORDER BY attempt_number",
          [id],
        )
      ).rows,
    };
  }
  @Post("payouts/:id/retry") @UseGuards(AdminGuard) async retryPayout(
    @Req() r: any,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: ReasonDto,
  ) {
    await this.permission(r, "payouts.retry");
    return this.payouts.retry(id, r.admin.id, d.reason);
  }
  @Post("payouts/:id/review") @UseGuards(AdminGuard) async reviewPayout(
    @Req() r: any,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: ReasonDto,
  ) {
    await this.permission(r, "payouts.review");
    return this.payouts.manualReview(id, r.admin.id, d.reason);
  }
  @Post("payouts/:id/refresh") @UseGuards(AdminGuard) async refreshPayout(
    @Req() r: any,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: ReasonDto,
  ) {
    await this.permission(r, "payouts.refresh");
    await this.db.transaction((tx) =>
      this.payouts.audit(
        tx,
        id,
        "payout.refresh",
        r.admin.id,
        d.reason,
        "admin",
      ),
    );
    await this.payouts.refresh(id);
    return this.payouts.view(id);
  }
  @Post("payouts/:id/note") @UseGuards(AdminGuard) async notePayout(
    @Req() r: any,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: ReasonDto,
  ) {
    await this.permission(r, "payouts.review");
    await this.payouts.view(id);
    await this.db.transaction((tx) =>
      this.payouts.audit(tx, id, "payout.note", r.admin.id, d.reason, "admin"),
    );
    return { saved: true };
  }
  @Get("reconciliation") @UseGuards(AdminGuard) async reconciliation(
    @Req() r: any,
  ) {
    await this.permission(r, "payouts.read");
    return (
      await this.db.query(
        "SELECT * FROM reconciliation_issues ORDER BY detected_at DESC LIMIT 100",
      )
    ).rows;
  }
  @Post("reconciliation/:id/resolve")
  @UseGuards(AdminGuard)
  async resolveReconciliation(
    @Req() r: any,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: ReasonDto,
  ) {
    await this.permission(r, "reconciliation.resolve");
    return this.db.transaction(async (tx) => {
      const issue = (
        await tx.query(
          "SELECT * FROM reconciliation_issues WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!issue) throw new BadRequestException("Issue unavailable");
      await tx.query(
        "UPDATE reconciliation_issues SET status='RESOLVED',resolved_at=now(),resolution_notes=$2 WHERE id=$1",
        [id, d.reason],
      );
      await this.payouts.audit(
        tx,
        issue.payout_id ?? id,
        "reconciliation.resolve",
        r.admin.id,
        d.reason,
        "admin",
      );
      return {
        resolved: true,
        financialValuesChanged: false,
        riskHoldReleased: false,
      };
    });
  }
  @Get('engagement/:area') @UseGuards(AdminGuard) engagementList(@Req() r:any,@Param('area') area:string,@Query('page') page='1',@Query('search') search='',@Query('status') status=''){return this.engagement.list(r.admin.id,area,Number(page),search,status);}
  @Get('engagement/:area/:id') @UseGuards(AdminGuard) engagementDetail(@Req() r:any,@Param('area') area:string,@Param('id',ParseUUIDPipe) id:string){return this.engagement.detail(r.admin.id,area,id);}
  @Post('engagement/:area/:id/action') @UseGuards(AdminGuard) engagementAction(@Req() r:any,@Param('area') area:string,@Param('id',ParseUUIDPipe) id:string,@Body() d:any){return this.engagement.action(r.admin.id,area,id,d);}
  @Get('operations/:area') @UseGuards(AdminGuard) operationalList(@Req() r:any,@Param('area') area:string,@Query('page') page='1',@Query('search') search=''){return this.operations.list(r.admin.id,area,Number(page),search);}
  @Post('operations/policy') @UseGuards(AdminGuard) operationalPolicy(@Req() r:any,@Body() body:any){return this.operations.policy(r.admin.id,body);}
  @Post('operations/verification/:id/note') @UseGuards(AdminGuard) verificationNote(@Req() r:any,@Param('id',ParseUUIDPipe) id:string,@Body() body:any){return this.operations.verificationNote(r.admin.id,id,body);}
  @Post('operations/controls') @UseGuards(AdminGuard) operationalControls(@Req() r:any,@Body() body:any){return this.operations.controls(r.admin.id,body);}
  @Post('operations/users/:id/status') @UseGuards(AdminGuard) operationalUser(@Req() r:any,@Param('id',ParseUUIDPipe) id:string,@Body() body:any){return this.operations.userAction(r.admin.id,id,body);}
  @Post("login") async login(@Body() dto: LoginDto, @Req() req: any) {
    await this.security.limit("admin-login-ip:" + req.ip, 10, 900);
    const hash = this.crypto.digest(dto.email.trim().toLowerCase(), "email");
    await this.security.limit("admin-login:" + hash, 5, 900);
    const a = (
      await this.db.query(
        "SELECT * FROM admin_users WHERE email_lookup_hash=$1",
        [hash],
      )
    ).rows[0];
    const valid = await this.crypto.verifyPassword(
      dto.password,
      a?.password_hash ?? null,
    );
    if (!valid || a?.status !== "active")
      throw new UnauthorizedException("Invalid admin credentials");
    const token = this.crypto.token();
    await this.db.transaction(async (tx) => {
      const locked = (
        await tx.query("SELECT * FROM admin_users WHERE id=$1 FOR UPDATE", [
          a.id,
        ])
      ).rows[0]!;
      if (!locked || locked.status !== "active" || locked.password_hash !== a.password_hash) throw new UnauthorizedException("Invalid admin credentials");
      if (locked.totp_secret_ciphertext) {
        const secret = this.crypto.decrypt(
            locked.totp_secret_ciphertext,
            "admin-totp:" + a.id,
          ),
          now = Math.floor(Date.now() / 30000);
        const step = [now - 1, now, now + 1].find(
          (s) =>
            s > Number(locked.last_totp_step ?? -1) &&
            dto.code &&
            timingSafeEqual(
              Buffer.from(totp(secret, s)),
              Buffer.from(dto.code),
            ),
        );
        if (step === undefined)
          throw new UnauthorizedException("Invalid admin credentials");
        await tx.query("UPDATE admin_users SET last_totp_step=$2 WHERE id=$1", [
          a.id,
          step,
        ]);
      } else if (process.env.NODE_ENV === "production")
        throw new ForbiddenException("Administrator MFA enrollment required");
      await tx.query(
        "INSERT INTO admin_sessions(admin_user_id,family_id,refresh_token_hash,device_id_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '15 minutes')",
        [
          a.id,
          randomUUID(),
          this.crypto.digest(token, "admin-session"),
          this.crypto.digest(
            req.headers["user-agent"] ?? "unknown",
            "admin-device",
          ),
        ],
      );
      await tx.query(
        "INSERT INTO audit_logs(actor_type,actor_id,action,entity_type,entity_id,request_id,sanitized_changes) VALUES('admin',$1,'admin.login','admin',$1,gen_random_uuid(),'{}')",
        [a.id],
      );
    });
    return { accessToken: token, expiresIn: 900 };
  }
  @Post("logout") @UseGuards(AdminGuard) async logout(@Req() req: any) {
    await this.db.query(
      "UPDATE admin_sessions SET revoked_at=now() WHERE id=$1",
      [req.admin.session_id],
    );
    return { success: true };
  }
  @Get("orders") @UseGuards(AdminGuard) async orderList(
    @Req() req: any,
    @Query("page") page = "1",
  ) {
    await this.permission(req, "orders.read");
    const offset = this.offset(page);
    return (
      await this.db.query(
        "SELECT o.id,o.order_number,o.user_id,u.public_user_id::text,o.status,o.accepted_at,o.sandbox,q.amount_usdt,q.rate_inr,q.fee_inr_minor::text,q.net_inr_minor::text,q.created_at AS quote_created_at,q.expires_at AS quote_expires_at,o.bank_account_id,b.bank_name,b.last_four,b.ifsc,p.lifecycle AS payout_status,p.utr,p.manual_receipt_id,o.completed_at,a.address FROM sell_orders o JOIN users u ON u.id=o.user_id JOIN quotes q ON q.id=o.quote_id LEFT JOIN wallet_addresses a ON a.id=o.wallet_address_id LEFT JOIN bank_accounts b ON b.id=o.bank_account_id LEFT JOIN payouts p ON p.order_id=o.id ORDER BY o.accepted_at DESC,o.id DESC LIMIT 50 OFFSET $1",
        [offset],
      )
    ).rows;
  }
  @Get("orders/:id") @UseGuards(AdminGuard) async detail(
    @Req() req: any,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    await this.permission(req, "orders.read");
    const o = (
      await this.db.query("SELECT user_id FROM sell_orders WHERE id=$1", [id])
    ).rows[0];
    if (!o) throw new BadRequestException("Order unavailable");
    return this.orders.get(o.user_id, id);
  }
  @Get("deposits") @UseGuards(AdminGuard) async depositList(
    @Req() req: any,
    @Query("page") page = "1",
  ) {
    await this.permission(req, "deposits.read");
    return (
      await this.db.query(
        "SELECT d.id,d.user_id,d.status,d.amount,d.created_at,b.tx_hash,b.receiver,b.block_number::text,b.confirmations,b.required_confirmations,b.rejection_reason,x.order_id FROM deposits d JOIN blockchain_transactions b ON b.id=d.transaction_id LEFT JOIN order_deposit_allocations x ON x.deposit_id=d.id ORDER BY d.created_at DESC,d.id DESC LIMIT 50 OFFSET $1",
        [this.offset(page)],
      )
    ).rows;
  }
  @Get("reviews") @UseGuards(AdminGuard) async reviews(
    @Req() req: any,
    @Query("page") page = "1",
  ) {
    await this.permission(req, "reviews.read");
    return (
      await this.db.query(
        "SELECT id,user_id,order_id,code,severity,state,sanitized_context,created_at FROM risk_flags WHERE state<>'resolved' ORDER BY created_at DESC,id DESC LIMIT 50 OFFSET $1",
        [this.offset(page)],
      )
    ).rows;
  }
  @Post("reviews/:id/acknowledge") @UseGuards(AdminGuard) async acknowledge(
    @Req() req: any,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    await this.permission(req, "reviews.acknowledge");
    return this.db.transaction(async (tx) => {
      const row = (
        await tx.query(
          "UPDATE risk_flags SET state='reviewing',reviewed_by=$2 WHERE id=$1 AND state<>'resolved' RETURNING id",
          [id, req.admin.id],
        )
      ).rows[0];
      if (!row) throw new BadRequestException("Review unavailable");
      await tx.query(
        "INSERT INTO audit_logs(actor_type,actor_id,action,entity_type,entity_id,request_id,sanitized_changes) VALUES('admin',$1,'review.acknowledged','risk_flag',$2,gen_random_uuid(),$3)",
        [
          req.admin.id,
          id,
          JSON.stringify({ reason: dto.reason.replace(/[\x00-\x1f]/g, " ") }),
        ],
      );
      return { success: true, financialValuesChanged: false };
    });
  }
  private offset(page: string) {
    if (!/^\d{1,5}$/.test(page) || +page < 1)
      throw new BadRequestException("Invalid page");
    return (+page - 1) * 50;
  }
}
@Module({
  imports: [OrdersModule, PayoutsModule, SupportModule, ReferralsModule],
  controllers: [AdminController],
  providers: [AdminGuard, AdminSensitiveGuard, EngagementAdminService],
  exports: [AdminGuard, AdminSensitiveGuard],
})
export class AdminModule {}
