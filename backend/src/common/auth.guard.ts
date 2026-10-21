import { syntheticBuildWrite } from './synthetic-validation';
import { privateBetaEnabled, privateBetaWriteAllowed, requirePrivateBetaAccount } from './private-beta';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  ForbiddenException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { DatabaseService } from "./database.service";
import { CryptoService } from "./crypto.service";
import { SecurityService } from "./security.service";
export const Public = () => SetMetadata("public", true);
export interface Principal {
  userId: string;
  sessionId: string;
  familyId: string;
}
export interface AuthRequest {
  user: Principal;
  ip?: string;
  headers: Record<string, string | undefined>;
}
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: DatabaseService,
    private readonly crypto: CryptoService,
    private readonly security: SecurityService,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    if (req.path === "/health" || req.path.startsWith("/health/")) return true;
    await this.security.limit("http:" + req.ip, 300, 60);
    if (
      this.reflector.getAllAndOverride("public", [
        ctx.getHandler(),
        ctx.getClass(),
      ])
    )
      return true;
    const maintenance = (await this.db.query("SELECT value FROM system_settings WHERE key='owner_maintenance'")).rows[0]?.value;
    if (maintenance?.api === true && (!maintenance.scheduledAt || Date.parse(maintenance.scheduledAt) <= Date.now()))
      throw new ServiceUnavailableException('DT Exchange is temporarily under maintenance. Please try again shortly.');
    let payload;
    try {
      const auth = req.headers.authorization;
      if (!auth?.startsWith("Bearer ")) throw new Error();
      payload = this.crypto.verifyAccess(auth.slice(7));
    } catch {
      throw new UnauthorizedException();
    }
    const row = (
      await this.db.query(
        "SELECT s.family_id,u.status FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=$1 AND s.user_id=$2 AND s.revoked_at IS NULL AND s.expires_at>now()",
        [payload.sessionId, payload.userId],
      )
    ).rows[0];
    if (!row) throw new UnauthorizedException();
    // Existing sessions are still subject to the temporary account/build boundary.
    // Logout remains available after the window closes so sessions can be revoked.
    if (privateBetaEnabled() && !['/api/v1/auth/logout', '/api/v1/auth/logout-all'].includes(req.path)) {
      await requirePrivateBetaAccount(this.db, payload.userId, String(req.headers['x-dt-version-code'] ?? ''));
      if (!privateBetaWriteAllowed(req.method, req.path)) throw new ServiceUnavailableException();
    }
    if (
      row.status !== "active" &&
      !(
        ["frozen", "suspended"].includes(row.status) &&
        [
          "/api/v1/users/me",
          "/api/v1/auth/logout",
          "/api/v1/auth/logout-all",
        ].includes(req.path)
      )
    )
      throw new ForbiddenException("Account unavailable");
    await this.db.query("UPDATE sessions SET last_seen_at=now() WHERE id=$1 AND last_seen_at<now()-interval '1 minute'",[payload.sessionId]);
    if(process.env.ANDROID_UPDATE_ENFORCED==='true' && !['GET','HEAD'].includes(req.method) && /^\/api\/v1\/(sell|manual\/deposits|wallet)/.test(req.path)){
      const release=(await this.db.query('SELECT minimum_version_code,version_code,mandatory FROM android_releases WHERE active')).rows[0];
      const code=req.headers['x-dt-version-code'];
      if((!release||(!/^\d{1,10}$/.test(code??'')||Number(code)<(release.mandatory?release.version_code:release.minimum_version_code))) && !(await syntheticBuildWrite(this.db,payload.userId,req.method,req.path,code)))throw new ForbiddenException('Update Required');
    }
    req.user = { ...payload, familyId: row.family_id };
    return true;
  }
}
