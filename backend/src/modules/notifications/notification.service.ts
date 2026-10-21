import { notificationChannelEnabled } from "../../config/manual-capabilities";
import { ObservabilityService } from "../../common/observability.service";
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { IsBoolean, IsIn, IsOptional, IsString, Length } from "class-validator";
import { randomUUID } from "node:crypto";
import { DatabaseService, SqlClient } from "../../common/database.service";
import { CryptoService } from "../../common/crypto.service";
import { SecurityService } from "../../common/security.service";
import { Principal } from "../../common/auth.guard";
import {
  PushNotificationProvider,
  EmailProvider,
  SmsProvider,
  DeliveryInput,
} from "./delivery.providers";
export class DeviceDto {
  @IsString() @Length(16, 4096) token!: string;
  @IsIn(["ANDROID", "IOS", "WEB"]) platform!: string;
}
export class PreferencesDto {
  @IsOptional() @IsBoolean() push?: boolean;
  @IsOptional() @IsBoolean() email?: boolean;
  @IsOptional() @IsBoolean() sms?: boolean;
  @IsOptional() @IsBoolean() transactions?: boolean;
  @IsOptional() @IsBoolean() security?: boolean;
  @IsOptional() @IsBoolean() referrals?: boolean;
  @IsOptional() @IsBoolean() support?: boolean;
}
export const defaults = {
  push: true,
  email: true,
  sms: false,
  transactions: true,
  security: true,
  referrals: true,
  support: true,
};
@Injectable()
export class NotificationService {
  constructor(
    private readonly observability: ObservabilityService,
    private readonly db: DatabaseService,
    private readonly crypto: CryptoService,
    private readonly security: SecurityService,
    private readonly push: PushNotificationProvider,
    private readonly email: EmailProvider,
    private readonly sms: SmsProvider,
  ) {}
  async create(
    tx: SqlClient,
    uid: string,
    key: string,
    type: string,
    title: string,
    message: string,
    route = "/notifications",
  ) {
    if (
      ![
        "ACCOUNT",
        "SECURITY",
        "DEPOSIT",
        "SELL_ORDER",
        "BLOCKCHAIN",
        "PAYOUT",
        "REFERRAL",
        "SUPPORT",
        "SYSTEM",
      ].includes(type)
    )
      throw new BadRequestException();
    if (
      !/^\/(?:notifications|settings|support|sell|history|profile|banks|referral)(?:[\w/-]*)?$/.test(
        route,
      )
    )
      throw new BadRequestException();
    return (
      await tx.query(
        "INSERT INTO notifications(user_id,type,title,body,dedupe_key,category,deep_link,data) VALUES($1,$2,$3,$4,$5,$2,$6,$7) ON CONFLICT(dedupe_key) DO NOTHING RETURNING id",
        [uid, type, title, message, key, route, JSON.stringify({ route })],
      )
    ).rows[0]?.id;
  }
  async list(uid: string, page = 1, limit = 20) {
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > 10000 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      throw new BadRequestException();
    const rows = (
      await this.db.query(
        "SELECT id,type,category,title,body,data,deep_link,read_at,created_at FROM notifications WHERE user_id=$1 AND archived_at IS NULL ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3",
        [uid, limit, (page - 1) * limit],
      )
    ).rows;
    return rows.map((n) => ({
      ...n,
      deep_link:
        n.deep_link ??
        n.data?.route ??
        (n.data?.orderId ? "/sell/track/" + n.data.orderId : null),
    }));
  }
  async read(uid: string, id?: string) {
    if (id) {
      const r = await this.db.query(
        "UPDATE notifications SET read_at=coalesce(read_at,now()) WHERE id=$1 AND user_id=$2 RETURNING id",
        [id, uid],
      );
      if (!r.rows.length) throw new NotFoundException();
    } else
      await this.db.query(
        "UPDATE notifications SET read_at=coalesce(read_at,now()) WHERE user_id=$1",
        [uid],
      );
    return { read: true };
  }
  async archive(uid: string, id: string) {
    const r = await this.db.query(
      "UPDATE notifications SET archived_at=now() WHERE id=$1 AND user_id=$2 RETURNING id",
      [id, uid],
    );
    if (!r.rows.length) throw new NotFoundException();
    return { archived: true };
  }
  async preferences(uid: string, dto?: PreferencesDto) {
    if (dto) {
      if (dto.security === false)
        throw new BadRequestException("Security alerts are required");
      await this.db.transaction(async (tx) => {
        await tx.query(
          "UPDATE user_profiles SET notification_preferences=notification_preferences||$2::jsonb WHERE user_id=$1",
          [uid, JSON.stringify({ ...dto, security: true })],
        );
        await this.security.audit(tx, uid, "notifications.preferences", uid);
      });
    }
    return {
      ...defaults,
      ...(
        await this.db.query(
          "SELECT notification_preferences FROM user_profiles WHERE user_id=$1",
          [uid],
        )
      ).rows[0]?.notification_preferences,
      security: true,
    };
  }
  async device(p: Principal, d: DeviceDto) {
    await this.security.limit("push-token:" + p.userId, 20, 3600);
    const id = randomUUID(),
      hash = this.crypto.digest(d.token, "push-token");
    return this.db.transaction(async (tx) => {
      await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [p.userId]);
      const old = (
        await tx.query(
          "SELECT id,user_id FROM notification_devices WHERE token_hash=$1 FOR UPDATE",
          [hash],
        )
      ).rows[0];
      if (old && old.user_id !== p.userId)
        throw new BadRequestException("Token is already registered");
      const deviceId = old?.id ?? id;
      await tx.query(
        "INSERT INTO notification_devices(id,user_id,session_family_id,token_hash,token_ciphertext,platform) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(token_hash) DO UPDATE SET session_family_id=excluded.session_family_id,revoked_at=NULL,updated_at=now(),platform=excluded.platform",
        [
          deviceId,
          p.userId,
          p.familyId,
          hash,
          this.crypto.encrypt(d.token, "push:" + deviceId),
          d.platform,
        ],
      );
      await this.security.audit(tx, p.userId, "notifications.device", deviceId);
      return { id: deviceId, platform: d.platform };
    });
  }
  async remove(uid: string, id: string) {
    const r = await this.db.query(
      "UPDATE notification_devices SET revoked_at=now() WHERE id=$1 AND user_id=$2 RETURNING id",
      [id, uid],
    );
    if (!r.rows.length) throw new NotFoundException();
    return { removed: true };
  }
  async fanout() {
    const rows = (
      await this.db.query(
        "SELECT n.* FROM notifications n WHERE NOT EXISTS(SELECT 1 FROM notification_deliveries d WHERE d.notification_id=n.id AND channel='IN_APP') ORDER BY n.created_at LIMIT 100",
      )
    ).rows;
    for (const n of rows)
      await this.db.transaction(async (tx) => {
        await tx.query("SELECT id FROM notifications WHERE id=$1 FOR UPDATE", [
          n.id,
        ]);
        const prefs = {
          ...defaults,
          ...(
            await tx.query(
              "SELECT notification_preferences FROM user_profiles WHERE user_id=$1",
              [n.user_id],
            )
          ).rows[0]?.notification_preferences,
          security: true,
        };
        const critical =
          n.category === "SECURITY" || n.type.startsWith("security");
        const category =
          n.category === "SYSTEM" && (n.type.startsWith("payout.") || n.type.startsWith("transaction."))
            ? "PAYOUT"
            : n.category;
        const allowed =
          critical ||
          !(
            (["PAYOUT", "DEPOSIT", "SELL_ORDER", "BLOCKCHAIN"].includes(
              category,
            ) &&
              !prefs.transactions) ||
            (category === "REFERRAL" && !prefs.referrals) ||
            (category === "SUPPORT" && !prefs.support)
          );
        const channels = [
          "IN_APP",
          ...(allowed && prefs.push ? ["PUSH"] : []),
          ...(allowed && (prefs.email || critical) ? ["EMAIL"] : []),
          ...(allowed && prefs.sms ? ["SMS"] : []),
        ];
        for (const channel of channels.filter(channel => channel === "IN_APP" || notificationChannelEnabled(channel))) {
          const devices =
            channel === "PUSH"
              ? (
                  await tx.query(
                    "SELECT id FROM notification_devices WHERE user_id=$1 AND revoked_at IS NULL AND EXISTS(SELECT 1 FROM sessions s WHERE s.family_id=notification_devices.session_family_id AND s.revoked_at IS NULL AND s.expires_at>now())",
                    [n.user_id],
                  )
                ).rows
              : [{ id: n.user_id }];
          for (const d of devices)
            await tx.query(
              "INSERT INTO notification_deliveries(notification_id,channel,device_id,destination_key,provider,status) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
              [
                n.id,
                channel,
                channel === "PUSH" ? d.id : null,
                d.id,
                channel === "IN_APP"
                  ? "internal"
                  : (process.env[channel + "_PROVIDER"] ?? "mock"),
                channel === "IN_APP" ? "DELIVERED" : "QUEUED",
              ],
            );
        }
      });
    return rows.length;
  }
  async deliver(id: string) {
    const claim = await this.db.transaction(async (tx) => {
      const d = (
        await tx.query(
          "SELECT d.*,n.user_id,n.title,n.body,n.category,n.type FROM notification_deliveries d JOIN notifications n ON n.id=d.notification_id WHERE d.id=$1 AND d.status IN ('QUEUED','FAILED') AND d.next_attempt_at<=now() AND (lease_until IS NULL OR lease_until<now()) AND d.attempt_count<5 FOR UPDATE OF d",
          [id],
        )
      ).rows[0];
      if (!d) return null;
      await tx.query(
        "UPDATE notification_deliveries SET status='QUEUED',lease_until=now()+interval '45 seconds',attempt_count=attempt_count+1,last_attempt_at=now() WHERE id=$1",
        [id],
      );
      return d;
    });
    if (!claim) return;
    const d = claim;
    if(d.category==='SYSTEM'&&(d.type.startsWith('payout.')||d.type.startsWith('transaction.')))d.category='PAYOUT';
    try {
      if (!notificationChannelEnabled(d.channel)) {
        await this.db.query("UPDATE notification_deliveries SET status='SKIPPED',lease_until=NULL,failure_reason='CHANNEL_DISABLED' WHERE id=$1", [id]);
        return;
      }
      if (d.provider !== "mock")
        throw new ServiceUnavailableException("Adapter unavailable");
      const u = (
        await this.db.query("SELECT * FROM users WHERE id=$1", [d.user_id])
      ).rows[0];
      const prefs = await this.preferences(d.user_id);
      const critical = d.category === "SECURITY";
      const optedOut =
        (!critical &&
          ((d.channel === "EMAIL" && !prefs.email) ||
            (d.channel === "SMS" && !prefs.sms) ||
            (d.category === "REFERRAL" && !prefs.referrals) ||
            (d.category === "SUPPORT" && !prefs.support) ||
            (["PAYOUT", "DEPOSIT", "SELL_ORDER", "BLOCKCHAIN"].includes(
              d.category,
            ) &&
              !prefs.transactions))) ||
        (d.channel === "PUSH" && !prefs.push);
      let destination = "";
      if (d.channel === "PUSH") {
        const token = (
          await this.db.query(
            "SELECT * FROM notification_devices WHERE id=$1 AND revoked_at IS NULL AND EXISTS(SELECT 1 FROM sessions s WHERE s.family_id=notification_devices.session_family_id AND s.revoked_at IS NULL AND s.expires_at>now())",
            [d.device_id],
          )
        ).rows[0];
        if (token)
          destination = this.crypto.decrypt(
            token.token_ciphertext,
            "push:" + token.id,
          );
      } else if (d.channel === "EMAIL" && u?.email_verified_at)
        destination = this.crypto.decrypt(u.email_ciphertext, u.id + ":email");
      else if (d.channel === "SMS" && u?.mobile_verified_at)
        destination = this.crypto.decrypt(
          u.mobile_ciphertext,
          u.id + ":mobile",
        );
      if (!destination || u?.status === "closed" || optedOut) {
        await this.db.query(
          "UPDATE notification_deliveries SET status='SKIPPED',lease_until=NULL WHERE id=$1",
          [id],
        );
        return;
      }
      const provider =
        d.channel === "PUSH"
          ? this.push
          : d.channel === "EMAIL"
            ? this.email
            : this.sms;
      const input: DeliveryInput = {
        key: id,
        destination,
        title: d.title,
        message: d.body,
        template: ["SECURITY", "PAYOUT", "SUPPORT"].includes(d.category)
          ? d.category
          : "TRANSACTION",
      };
      const result = await this.observability.safeProviderCall(
        "notification-" + d.channel.toLowerCase(),
        (signal) => provider.send({ ...input, signal }),
      );
      if (
        !["SENT", "DELIVERED"].includes(result.status) ||
        typeof result.reference !== "string" ||
        result.reference.length > 200
      )
        throw new Error("INVALID_PROVIDER_RESULT");
      await this.db.query(
        "UPDATE notification_deliveries SET status=$2,provider_ref=$3,lease_until=NULL,failure_reason=NULL WHERE id=$1",
        [id, result.status, result.reference],
      );
    } catch {
      await this.db.query(
        "UPDATE notification_deliveries SET status='FAILED',lease_until=NULL,failure_reason='DELIVERY_UNAVAILABLE',next_attempt_at=now()+($2*interval '1 second') WHERE id=$1",
        [id, Math.min(3600, 2 ** (d.attempt_count + 1) * 5)],
      );
      throw new ServiceUnavailableException("Delivery unavailable");
    }
  }
  async announcements(uid: string) {
    return (
      await this.db.query(
        "SELECT a.id,a.title,a.message,a.priority FROM announcements a JOIN users u ON u.id=$1 WHERE a.published AND now() BETWEEN a.starts_at AND a.ends_at AND (a.audience='ALL_USERS' OR a.audience='VERIFIED_USERS' AND u.verification_status='verified' OR a.audience='SPECIFIC_USERS' AND u.id=ANY(a.user_ids)) ORDER BY a.created_at DESC LIMIT 20",
        [uid],
      )
    ).rows;
  }
}
