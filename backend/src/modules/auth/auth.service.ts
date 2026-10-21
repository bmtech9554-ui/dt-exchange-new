import { normalizeIndiaMobile } from "./india-mobile";
import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  HttpException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomInt, randomUUID } from "node:crypto";
import { DatabaseService, SqlClient } from "../../common/database.service";
import { CryptoService } from "../../common/crypto.service";
import { SecurityService } from "../../common/security.service";
import { Principal } from "../../common/auth.guard";
import { ReferralsService } from "../referrals/referrals.service";
import { referralProgramPaused } from '../referrals/referral-availability';
import { privateBetaEnabled, requirePrivateBetaAccount } from '../../common/private-beta';
import { OtpProvider } from "./otp.provider";
import { RegisterDto, LoginDto, VerifyOtpDto } from "./auth.dto";
@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly crypto: CryptoService,
    private readonly security: SecurityService,
    private readonly otp: OtpProvider,
    private readonly referrals: ReferralsService,
  ) {}
  normalize(contact: string) {
    const c = normalizeIndiaMobile(contact).toLowerCase();
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) &&
      !/^\+[1-9][0-9]{7,14}$/.test(c)
    )
      throw new BadRequestException(
        "Use email or an international mobile number",
      );
    return c;
  }
  private async byContact(contact: string, tx: SqlClient = this.db) {
    const c = this.normalize(contact),
      hash = this.crypto.digest(c);
    const row = (
      await tx.query(
        `SELECT * FROM users WHERE ${c.includes("@") ? "email_lookup_hash" : "mobile_lookup_hash"}=$1`,
        [hash],
      )
    ).rows[0];
    return { c, hash, row };
  }
  async register(dto: RegisterDto, ip: string) {
    // Beta uses the already authorized test account. New registrations are tested
    // in the isolated harness, never by admitting arbitrary live customers.
    if (privateBetaEnabled()) throw new ServiceUnavailableException();
    const email = this.normalize(dto.email),
      mobile = this.normalize(dto.mobile);
    if (process.env.AUTH_OTP_CHANNEL === "sms" && !/^\+91[6-9][0-9]{9}$/.test(mobile)) throw new BadRequestException("Use an Indian mobile number with +91");
    await this.security.limit("register-ip:" + ip, 5, 3600);
    const password = await this.crypto.password(dto.password),
      uid = randomUUID();
    try {
      await this.db.transaction(async (tx) => {
        await tx.query(
          "INSERT INTO users(id,email_ciphertext,email_lookup_hash,mobile_ciphertext,mobile_lookup_hash,password_hash,terms_version,terms_accepted_at) VALUES($1,$2,$3,$4,$5,$6,$7,now())",
          [
            uid,
            this.crypto.encrypt(email, uid + ":email"),
            this.crypto.digest(email),
            this.crypto.encrypt(mobile, uid + ":mobile"),
            this.crypto.digest(mobile),
            password,
            "v1",
          ],
        );
        await tx.query(
          "INSERT INTO user_profiles(user_id,full_name_ciphertext) VALUES($1,$2)",
          [uid, this.crypto.encrypt(dto.fullName.trim(), uid + ":name")],
        );
        // Old invitation links must not prevent normal signup while paused.
        if(dto.referralCode && !referralProgramPaused())await this.referrals.claimTransaction(tx,uid,dto.referralCode);
        await this.security.audit(tx, uid, "auth.register", uid);
      });
    } catch (e) {
      if ((e as { code?: string }).code === "23505")
        throw new ConflictException("Unable to register these details");
      throw e;
    }
    const otpContact = process.env.AUTH_OTP_CHANNEL === "sms" ? mobile : email;
    return { ...(await this.requestOtp(otpContact, "register", ip)), otpContact };
  }
  async requestOtp(
    contact: string,
    purpose: string,
    ip: string,
    owner?: string,
  ) {
    contact = this.normalize(contact);
    if (process.env.NODE_ENV === "production" && (process.env.AUTH_OTP_CHANNEL !== "sms" || !/^\+91[6-9][0-9]{9}$/.test(contact.trim()))) throw new BadRequestException("Use an Indian mobile number with +91 for OTP");
    const { c, hash, row } = await this.byContact(contact);
    await requirePrivateBetaAccount(this.db, row?.id);
    await this.security.limit("otp-ip:" + ip, 15, 3600);
    await this.security.limit("otp-destination:" + hash, 5, 3600);
    await this.security.limit("otp-cooldown:" + hash, 1, 60);
    const id = randomUUID(),
      code = String(randomInt(100000, 1000000)),
      expiresAt = new Date(Date.now() + 300000);
    const verified =
      row && (c.includes("@") ? row.email_verified_at : row.mobile_verified_at);
    const eligible =
      row &&
      ((purpose === "register" && row.status === "pending") ||
        (purpose === "contact" &&
          row.id === owner &&
          row.status === "active") ||
        (["login", "reset"].includes(purpose) &&
          row.status === "active" &&
          verified));
    await this.db.transaction(async (tx) => {
      await tx.query(
        "UPDATE otp_challenges SET consumed_at=now() WHERE destination_hash=$1 AND purpose=$2 AND consumed_at IS NULL",
        [hash, purpose],
      );
      await tx.query(
        "INSERT INTO otp_challenges(id,user_id,destination_hash,purpose,code_hash,expires_at) VALUES($1,$2,$3,$4,$5,$6)",
        [
          id,
          eligible ? row.id : null,
          hash,
          purpose,
          this.crypto.digest(id + ":" + code, "otp"),
          expiresAt,
        ],
      );
      await this.security.audit(
        tx,
        eligible ? row.id : "anonymous",
        "otp.request",
        id,
        { purpose },
      );
    });
    // Decoy challenges preserve the response shape for unknown/ineligible accounts.
    if (eligible) {
      try {
        await this.otp.send({
          challengeId: id,
          destination: c,
          channel: c.includes("@") ? "email" : "sms",
          code,
          expiresAt,
        });
        await this.db.query(
          "UPDATE otp_challenges SET delivery_status='sent' WHERE id=$1",
          [id],
        );
      } catch (e) {
        await this.db.query(
          "UPDATE otp_challenges SET delivery_status='failed',consumed_at=now() WHERE id=$1",
          [id],
        );
        throw new ServiceUnavailableException("SMS authentication unavailable");
      }
    }
    return {
      challengeId: id,
      expiresAt: expiresAt.toISOString(),
      resendAfterSeconds: 60,
      ...(process.env.NODE_ENV !== "production" && this.otp.takeForDevelopment(id)
        ? { developmentOtp: this.otp.takeForDevelopment(id), sandbox: true }
        : {}),
    };
  }
  private async session(
    tx: SqlClient,
    userId: string,
    deviceId: string,
    label: string,
    ip: string,
    familyId = randomUUID(),
    rotatedFrom: string | null = null,
    expiresAt = new Date(Date.now() + 30 * 86400000),
  ) {
    await requirePrivateBetaAccount(tx, userId);
    if (
      (
        await tx.query(
          "SELECT totp_enabled_at FROM user_profiles WHERE user_id=$1",
          [userId],
        )
      ).rows[0]?.totp_enabled_at
    )
      throw new UnauthorizedException("Second factor integration is required");
    const id = randomUUID(),
      refreshToken = this.crypto.token();
    await tx.query(
      "INSERT INTO sessions(id,user_id,family_id,refresh_token_hash,rotated_from,device_id_hash,device_label,ip_hash,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        id,
        userId,
        familyId,
        this.crypto.digest(refreshToken, "refresh"),
        rotatedFrom,
        deviceId,
        label,
        this.crypto.digest(ip, "ip"),
        expiresAt,
      ],
    );
    return {
      accessToken: this.crypto.access(userId, id),
      refreshToken,
      expiresIn: 600,
      tokenType: "Bearer",
      sessionId: id,
    };
  }
  async login(dto: LoginDto, ip: string) {
    const { c, hash, row } = await this.byContact(dto.contact);
    await this.security.limit("login-ip:" + ip, 30, 900);
    await this.security.limit("login-account:" + hash, 8, 900);
    const valid = await this.crypto.verifyPassword(
      dto.password,
      row?.password_hash ?? null,
    );
    const permitted =
      valid &&
      row?.status === "active" &&
      (c.includes("@") ? row.email_verified_at : row.mobile_verified_at);
    await this.db.query(
      "INSERT INTO login_history(user_id,destination_hash,success,reason_code,ip_hash,device_id_hash) VALUES($1,$2,$3,$4,$5,$6)",
      [
        row?.id ?? null,
        hash,
        !!permitted,
        permitted ? "SUCCESS" : "INVALID_CREDENTIALS",
        this.crypto.digest(ip, "ip"),
        this.crypto.digest(dto.deviceId, "device"),
      ],
    );
    if (!permitted) throw new UnauthorizedException("Invalid credentials");
    return this.db.transaction(async (tx) => {
      const current = (
        await tx.query(
          "SELECT status,password_hash FROM users WHERE id=$1 FOR UPDATE",
          [row.id],
        )
      ).rows[0];
      if (
        current?.status !== "active" ||
        current.password_hash !== row.password_hash
      )
        throw new UnauthorizedException();
      await this.security.audit(tx, row.id, "auth.login", row.id);
      return this.session(
        tx,
        row.id,
        this.crypto.digest(dto.deviceId, "device"),
        dto.deviceLabel ?? "DT Exchange app",
        ip,
      );
    });
  }
  async verifyOtp(dto: VerifyOtpDto, ip: string, owner?: string) {
    await this.security.limit("otp-verify-ip:" + ip, 30, 900);
    const result = await this.db.transaction(async (tx) => {
      const row = (
        await tx.query("SELECT * FROM otp_challenges WHERE id=$1 FOR UPDATE", [
          dto.challengeId,
        ])
      ).rows[0];
      if (
        !row ||
        row.consumed_at ||
        new Date(row.expires_at) <= new Date() ||
        row.attempts >= 5 ||
        row.delivery_status !== "sent"
      )
        return null;
      await tx.query(
        "UPDATE otp_challenges SET attempts=attempts+1 WHERE id=$1",
        [row.id],
      );
      if (
        !this.crypto.equal(
          row.code_hash,
          this.crypto.digest(row.id + ":" + dto.code, "otp"),
        )
      ) {
        await this.security.audit(
          tx,
          row.user_id ?? "anonymous",
          "otp.invalid",
          row.id,
        );
        return null;
      }
      const user = (
        await tx.query("SELECT * FROM users WHERE id=$1 FOR UPDATE", [
          row.user_id,
        ])
      ).rows[0];
      if (!user || !["active", "pending"].includes(user.status)) return null;
      await requirePrivateBetaAccount(tx, user.id);
      if (row.purpose === "contact" && user.id !== owner) return null;
      await tx.query(
        "UPDATE otp_challenges SET consumed_at=now() WHERE id=$1",
        [row.id],
      );
      await this.security.audit(tx, user.id, "otp.consumed", row.id, {
        purpose: row.purpose,
      });
      if (row.purpose === "contact") {
        await tx.query(
          `UPDATE users SET ${row.destination_hash === user.email_lookup_hash ? "email_verified_at" : "mobile_verified_at"}=now(),updated_at=now() WHERE id=$1`,
          [user.id],
        );
        return { contactVerified: true };
      }
      if (row.purpose === "reset") {
        const resetToken = this.crypto.token();
        await tx.query(
          "INSERT INTO otp_challenges(user_id,destination_hash,purpose,code_hash,expires_at,delivery_status) VALUES($1,$2,'reset_grant',$3,now()+interval '5 minutes','sent')",
          [
            user.id,
            row.destination_hash,
            this.crypto.digest(resetToken, "reset"),
          ],
        );
        return { resetToken };
      }
      if (row.purpose === "register")
        await tx.query(
          `UPDATE users SET status='active',${row.destination_hash === user.email_lookup_hash ? "email_verified_at" : "mobile_verified_at"}=now(),updated_at=now() WHERE id=$1`,
          [user.id],
        );
      if (!["login", "register"].includes(row.purpose)) return null;
      const session = await this.session(
        tx,
        user.id,
        this.crypto.digest(dto.deviceId, "device"),
        dto.deviceLabel ?? "DT Exchange app",
        ip,
      );
      if(row.purpose==='register') await this.referrals.registration.verified(tx,user.id);
      return session;
    });
    if (!result) throw new UnauthorizedException("Invalid or expired code");
    return result;
  }
  async refresh(token: string, ip: string) {
    await this.security.limit("refresh-ip:" + ip, 60, 60);
    const result = await this.db.transaction(async (tx) => {
      const initial = (
        await tx.query(
          "SELECT user_id FROM sessions WHERE refresh_token_hash=$1",
          [this.crypto.digest(token, "refresh")],
        )
      ).rows[0];
      if (!initial) return null;
      await requirePrivateBetaAccount(tx, initial.user_id);
      const u = (
        await tx.query("SELECT status FROM users WHERE id=$1 FOR UPDATE", [
          initial.user_id,
        ])
      ).rows[0];
      const s = (
        await tx.query(
          "SELECT * FROM sessions WHERE refresh_token_hash=$1 FOR UPDATE",
          [this.crypto.digest(token, "refresh")],
        )
      ).rows[0];
      if (!s) return null;
      if (s.revoked_at) {
        if (s.revoke_reason === "rotated") {
          await tx.query(
            "UPDATE sessions SET revoked_at=coalesce(revoked_at,now()),revoke_reason='replay' WHERE family_id=$1",
            [s.family_id],
          );
          await this.security.audit(
            tx,
            s.user_id,
            "auth.refresh_replay",
            s.family_id,
          );
        }
        return null;
      }
      if (u?.status !== "active" || new Date(s.expires_at) <= new Date())
        return null;
      await tx.query(
        "UPDATE sessions SET revoked_at=now(),revoke_reason='rotated' WHERE id=$1",
        [s.id],
      );
      await this.security.audit(tx, s.user_id, "auth.refresh_rotated", s.id);
      return this.session(
        tx,
        s.user_id,
        s.device_id_hash,
        s.device_label ?? "DT Exchange app",
        ip,
        s.family_id,
        s.id,
        new Date(s.expires_at),
      );
    });
    if (!result) throw new UnauthorizedException();
    return result;
  }
  async reset(token: string, password: string) {
    const hash = await this.crypto.password(password);
    const ok = await this.db.transaction(async (tx) => {
      const grant = (
        await tx.query(
          "SELECT * FROM otp_challenges WHERE purpose='reset_grant' AND code_hash=$1 AND consumed_at IS NULL AND expires_at>now() FOR UPDATE",
          [this.crypto.digest(token, "reset")],
        )
      ).rows[0];
      if (!grant) return false;
      await requirePrivateBetaAccount(tx, grant.user_id);
      await tx.query(
        "UPDATE users SET password_hash=$2,updated_at=now() WHERE id=$1",
        [grant.user_id, hash],
      );
      await tx.query(
        "UPDATE otp_challenges SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL",
        [grant.user_id],
      );
      await this.revoke(tx, grant.user_id, "password_reset");
      await this.security.audit(
        tx,
        grant.user_id,
        "auth.password_reset",
        grant.user_id,
      );
      return true;
    });
    if (!ok) throw new BadRequestException("Reset authorization expired");
    return { success: true };
  }
  async changePassword(p: Principal, current: string, password: string) {
    await this.security.limit("password-change:" + p.userId, 5, 900);
    const u = (
      await this.db.query("SELECT password_hash FROM users WHERE id=$1", [
        p.userId,
      ])
    ).rows[0];
    if (!(await this.crypto.verifyPassword(current, u?.password_hash)))
      throw new UnauthorizedException("Invalid credentials");
    const hash = await this.crypto.password(password);
    await this.db.transaction(async (tx) => {
      const row = (
        await tx.query(
          "SELECT password_hash FROM users WHERE id=$1 FOR UPDATE",
          [p.userId],
        )
      ).rows[0];
      if (row?.password_hash !== u!.password_hash)
        throw new UnauthorizedException();
      await tx.query(
        "UPDATE users SET password_hash=$2,updated_at=now() WHERE id=$1",
        [p.userId, hash],
      );
      await this.revoke(tx, p.userId, "password_changed");
      await this.security.audit(
        tx,
        p.userId,
        "auth.password_changed",
        p.userId,
      );
    });
    return { success: true, reauthenticate: true };
  }
  private async revoke(tx: SqlClient, uid: string, reason: string) {
    await tx.query(
      "UPDATE sessions SET revoked_at=now(),revoke_reason=$2 WHERE user_id=$1 AND revoked_at IS NULL",
      [uid, reason],
    );
  }
  async sessions(p: Principal) {
    return (
      await this.db.query(
        'SELECT id,device_label AS "deviceLabel",created_at AS "createdAt",last_seen_at AS "lastSeenAt",expires_at AS "expiresAt",family_id=$2 AS current FROM sessions WHERE user_id=$1 AND revoked_at IS NULL AND expires_at>now() ORDER BY created_at DESC',
        [p.userId, p.familyId],
      )
    ).rows;
  }
  async logout(p: Principal, mode: "current" | "others" | "all", id?: string) {
    return this.db.transaction(async (tx) => {
      await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [p.userId]);
      let family = p.familyId;
      if (id) {
        const s = (
          await tx.query(
            "SELECT family_id FROM sessions WHERE id=$1 AND user_id=$2",
            [id, p.userId],
          )
        ).rows[0];
        if (!s) throw new BadRequestException("Session unavailable");
        family = s.family_id;
      }
      await tx.query(
        `UPDATE sessions SET revoked_at=now(),revoke_reason='logout' WHERE user_id=$1 AND revoked_at IS NULL ${mode === "all" ? "" : mode === "others" ? "AND family_id<>$2" : "AND family_id=$2"}`,
        mode === "all" ? [p.userId] : [p.userId, family],
      );
      await this.security.audit(tx, p.userId, "auth.logout", family, { mode });
      return { success: true };
    });
  }
}
