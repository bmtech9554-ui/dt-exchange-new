import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  HttpException,
} from "@nestjs/common";
import {
  IsString,
  Length,
  Matches,
  IsOptional,
  IsBoolean,
  IsIn,
} from "class-validator";
import { DatabaseService } from "../../common/database.service";
import { CryptoService } from "../../common/crypto.service";
import { SecurityService } from "../../common/security.service";
import { NotificationService } from "../notifications/notification.service";
export class PinDto {
  @Matches(/^\d{6}$/) pin!: string;
  @IsOptional() @IsString() @Length(12, 256) password?: string;
}
export class DeleteDto {
  @IsString() @Length(12, 256) password!: string;
  @IsString() @Length(5, 500) reason!: string;
}
export class AppPreferencesDto {
  @IsOptional() @IsBoolean() animations?: boolean;
  @IsOptional() @IsBoolean() haptics?: boolean;
  @IsOptional() @IsIn(["en"]) language?: string;
}
@Injectable()
export class SettingsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly crypto: CryptoService,
    private readonly security: SecurityService,
    private readonly notices: NotificationService,
  ) {}
  async get(uid: string) {
    const p = (
      await this.db.query(
        "SELECT security_pin_hash,totp_enabled_at,app_preferences FROM user_profiles WHERE user_id=$1",
        [uid],
      )
    ).rows[0]!;
    return {
      pinSet: !!p.security_pin_hash,
      twoFactorEnabled: !!p.totp_enabled_at,
      biometrics: {
        mode: "DEVICE_SECURE_TOKEN_UNLOCK",
        nativeAdapterConfigured: false,
      },
      twoFactor: { mode: "ADAPTER_REQUIRED", enrollmentAvailable: false },
      preferences: {
        animations: true,
        haptics: true,
        language: "en",
        ...p.app_preferences,
      },
    };
  }
  async preferences(uid: string, d: AppPreferencesDto) {
    await this.db.transaction(async (tx) => {
      await tx.query(
        "UPDATE user_profiles SET app_preferences=app_preferences||$2::jsonb WHERE user_id=$1",
        [uid, JSON.stringify(d)],
      );
      await this.security.audit(tx, uid, "settings.preferences", uid);
    });
    return this.get(uid);
  }
  async setPin(uid: string, d: PinDto) {
    await this.security.limit("pin-set:" + uid, 5, 3600);
    if (!d.password) throw new BadRequestException("Current password required");
    const u = (
      await this.db.query("SELECT password_hash FROM users WHERE id=$1", [uid])
    ).rows[0];
    if (!(await this.crypto.verifyPassword(d.password, u?.password_hash)))
      throw new UnauthorizedException("Invalid credentials");
    const hash = await this.crypto.password(d.pin);
    await this.db.transaction(async (tx) => {
      const locked = (
        await tx.query(
          "SELECT password_hash FROM users WHERE id=$1 FOR UPDATE",
          [uid],
        )
      ).rows[0];
      if (locked?.password_hash !== u?.password_hash)
        throw new UnauthorizedException();
      await tx.query(
        "UPDATE user_profiles SET security_pin_hash=$2,pin_failures=0,pin_locked_until=NULL WHERE user_id=$1",
        [uid, hash],
      );
      await this.security.audit(tx, uid, "security.pin_changed", uid);
      await this.notices.create(
        tx,
        uid,
        "pin-change:" + crypto.randomUUID(),
        "SECURITY",
        "Security PIN updated",
        "Your security PIN was changed. Contact support if this was not you.",
        "/settings",
      );
    });
    return { pinSet: true };
  }
  async verifyPin(uid: string, pin: string) {
    await this.security.limit("pin-verify:" + uid, 10, 900);
    const result = await this.db.transaction(async (tx) => {
      const p = (
        await tx.query(
          "SELECT * FROM user_profiles WHERE user_id=$1 FOR UPDATE",
          [uid],
        )
      ).rows[0]!;
      if (p.pin_locked_until && new Date(p.pin_locked_until) > new Date())
        return "LOCKED";
      const ok =
        !!p.security_pin_hash &&
        (await this.crypto.verifyPassword(pin, p.security_pin_hash));
      const failures = p.pin_locked_until ? 1 : p.pin_failures + 1;
      await tx.query(
        "UPDATE user_profiles SET pin_failures=$2,pin_locked_until=CASE WHEN $3 THEN now()+interval '15 minutes' ELSE NULL END WHERE user_id=$1",
        [uid, ok ? 0 : failures, !ok && failures >= 5],
      );
      await this.security.audit(tx, uid, "security.pin_check", uid, {
        success: ok,
      });
      return ok ? "OK" : "INVALID";
    });
    if (result === "LOCKED")
      throw new HttpException("PIN temporarily locked", 429);
    if (result !== "OK") throw new UnauthorizedException("Invalid PIN");
    return { verified: true, authorizationGranted: false };
  }
  async deletion(uid: string, d: DeleteDto) {
    await this.security.limit("delete-account:" + uid, 3, 3600);
    const u = (
      await this.db.query("SELECT password_hash FROM users WHERE id=$1", [uid])
    ).rows[0];
    if (!(await this.crypto.verifyPassword(d.password, u?.password_hash)))
      throw new UnauthorizedException();
    return this.db.transaction(async (tx) => {
      const locked = (
        await tx.query(
          "SELECT password_hash FROM users WHERE id=$1 FOR UPDATE",
          [uid],
        )
      ).rows[0];
      if (locked?.password_hash !== u?.password_hash)
        throw new UnauthorizedException();
      if (
        (
          await tx.query(
            "SELECT 1 FROM sell_orders WHERE user_id=$1 AND status NOT IN ('completed','cancelled','expired','failed') UNION ALL SELECT 1 FROM ledger_balances WHERE user_id=$1 AND balance<>0 LIMIT 1",
            [uid],
          )
        ).rows.length
      )
        throw new ConflictException(
          "Resolve outstanding transactions or balances before account deletion",
        );
      await tx.query(
        "INSERT INTO account_deletion_requests(user_id,status,reason_ciphertext) VALUES($1,'DEACTIVATED',$2) ON CONFLICT(user_id) DO NOTHING",
        [uid, this.crypto.encrypt(d.reason, "deletion:" + uid)],
      );
      await tx.query("UPDATE users SET status='closed' WHERE id=$1", [uid]);
      await tx.query(
        "UPDATE sessions SET revoked_at=coalesce(revoked_at,now()) WHERE user_id=$1",
        [uid],
      );
      await tx.query(
        "UPDATE notification_devices SET revoked_at=now() WHERE user_id=$1",
        [uid],
      );
      await this.security.audit(tx, uid, "account.deletion_requested", uid, {
        financialRecordsRetained: true,
      });
      return {
        status: "DEACTIVATED",
        financialRecordsRetained: true,
        anonymization: "RETENTION_REVIEW_REQUIRED",
      };
    });
  }
  async legal(kind: string) {
    if (!["privacy", "terms"].includes(kind)) throw new BadRequestException();
    return (
      (
        await this.db.query("SELECT value FROM system_settings WHERE key=$1", [
          "legal_" + kind,
        ])
      ).rows[0]?.value ?? {
        title: kind,
        body: "This policy is not yet published.",
        status: "UNAVAILABLE",
      }
    );
  }
}
