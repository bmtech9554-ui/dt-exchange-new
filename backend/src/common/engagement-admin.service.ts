import {NotificationService} from '../modules/notifications/notification.service';
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { DatabaseService } from "./database.service";
import { randomUUID } from "node:crypto";
import { SupportService } from "../modules/support/support.service";
import {
  ReferralsService,
  validateRules,
} from "../modules/referrals/referrals.service";
const permissions: Record<string, string> = {
  support: "support.write",
  faq: "support.faq",
  referrals: "referrals.read",
  rules: "referrals.rules",
  notifications: "notifications.manage",
  announcements: "notifications.publish",
  health: "system.monitor",
};
@Injectable()
export class EngagementAdminService {
  constructor(
    private readonly notices:NotificationService,
    private readonly db: DatabaseService,
    private readonly support: SupportService,
    private readonly referrals: ReferralsService,
  ) {}
  async permission(actor: string, area: string, write = false) {
    let code = permissions[area];
    if (area === "referrals" && write) code = "referrals.review";
    if (!code) throw new NotFoundException();
    if (
      !(
        await this.db.query(
          "SELECT 1 FROM admin_user_roles a JOIN admin_role_permissions p ON p.role_id=a.role_id WHERE a.admin_user_id=$1 AND p.permission_code=$2",
          [actor, code],
        )
      ).rows.length
    )
      throw new ForbiddenException();
  }
  async list(actor: string, area: string, page = 1, search = "", status = "") {
    await this.permission(actor, area);
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > 10000 ||
      search.length > 100 ||
      status.length > 30
    )
      throw new BadRequestException();
    const offset = (page - 1) * 50;
    if (area === "support")
      return (
        await this.db.query(
          "SELECT t.id,t.user_id,u.public_user_id::text,t.category,t.subject,t.priority,upper(t.status) status,t.assigned_to,t.order_id,t.payout_id,t.updated_at FROM support_tickets t JOIN users u ON u.id=t.user_id WHERE ($1='' OR t.subject ILIKE '%'||$1||'%') AND ($2='' OR t.status=lower($2)) ORDER BY t.updated_at DESC,t.id LIMIT 50 OFFSET $3",
          [search, status, offset],
        )
      ).rows;
    if (area === "faq")
      return (
        await this.db.query(
          "SELECT * FROM help_articles ORDER BY sort_order,id LIMIT 50 OFFSET $1",
          [offset],
        )
      ).rows;
    if (area === "referrals")
      return (
        await this.db.query(
          "SELECT id,referrer_id,referred_user_id,code,lifecycle,review_required,reward_inr_minor::text,created_at FROM referrals ORDER BY created_at DESC LIMIT 50 OFFSET $1",
          [offset],
        )
      ).rows;
    if (area === "rules") return [await this.referrals.rules()];
    if (area === "notifications")
      return (
        await this.db.query(
          "SELECT d.id,d.channel,d.provider,d.status,d.attempt_count,d.failure_reason,d.last_attempt_at,n.title FROM notification_deliveries d JOIN notifications n ON n.id=d.notification_id ORDER BY d.created_at DESC LIMIT 50 OFFSET $1",
          [offset],
        )
      ).rows;
    if (area === "announcements")
      return (
        await this.db.query(
          "SELECT * FROM announcements ORDER BY created_at DESC LIMIT 50 OFFSET $1",
          [offset],
        )
      ).rows;
    return [
      {
        workers: (await this.db.query("SELECT * FROM worker_heartbeats")).rows,
        failedJobs: (
          await this.db.query(
            "SELECT job_id,job_name,failure_code,attempts,created_at FROM worker_failures WHERE resolved_at IS NULL ORDER BY created_at DESC LIMIT 50",
          )
        ).rows,
        notificationQueue: (
          await this.db.query(
            "SELECT status,count(*)::text total FROM notification_deliveries GROUP BY status",
          )
        ).rows,
        supportBacklog: (
          await this.db.query(
            "SELECT count(*)::text total FROM support_tickets WHERE status IN ('open','in_progress','waiting_for_user')",
          )
        ).rows[0],
        metrics: (
          await this.db.query(
            "SELECT name,avg(value)::text average,count(*)::int samples FROM metric_samples WHERE created_at>now()-interval '1 hour' GROUP BY name",
          )
        ).rows,
      },
    ];
  }
  async detail(actor: string, area: string, id: string) {
    await this.permission(actor, area);
    if (area !== "support") throw new BadRequestException();
    return this.support.detail(id);
  }
  async action(actor: string, area: string, id: string, d: any) {
    await this.permission(actor, area, true);
    if (
      !d ||
      typeof d.reason !== "string" ||
      d.reason.length < 10 ||
      d.reason.length > 500 ||
      typeof d.action !== "string" ||
      JSON.stringify(d).length > 15000
    )
      throw new BadRequestException("Reason and action required");
    return this.db.transaction(async (tx) => {
      let result: any = { updated: true };
      if (area === "support") {
        if (
          !(
            await tx.query(
              "SELECT id FROM support_tickets WHERE id=$1 FOR UPDATE",
              [id],
            )
          ).rows.length
        )
          throw new NotFoundException();
        if (d.action === "reply" || d.action === "note") {
          if (
            typeof d.message !== "string" ||
            d.message.length < 1 ||
            d.message.length > 5000
          )
            throw new BadRequestException();
          result = await this.support.adminReply(
            tx,
            id,
            actor,
            d.message,
            d.action === "note",
          );
        } else if (d.action === "status") {
          if (
            ![
              "OPEN",
              "IN_PROGRESS",
              "WAITING_FOR_USER",
              "RESOLVED",
              "CLOSED",
            ].includes(d.status)
          )
            throw new BadRequestException();
          await tx.query(
            "UPDATE support_tickets SET status=lower($2),updated_at=now() WHERE id=$1",
            [id, d.status],
          );
        } else if (d.action === "assign") {
          if (
            !/^[0-9a-f-]{36}$/.test(d.adminId) ||
            !(
              await tx.query(
                "SELECT 1 FROM admin_users u JOIN admin_user_roles r ON r.admin_user_id=u.id JOIN admin_role_permissions p ON p.role_id=r.role_id WHERE u.id=$1 AND u.status='active' AND p.permission_code='support.write'",
                [d.adminId],
              )
            ).rows.length
          )
            throw new BadRequestException();
          await tx.query(
            "UPDATE support_tickets SET assigned_to=$2,updated_at=now() WHERE id=$1",
            [id, d.adminId],
          );
        } else if (d.action === "escalate")
          await tx.query(
            "UPDATE support_tickets SET priority='HIGH',escalated_at=now(),updated_at=now() WHERE id=$1",
            [id],
          );
        else throw new BadRequestException();
      } else if (area === "faq") {
        if (
          d.action !== "save" ||
          typeof d.question !== "string" ||
          d.question.length < 5 ||
          d.question.length > 200 ||
          typeof d.answer !== "string" ||
          d.answer.length < 5 ||
          d.answer.length > 5000 ||
          ![
            "Getting Started",
            "Account",
            "Wallet",
            "Selling USDT",
            "Bank Accounts",
            "Payouts",
            "Security",
            "Referral",
            "Support",
          ].includes(d.category) ||
          typeof d.published !== "boolean" ||
          !Number.isInteger(d.sortOrder) ||
          d.sortOrder < 0 ||
          d.sortOrder > 10000
        )
          throw new BadRequestException();
        await tx.query(
          "INSERT INTO help_articles(id,category,question,answer,published,sort_order) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET category=excluded.category,question=excluded.question,answer=excluded.answer,published=excluded.published,sort_order=excluded.sort_order,updated_at=now()",
          [id, d.category, d.question, d.answer, d.published, d.sortOrder],
        );
      } else if (area === "rules") {
        const rule = validateRules(d.rules);
        if (d.action !== "save") throw new BadRequestException();
        await tx.query(
          "INSERT INTO system_settings(key,value) VALUES('referral_rules',$1) ON CONFLICT(key) DO UPDATE SET value=excluded.value,version=system_settings.version+1,updated_at=now()",
          [JSON.stringify(rule)],
        );
      } else if (area === "referrals") {
        if (d.action !== "reject")
          throw new BadRequestException("Review cannot manually award rewards");
        await tx.query('SELECT id FROM referrals WHERE id=$1 FOR UPDATE',[id]);
        if((await tx.query('SELECT 1 FROM referral_reward_entries e JOIN referral_reward_releases x ON x.reward_id=e.id WHERE e.referral_id=$1',[id])).rows.length)throw new ConflictException('Released reward is immutable; correction requires a separate audited adjustment');
        const r = (
          await tx.query(
            "UPDATE referrals SET lifecycle='REJECTED',status='rejected',rejection_code='ADMIN_REVIEW' WHERE id=$1 AND lifecycle<>'REWARDED' RETURNING id",
            [id],
          )
        ).rows[0];
        if (!r) throw new ConflictException();
      } else if (area === "notifications" && d.action==='send') {
        if(typeof d.title!=='string'||d.title.length<3||d.title.length>120||typeof d.message!=='string'||d.message.length<5||d.message.length>2000||!Array.isArray(d.userIds)||d.userIds.length<1||d.userIds.length>100||d.userIds.some((v:any)=>typeof v!=='string'||!/^[0-9a-f-]{36}$/.test(v)))throw new BadRequestException();
        const ids=[...new Set<string>(d.userIds)];const users=(await tx.query("SELECT id FROM users WHERE id=ANY($1::uuid[]) AND status='active'",[ids])).rows;if(users.length!==ids.length)throw new BadRequestException('Audience unavailable');
        for(const u of users)await this.notices.create(tx,u.id,'admin-send:'+id+':'+u.id,'SYSTEM',d.title,d.message);
        result={queued:users.length};
      } else if (area === "notifications") {
        if (d.action !== "retry") throw new BadRequestException();
        const r = (
          await tx.query(
            "UPDATE notification_deliveries SET status='QUEUED',next_attempt_at=now(),lease_until=NULL WHERE id=$1 AND status='FAILED' AND attempt_count<5 AND (lease_until IS NULL OR lease_until<now()) RETURNING id",
            [id],
          )
        ).rows[0];
        if (!r) throw new ConflictException("Retry unavailable");
      } else if (area === "announcements") {
        if (
          d.action !== "save" ||
          typeof d.title !== "string" ||
          d.title.length < 3 ||
          d.title.length > 120 ||
          typeof d.message !== "string" ||
          d.message.length < 5 ||
          d.message.length > 2000 ||
          !["ALL_USERS", "VERIFIED_USERS", "SPECIFIC_USERS"].includes(
            d.audience,
          ) ||
          !["NORMAL", "IMPORTANT"].includes(d.priority) ||
          typeof d.published !== "boolean" ||
          !Number.isFinite(Date.parse(d.startsAt)) ||
          !Number.isFinite(Date.parse(d.endsAt)) ||
          Date.parse(d.endsAt) <= Date.parse(d.startsAt) ||
          !Array.isArray(d.userIds) ||
          d.userIds.length > 100 ||
          d.userIds.some(
            (x: any) => typeof x !== "string" || !/^[0-9a-f-]{36}$/.test(x),
          )
        )
          throw new BadRequestException();
        // Announcements are pull-displayed; never unbounded push/SMS blasts.
        await tx.query(
          "INSERT INTO announcements(id,title,message,audience,user_ids,starts_at,ends_at,priority,published,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(id) DO UPDATE SET title=excluded.title,message=excluded.message,audience=excluded.audience,user_ids=excluded.user_ids,starts_at=excluded.starts_at,ends_at=excluded.ends_at,priority=excluded.priority,published=excluded.published",
          [
            id,
            d.title,
            d.message,
            d.audience,
            d.userIds,
            d.startsAt,
            d.endsAt,
            d.priority,
            d.published,
            actor,
          ],
        );
      } else throw new BadRequestException();
      await tx.query(
        "INSERT INTO audit_logs(actor_type,actor_id,action,entity_type,entity_id,request_id,sanitized_changes) VALUES('admin',$1,$2,$3,$4,$5,$6)",
        [
          actor,
          "engagement." + d.action,
          area,
          id,
          randomUUID(),
          JSON.stringify({ reason: d.reason }),
        ],
      );
      return result;
    });
  }
}
