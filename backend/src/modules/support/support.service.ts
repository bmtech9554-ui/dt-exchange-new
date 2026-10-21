import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  IsString,
  Length,
  IsIn,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  Max,
} from "class-validator";
import { randomUUID } from "node:crypto";
import { DatabaseService, SqlClient } from "../../common/database.service";
import { CryptoService } from "../../common/crypto.service";
import { SecurityService } from "../../common/security.service";
import { NotificationService } from "../notifications/notification.service";
export const categories = [
  "ACCOUNT",
  "BANK_ACCOUNT",
  "USDT_DEPOSIT",
  "SELL_ORDER",
  "PAYOUT",
  "TRANSACTION_DELAY",
  "SECURITY",
  "REFERRAL",
  "TECHNICAL_ISSUE",
  "OTHER",
];
export class TicketDto {
  @IsIn(categories) category!: string;
  @IsString() @Length(3, 160) subject!: string;
  @IsString() @Length(10, 5000) message!: string;
  @IsOptional() @IsIn(["NORMAL", "HIGH"]) priority?: string;
  @IsOptional() @IsUUID() orderId?: string;
  @IsOptional() @IsUUID() payoutId?: string;
}
export class ReplyDto {
  @IsString() @Length(1, 5000) message!: string;
}
export class AttachmentDto {
  @IsIn(["image/png", "image/jpeg", "application/pdf"]) mimeType!: string;
  @IsInt() @Min(1) @Max(5242880) sizeBytes!: number;
}
export abstract class SupportStorageProvider {
  abstract prepare(
    key: string,
    mime: string,
    size: number,
  ): Promise<{ uploadUrl: string | null; sandbox: boolean; status: string }>;
  abstract read(key: string): Promise<{ url: string | null; sandbox: boolean }>;
}
@Injectable()
export class MockSupportStorage extends SupportStorageProvider {
  async prepare(_k: string, _m: string, _s: number) {
    if (process.env.NODE_ENV === "production")
      throw new ServiceUnavailableException("Storage adapter unavailable");
    return { uploadUrl: null, sandbox: true, status: "PENDING" };
  }
  async read(_k: string) {
    if (process.env.NODE_ENV === "production") throw new ServiceUnavailableException("Support attachments unavailable");
    return { url: null, sandbox: true };
  }
}
@Injectable()
export class SupportService {
  constructor(
    private readonly db: DatabaseService,
    private readonly crypto: CryptoService,
    private readonly security: SecurityService,
    private readonly notices: NotificationService,
    private readonly storage: SupportStorageProvider,
  ) {}
  async list(uid: string, page = 1) {
    if (!Number.isInteger(page) || page < 1 || page > 10000)
      throw new BadRequestException();
    return (
      await this.db.query(
        "SELECT id,category,subject,priority,upper(status) status,created_at,updated_at FROM support_tickets WHERE user_id=$1 ORDER BY updated_at DESC,id LIMIT 20 OFFSET $2",
        [uid, (page - 1) * 20],
      )
    ).rows;
  }
  async create(uid: string, d: TicketDto, key?: string) {
    await this.security.limit("ticket:" + uid, 5, 3600);
    return this.security.idempotent(
      uid,
      "support.create",
      key,
      d,
      async (tx) => {
        for (const [table, id] of [
          ["sell_orders", d.orderId],
          ["payouts", d.payoutId],
        ])
          if (
            id &&
            !(
              await tx.query(
                `SELECT id FROM ${table} WHERE id=$1 AND user_id=$2`,
                [id, uid],
              )
            ).rows.length
          )
            throw new NotFoundException("Related transaction unavailable");
        const id = randomUUID();
        await tx.query(
          "INSERT INTO support_tickets(id,user_id,subject,body_ciphertext,category,priority,order_id,payout_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            id,
            uid,
            d.subject.trim(),
            this.crypto.encrypt(d.message, "ticket:" + id),
            d.category,
            d.priority ?? "NORMAL",
            d.orderId ?? null,
            d.payoutId ?? null,
          ],
        );
        await this.message(tx, id, uid, "USER", d.message);
        await this.security.audit(tx, uid, "support.create", id);
        return { id, status: "OPEN" };
      },
    );
  }
  async message(
    tx: SqlClient,
    ticket: string,
    actor: string,
    type: string,
    message: string,
    internal = false,
  ) {
    const id = randomUUID();
    await tx.query(
      "INSERT INTO support_messages(id,ticket_id,author_type,author_id,message_ciphertext,internal) VALUES($1,$2,$3,$4,$5,$6)",
      [
        id,
        ticket,
        type,
        actor,
        this.crypto.encrypt(message, "support-message:" + id),
        internal,
      ],
    );
    return id;
  }
  async detail(id: string, uid?: string) {
    const t = (
      await this.db.query(
        "SELECT t.*,u.public_user_id::text FROM support_tickets t JOIN users u ON u.id=t.user_id WHERE t.id=$1 AND ($2::uuid IS NULL OR t.user_id=$2)",
        [id, uid ?? null],
      )
    ).rows[0];
    if (!t) throw new NotFoundException();
    const messages = (
      await this.db.query(
        "SELECT * FROM support_messages WHERE ticket_id=$1 AND (NOT internal OR $2) ORDER BY created_at,id",
        [id, !uid],
      )
    ).rows.map((m) => ({
      id: m.id,
      authorType: m.author_type,
      message: this.crypto.decrypt(
        m.message_ciphertext,
        "support-message:" + m.id,
      ),
      internal: m.internal,
      createdAt: m.created_at,
    }));
    return {
      id: t.id,
      userId: t.user_id,
      publicUserId: t.public_user_id,
      category: t.category,
      subject: t.subject,
      status: t.status.toUpperCase(),
      priority: t.priority,
      assignedTo: !uid ? t.assigned_to : undefined,
      orderId: t.order_id,
      payoutId: t.payout_id,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      messages,
      attachments: (
        await this.db.query(
          "SELECT id,mime_type,size_bytes,status FROM support_attachments WHERE ticket_id=$1",
          [id],
        )
      ).rows,
    };
  }
  async reply(uid: string, id: string, d: ReplyDto, key?: string) {
    await this.security.limit("support-reply:" + uid, 30, 3600);
    return this.security.idempotent(
      uid,
      "support.reply:" + id,
      key,
      d,
      async (tx) => {
        const t = (
          await tx.query(
            "SELECT * FROM support_tickets WHERE id=$1 AND user_id=$2 FOR UPDATE",
            [id, uid],
          )
        ).rows[0];
        if (!t) throw new NotFoundException();
        if (["resolved", "closed"].includes(t.status))
          throw new ConflictException("Ticket is closed");
        await this.message(tx, id, uid, "USER", d.message);
        await tx.query(
          "UPDATE support_tickets SET status='open',updated_at=now() WHERE id=$1",
          [id],
        );
        await this.security.audit(tx, uid, "support.reply", id);
        return { sent: true };
      },
    );
  }
  async close(uid: string, id: string) {
    const r = await this.db.transaction(async (tx) => {
      const t = (
        await tx.query(
          "UPDATE support_tickets SET status='closed',updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING id",
          [id, uid],
        )
      ).rows[0];
      if (!t) throw new NotFoundException();
      await this.security.audit(tx, uid, "support.close", id);
      return { closed: true };
    });
    return r;
  }
  async attachment(uid: string, ticket: string, d: AttachmentDto) {
    await this.detail(ticket, uid);
    await this.security.limit("support-file:" + uid, 10, 3600);
    const id = randomUUID(),
      key = "support/" + uid + "/" + id;
    const info = await this.storage.prepare(key, d.mimeType, d.sizeBytes);
    await this.db.query(
      "INSERT INTO support_attachments(id,ticket_id,user_id,mime_type,size_bytes,storage_key) VALUES($1,$2,$3,$4,$5,$6)",
      [id, ticket, uid, d.mimeType, d.sizeBytes, key],
    );
    return { id, ...info };
  }
  async file(uid: string, id: string) {
    const a = (
      await this.db.query(
        "SELECT * FROM support_attachments WHERE id=$1 AND user_id=$2",
        [id, uid],
      )
    ).rows[0];
    if (!a) throw new NotFoundException();
    if (a.status !== "AVAILABLE") return { available: false, status: a.status };
    return this.storage.read(a.storage_key);
  }
  async faqs() {
    return (
      await this.db.query(
        "SELECT id,category,question,answer FROM help_articles WHERE published ORDER BY sort_order,id",
      )
    ).rows;
  }
  async adminReply(
    tx: SqlClient,
    id: string,
    actor: string,
    message: string,
    internal = false,
  ) {
    const t = (
      await tx.query("SELECT * FROM support_tickets WHERE id=$1 FOR UPDATE", [
        id,
      ])
    ).rows[0];
    if (!t) throw new NotFoundException();
    const mid = await this.message(tx, id, actor, "ADMIN", message, internal);
    await tx.query(
      "UPDATE support_tickets SET status=CASE WHEN $2 THEN status ELSE 'waiting_for_user' END,updated_at=now() WHERE id=$1",
      [id, internal],
    );
    if (!internal)
      await this.notices.create(
        tx,
        t.user_id,
        "support-reply:" + mid,
        "SUPPORT",
        "Support replied",
        "Your support ticket has a new reply.",
        "/support/tickets/" + id,
      );
    return { sent: true };
  }
}
