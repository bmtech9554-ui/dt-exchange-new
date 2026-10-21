import {
  Injectable,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { DatabaseService, SqlClient } from "../../common/database.service";
import { LedgerService } from "../ledger/ledger.service";
import { NotificationService } from "../notifications/notification.service";
import { SecurityService } from "../../common/security.service";
import { format } from "../rates/money";
import { RegistrationRewards } from './registration-rewards';
import { referralProgramPaused } from './referral-availability';
export type ReferralRules = {
  enabled: boolean;
  rewardType: "FIXED_INR";
  rewardAmountMinor: string;
  minimumCompletedMinor: string;
  maximumRewards: number;
  startsAt: string;
  endsAt: string;
};
export function validateRules(d: any): ReferralRules {
  if (
    !d ||
    typeof d.enabled !== "boolean" ||
    d.rewardType !== "FIXED_INR" ||
    typeof d.rewardAmountMinor !== "string" ||
    !/^\d{1,10}$/.test(d.rewardAmountMinor) ||
    typeof d.minimumCompletedMinor !== "string" ||
    !/^\d{1,14}$/.test(d.minimumCompletedMinor) ||
    !Number.isInteger(d.maximumRewards) ||
    d.maximumRewards < 1 ||
    d.maximumRewards > 10000 ||
    !Number.isFinite(Date.parse(d.startsAt)) ||
    !Number.isFinite(Date.parse(d.endsAt)) ||
    Date.parse(d.endsAt) <= Date.parse(d.startsAt)
  )
    throw new BadRequestException("Invalid referral rules");
  return {
    enabled: d.enabled,
    rewardType: d.rewardType,
    rewardAmountMinor: d.rewardAmountMinor,
    minimumCompletedMinor: d.minimumCompletedMinor,
    maximumRewards: d.maximumRewards,
    startsAt: d.startsAt,
    endsAt: d.endsAt,
  };
}
@Injectable()
export class ReferralsService {
  get registration() { return new RegistrationRewards(this.db,this.ledger,this.security); }
  constructor(
    private readonly db: DatabaseService,
    private readonly ledger: LedgerService,
    private readonly notices: NotificationService,
    private readonly security: SecurityService,
  ) {}
  async rules(tx: SqlClient = this.db) {
    const d = (
      await tx.query(
        "SELECT value FROM system_settings WHERE key='referral_rules'",
      )
    ).rows[0]?.value;
    return d
      ? validateRules(d)
      : {
          enabled: false,
          rewardType: "FIXED_INR" as const,
          rewardAmountMinor: "0",
          minimumCompletedMinor: "0",
          maximumRewards: 1,
          startsAt: "2020-01-01T00:00:00Z",
          endsAt: "2100-01-01T00:00:00Z",
        };
  }
  async code(uid: string) {
    if (referralProgramPaused()) throw new ConflictException('Referral program paused');
    return this.db.transaction(async (tx) => {
      const u = (
        await tx.query(
          "SELECT status,verification_status FROM users WHERE id=$1 FOR UPDATE",
          [uid],
        )
      ).rows[0];
      if (u?.status !== "active")
        throw new ForbiddenException("Account activation required");
      await tx.query(
        "INSERT INTO referral_codes(user_id,code) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING",
        [uid, "DT" + randomBytes(8).toString("hex").toUpperCase()],
      );
      return (
        await tx.query("SELECT code FROM referral_codes WHERE user_id=$1", [
          uid,
        ])
      ).rows[0]!.code;
    });
  }
  async overview(uid: string) {
    const paused = referralProgramPaused();
    const code = paused ? null : await this.code(uid),
      rules = await this.rules();
    const stats = (
      await this.db.query(
        "SELECT count(*)::int total,count(*) FILTER(WHERE lifecycle IN ('QUALIFIED','REWARDED'))::int qualified,coalesce(sum(reward_inr_minor) FILTER(WHERE lifecycle='REWARDED'),0)::text rewards FROM referrals WHERE referrer_id=$1",
        [uid],
      )
    ).rows[0]!;
    const base = process.env.REFERRAL_INVITE_BASE_URL ?? 'https://dtexchange.app/invite';
    if (base && (!base.startsWith("https://") || new URL(base).username))
      throw new BadRequestException("Invite configuration unavailable");
    const registration = await this.registration.overview(uid);
    return {
      code,
      inviteLink: !paused && base ? base + "?ref=" + code : null,
      enabled: !paused && rules.enabled,
      invitationsPaused: paused,
      qualifiedReferrals: stats.qualified,
      rewardsEarnedMinor: stats.rewards,
      rewardType: rules.rewardType,
      legacyHistory: (await this.db.query("SELECT id,lifecycle,created_at,reward_inr_minor::text FROM referrals WHERE referrer_id=$1 AND rule_snapshot->>'event' IS DISTINCT FROM 'REGISTRATION_OTP' ORDER BY created_at DESC LIMIT 50",[uid])).rows,
      ...registration,
      registrationPolicy: registration.registrationPolicy
        ? {...registration.registrationPolicy, enabled: !paused && registration.registrationPolicy.enabled}
        : undefined,
    };
  }
  async claim(uid: string, code: string) {
    await this.security.limit("referral-claim:" + uid, 5, 3600);
    return this.db.transaction((tx) => this.claimTransaction(tx, uid, code));
  }
  async claimTransaction(tx: SqlClient, uid: string, code: string) {
    if (referralProgramPaused()) throw new ConflictException('Referral program paused');
    await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [uid]);
    const r = (
      await tx.query("SELECT user_id FROM referral_codes WHERE code=$1", [code])
    ).rows[0];
    if (!r || r.user_id === uid)
      throw new BadRequestException("Invalid referral");
    const u = (
      await tx.query("SELECT created_at FROM users WHERE id=$1", [uid])
    ).rows[0];
    if (
      !u ||
      Date.now() - new Date(u.created_at).getTime() > 86400000 ||
      (await tx.query("SELECT id FROM sell_orders WHERE user_id=$1", [uid]))
        .rows.length
    )
      throw new ConflictException("Referral window closed");
    const registration = (await this.registration.policy(tx))?.value;
    const rules = registration?.enabled ? registration : await this.rules(tx);
    if (
      !rules.enabled ||
      ('startsAt' in rules && Date.now() < Date.parse(rules.startsAt)) ||
      ('endsAt' in rules && Date.now() > Date.parse(rules.endsAt))
    )
      throw new ConflictException("Referral campaign unavailable");
    if (
      (
        await tx.query("SELECT id FROM referrals WHERE referred_user_id=$1", [
          uid,
        ])
      ).rows.length
    )
      throw new ConflictException("Referral already registered");
    const referral = (
      await tx.query(
        "INSERT INTO referrals(referrer_id,referred_user_id,code,rule_snapshot) VALUES($1,$2,$3,$4) RETURNING id",
        [r.user_id, uid, code, JSON.stringify(rules)],
      )
    ).rows[0];
    await this.security.audit(tx, uid, "referral.claim", referral!.id);
    return { registered: true, id: referral!.id };
  }
  async reward(id: string) {
    if (referralProgramPaused()) return {rewarded:false,paused:true};
    return this.db.transaction(async (tx) => {
      const initial = (
        await tx.query(
          "SELECT referrer_id,referred_user_id FROM referrals WHERE id=$1",
          [id],
        )
      ).rows[0];
      if (!initial) return { rewarded: false };
      await tx.query(
        "SELECT id FROM users WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE",
        [[initial.referrer_id, initial.referred_user_id]],
      );
      const r = (
        await tx.query("SELECT * FROM referrals WHERE id=$1 FOR UPDATE", [id])
      ).rows[0]!;
      await tx.query("UPDATE referrals SET reward_checked_at=now() WHERE id=$1",[id]);
      if (r.lifecycle === "REWARDED")
        return { rewarded: true, duplicate: true };
      if (r.review_required || r.lifecycle === "REJECTED")
        return { rewarded: false };
      // Registration rewards accrue separately at OTP completion and are never
      // posted by the legacy automatic INR reward worker.
      if (r.rule_snapshot?.event === 'REGISTRATION_OTP') return {rewarded:false};
      const rules = validateRules(r.rule_snapshot),
        active = await this.rules(tx);
      if (
        !active.enabled ||
        Date.now() < Date.parse(rules.startsAt) ||
        Date.now() > Date.parse(rules.endsAt)
      )
        return { rewarded: false };
      const users = (
        await tx.query(
          "SELECT id FROM users WHERE id=ANY($1::uuid[]) AND status='active' AND verification_status='verified'",
          [[r.referrer_id, r.referred_user_id]],
        )
      ).rows;
      if (users.length !== 2) return { rewarded: false };
      const fraud = (
        await tx.query(
          `SELECT 1 WHERE EXISTS(SELECT 1 FROM sessions a JOIN sessions b ON a.device_id_hash=b.device_id_hash WHERE a.user_id=$1 AND b.user_id=$2) OR EXISTS(SELECT 1 FROM bank_accounts a JOIN bank_accounts b ON a.account_fingerprint=b.account_fingerprint WHERE a.user_id=$1 AND b.user_id=$2) OR EXISTS(SELECT 1 FROM risk_flags WHERE user_id=ANY($3::uuid[]) AND state<>'resolved')`,
          [
            r.referrer_id,
            r.referred_user_id,
            [r.referrer_id, r.referred_user_id],
          ],
        )
      ).rows.length;
      if (fraud) {
        await tx.query(
          "UPDATE referrals SET review_required=true,rejection_code='REVIEW_REQUIRED' WHERE id=$1",
          [id],
        );
        await this.security.audit(tx, r.referrer_id, "referral.review", id);
        return { rewarded: false, review: true };
      }
      const order = (
        await tx.query(
          "SELECT o.id FROM sell_orders o JOIN payouts p ON p.order_id=o.id JOIN quotes q ON q.id=o.quote_id JOIN ledger_journals j ON j.event_key='payout:'||p.id::text WHERE o.user_id=$1 AND o.status='completed' AND p.lifecycle='SUCCESS' AND q.net_inr_minor >= $2 AND o.completed_at >= $3 AND (NOT p.sandbox OR $4) AND NOT EXISTS(SELECT 1 FROM ledger_journals v WHERE v.reversal_of=j.id) ORDER BY o.completed_at LIMIT 1",
          [
            r.referred_user_id,
            rules.minimumCompletedMinor,
            r.created_at,
            process.env.NODE_ENV !== "production" &&
              process.env.REFERRAL_ALLOW_SANDBOX === "true",
          ],
        )
      ).rows[0];
      if (!order) return { rewarded: false };
      const count = (
        await tx.query(
          "SELECT count(*)::int n FROM referrals WHERE referrer_id=$1 AND lifecycle='REWARDED'",
          [r.referrer_id],
        )
      ).rows[0]!.n;
      if (count >= rules.maximumRewards) return { rewarded: false };
      if (BigInt(rules.rewardAmountMinor) <= 0n) return { rewarded: false };
      await tx.query(
        "UPDATE referrals SET lifecycle='QUALIFIED',status='qualified',qualified_order_id=$2 WHERE id=$1",
        [id, order.id],
      );
      const available = await this.ledger.account(
        tx,
        r.referrer_id,
        "INR",
        "available",
      );
      const expense = (
        await tx.query(
          "INSERT INTO ledger_accounts(code,asset_symbol,kind,bucket,normal_side) VALUES('platform:INR:referral-expense','INR','expense','adjustment','debit') ON CONFLICT(code) DO UPDATE SET code=excluded.code RETURNING id",
        )
      ).rows[0]!.id;
      const amount = format(BigInt(rules.rewardAmountMinor), 2);
      await this.ledger.post(tx, "referral:" + id, "referral", id, [
        { account: expense, asset: "INR", side: "debit", amount },
        { account: available, asset: "INR", side: "credit", amount },
      ]);
      await tx.query(
        "UPDATE referrals SET lifecycle='REWARDED',status='rewarded',reward_inr_minor=$2,reward_journal_id=(SELECT id FROM ledger_journals WHERE event_key=$3) WHERE id=$1",
        [id, rules.rewardAmountMinor, "referral:" + id],
      );
      await this.security.audit(tx, r.referrer_id, "referral.reward", id, {
        amountMinor: rules.rewardAmountMinor,
      });
      await this.notices.create(
        tx,
        r.referrer_id,
        "referral-reward:" + id,
        "REFERRAL",
        "Referral reward earned",
        "Your eligible referral reward has been recorded.",
        "/referral",
      );
      return { rewarded: true };
    });
  }
  async reviewExposure() {
    const rows = (
      await this.db.query(
        "SELECT r.id,r.referrer_id FROM referrals r JOIN sell_orders o ON o.id=r.qualified_order_id WHERE r.lifecycle='REWARDED' AND NOT r.review_required AND o.status<>'completed' LIMIT 100",
      )
    ).rows;
    for (const r of rows)
      await this.db.transaction(async (tx) => {
        const changed = (
          await tx.query(
            "UPDATE referrals SET review_required=true,rejection_code='QUALIFYING_ORDER_CHANGED' WHERE id=$1 AND NOT review_required RETURNING id",
            [r.id],
          )
        ).rows;
        if (changed.length) {
          await this.security.audit(
            tx,
            r.referrer_id,
            "referral.exposure_review",
            r.id,
          );
          await tx.query(
            "INSERT INTO risk_flags(user_id,code,severity,dedupe_key) VALUES($1,'REFERRAL_REWARD_EXPOSURE','high',$2) ON CONFLICT(dedupe_key) DO NOTHING",
            [r.referrer_id, "referral-exposure:" + r.id],
          );
        }
      });
  }
}
