import { Controller, Get, Module, Req, Post, Patch, Body, Param } from "@nestjs/common";
import { SettingsService, PinDto, DeleteDto, AppPreferencesDto } from "./settings.service";
import { AuthRequest,Public } from "../../common/auth.guard";
import { DatabaseService } from "../../common/database.service";
import { CryptoService } from "../../common/crypto.service";
@Controller("users")
class UsersController {
  constructor(
    private readonly db: DatabaseService,
    private readonly crypto: CryptoService,
  ) {}
  @Get("me") async me(@Req() r: AuthRequest) {
    const u = (
      await this.db.query(
        "SELECT u.*,p.full_name_ciphertext FROM users u JOIN user_profiles p ON p.user_id=u.id WHERE u.id=$1",
        [r.user.userId],
      )
    ).rows[0]!;
    return {
      id: u.id,
      publicUserId: String(u.public_user_id),
      fullName: this.crypto.decrypt(u.full_name_ciphertext, u.id + ":name"),
      email: u.email_ciphertext
        ? this.crypto.decrypt(u.email_ciphertext, u.id + ":email")
        : null,
      mobile: u.mobile_ciphertext
        ? this.crypto.decrypt(u.mobile_ciphertext, u.id + ":mobile")
        : null,
      accountStatus:
        u.status === "closed" ? "DISABLED" : u.status.toUpperCase(),
      verificationStatus: u.verification_status.toUpperCase(),
      verificationBadge:
        u.verification_status === "verified"
          ? "Verified"
          : "Verification Required",
      createdAt: u.created_at,
      emailVerified: !!u.email_verified_at,
      mobileVerified: !!u.mobile_verified_at,
    };
  }
}
@Controller('settings') class SettingsController {
 constructor(private readonly s:SettingsService){}
 @Get() get(@Req() r:AuthRequest){return this.s.get(r.user.userId);}
 @Patch('preferences') prefs(@Req() r:AuthRequest,@Body() d:AppPreferencesDto){return this.s.preferences(r.user.userId,d);}
 @Post('pin') pin(@Req() r:AuthRequest,@Body() d:PinDto){return this.s.setPin(r.user.userId,d);}
 @Post('pin/verify') check(@Req() r:AuthRequest,@Body() d:PinDto){return this.s.verifyPin(r.user.userId,d.pin);}
 @Post('delete-account') remove(@Req() r:AuthRequest,@Body() d:DeleteDto){return this.s.deletion(r.user.userId,d);}
 @Public() @Get('legal/:kind') legal(@Param('kind') k:string){return this.s.legal(k);}
}
@Module({ controllers: [UsersController,SettingsController],providers:[SettingsService] })
export class UsersModule {}
