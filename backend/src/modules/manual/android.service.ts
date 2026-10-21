import {
  Injectable,
  ServiceUnavailableException,
  BadRequestException,
} from "@nestjs/common";
import { createPublicKey, verify } from "node:crypto";
import { z } from "zod";
import { DatabaseService } from "../../common/database.service";
import { ManualService, input } from "./manual.service";
const schema = z
  .object({
    versionName: z.string().regex(/^\d+\.\d+\.\d+$/),
    versionCode: z.number().int().positive(),
    minimumVersionCode: z.number().int().positive(),
    apkUrl: z.string().url(),
    downloadUrl: z.string().url(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    certificateSha256: z.string().regex(/^[a-f0-9]{64}$/),
    sizeBytes: z.number().int().positive(),
    releaseNotes: z.string().min(1).max(4000),
    mandatory: z.boolean(),
    signature: z.string().min(40).max(500),
  })
  .strict();
export function officialUrl(value: string) {
  try {
    const u = new URL(value),
      allowed = (process.env.APK_ALLOWED_ORIGINS ?? "")
        .split(",")
        .filter(Boolean);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.hash &&
      !u.search &&
      allowed.includes(u.origin)
    );
  } catch {
    return false;
  }
}
export function releasePayload(b: any) {
  return JSON.stringify({
    versionName: b.versionName,
    versionCode: b.versionCode,
    minimumVersionCode: b.minimumVersionCode,
    apkUrl: b.apkUrl,
    downloadUrl: b.downloadUrl,
    sha256: b.sha256,
    certificateSha256: b.certificateSha256,
    sizeBytes: b.sizeBytes,
    releaseNotes: b.releaseNotes,
    mandatory: b.mandatory,
  });
}
@Injectable()
export class AndroidService {
  constructor(
    private db: DatabaseService,
    private manual: ManualService,
  ) {}
  async current() {
    const r = (
      await this.db.query("SELECT * FROM android_releases WHERE active")
    ).rows[0];
    if (!r)
      return {
        available: false,
        latestVersion: null,
        latestVersionCode: null,
        minimumVersionCode: 0,
        apkUrl: null,
        releaseNotes: "Signed Android release not published yet.",
        mandatory: false,
      };
    if (!officialUrl(r.apk_url) || !officialUrl(r.download_url))
      throw new ServiceUnavailableException("Android release unavailable");
    return {
      available: true,
      latestVersion: r.version_name,
      latestVersionCode: r.version_code,
      minimumVersionCode: r.minimum_version_code,
      apkUrl: r.apk_url,
      downloadUrl: r.download_url,
      sha256: r.sha256,
      certificateSha256: r.certificate_sha256,
      sizeBytes: String(r.size_bytes),
      releaseDate: r.created_at,
      releaseNotes: r.release_notes,
      mandatory: r.mandatory,
    };
  }
  async history(admin: string) {
    await this.manual.permission(admin, "ANDROID_RELEASE_PUBLISH");
    return (
      await this.db.query(
        "SELECT version_code,version_name,minimum_version_code,sha256,certificate_sha256,size_bytes,active,created_at,apk_url,download_url,release_notes,mandatory,attestation FROM android_releases ORDER BY version_code DESC",
      )
    ).rows.map(({ attestation, ...r }) => {
      let verified = false;
      try {
        const key = createPublicKey(Buffer.from(process.env.APK_RELEASE_PUBLIC_KEY_B64 ?? "", "base64"));
        verified = key.asymmetricKeyType === "ed25519" && verify(null, Buffer.from(releasePayload({
          versionName: r.version_name, versionCode: r.version_code,
          minimumVersionCode: r.minimum_version_code, apkUrl: r.apk_url,
          downloadUrl: r.download_url, sha256: r.sha256,
          certificateSha256: r.certificate_sha256, sizeBytes: Number(r.size_bytes),
          releaseNotes: r.release_notes, mandatory: r.mandatory,
        })), key, Buffer.from(attestation ?? "", "base64"));
      } catch { /* Missing or invalid evidence must not appear verified. */ }
      const urlsValid = officialUrl(r.apk_url) && officialUrl(r.download_url);
      return { ...r, size_bytes: String(r.size_bytes),
        apk_url: urlsValid ? r.apk_url : null,
        download_url: urlsValid ? r.download_url : null,
        attestation_status: verified ? "VERIFIED" : "UNVERIFIED",
        signing_status: verified && /^[a-f0-9]{64}$/.test(r.certificate_sha256)
          ? "VERIFIED_BY_RELEASE_ATTESTATION" : "UNVERIFIED",
      };
    });
  }
  async publish(admin: string, body: unknown) {
    await this.manual.permission(admin, "ANDROID_RELEASE_PUBLISH");
    const b = input(schema, body);
    if (
      !officialUrl(b.apkUrl) ||
      !officialUrl(b.downloadUrl) ||
      new URL(b.apkUrl).pathname !== "/downloads/DTExchange.apk" ||
      new URL(b.downloadUrl).pathname !== "/download" ||
      b.minimumVersionCode > b.versionCode
    )
      throw new BadRequestException("Official HTTPS release metadata required");
    try {
      const key = createPublicKey(
        Buffer.from(process.env.APK_RELEASE_PUBLIC_KEY_B64 ?? "", "base64"),
      );
      if (
        key.asymmetricKeyType !== "ed25519" ||
        !verify(
          null,
          Buffer.from(releasePayload(b)),
          key,
          Buffer.from(b.signature, "base64"),
        )
      )
        throw new Error();
    } catch {
      throw new BadRequestException("Verified signed APK attestation required");
    }
    return this.db.transaction(async (tx) => {
      await tx.query("SELECT pg_advisory_xact_lock(8008008)");
      const old = (
        await tx.query(
          "SELECT version_code,minimum_version_code FROM android_releases WHERE active FOR UPDATE",
        )
      ).rows[0];
      if (
        old &&
        (b.versionCode <= old.version_code ||
          b.minimumVersionCode < old.minimum_version_code)
      )
        throw new BadRequestException("Release codes cannot move backwards");
      await tx.query("UPDATE android_releases SET active=false WHERE active");
      await tx.query(
        "INSERT INTO android_releases(version_code,version_name,minimum_version_code,apk_url,download_url,sha256,certificate_sha256,size_bytes,release_notes,mandatory,attestation,active,published_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12)",
        [
          b.versionCode,
          b.versionName,
          b.minimumVersionCode,
          b.apkUrl,
          b.downloadUrl,
          b.sha256,
          b.certificateSha256,
          b.sizeBytes,
          b.releaseNotes,
          b.mandatory,
          b.signature,
          admin,
        ],
      );
      await tx.query(
        "INSERT INTO audit_logs(actor_type,actor_id,action,entity_type,entity_id,request_id,sanitized_changes) VALUES('admin',$1,'android.publish','android',$2,gen_random_uuid(),$3)",
        [
          admin,
          String(b.versionCode),
          JSON.stringify({
            sha256: b.sha256,
            minimumVersionCode: b.minimumVersionCode,
          }),
        ],
      );
      return { published: true, versionCode: b.versionCode };
    });
  }
}
