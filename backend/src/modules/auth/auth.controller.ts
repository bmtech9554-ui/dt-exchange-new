import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from "@nestjs/common";
import { AuthRequest, Public } from "../../common/auth.guard";
import { SecurityService } from "../../common/security.service";
import { AuthService } from "./auth.service";
import {
  RegisterDto,
  LoginDto,
  RequestOtpDto,
  VerifyOtpDto,
  RefreshDto,
  ForgotDto,
  ResetDto,
  ChangePasswordDto,
} from "./auth.dto";
@Controller("auth")
export class AuthController {
  constructor(
    private readonly service: AuthService,
    private readonly security: SecurityService,
  ) {}
  @Public() @Post("register") register(
    @Body() dto: RegisterDto,
    @Req() r: AuthRequest,
  ) {
    return this.service.register(dto, r.ip ?? "unknown");
  }
  @Public() @Post("login") login(@Body() dto: LoginDto, @Req() r: AuthRequest) {
    return this.service.login(dto, r.ip ?? "unknown");
  }
  @Public() @Post("request-otp") request(
    @Body() dto: RequestOtpDto,
    @Req() r: AuthRequest,
  ) {
    return this.service.requestOtp(dto.contact, dto.purpose, r.ip ?? "unknown");
  }
  @Public() @Post("verify-otp") verify(
    @Body() dto: VerifyOtpDto,
    @Req() r: AuthRequest,
  ) {
    return this.service.verifyOtp(dto, r.ip ?? "unknown");
  }
  @Public() @Post("refresh") refresh(
    @Body() dto: RefreshDto,
    @Req() r: AuthRequest,
  ) {
    return this.service.refresh(dto.refreshToken, r.ip ?? "unknown");
  }
  @Public() @Post("forgot-password") forgot(
    @Body() dto: ForgotDto,
    @Req() r: AuthRequest,
  ) {
    return this.service.requestOtp(dto.contact, "reset", r.ip ?? "unknown");
  }
  @Public() @Post("reset-password") async reset(
    @Body() dto: ResetDto,
    @Req() r: AuthRequest,
  ) {
    await this.security.limit("reset:" + r.ip, 5, 900);
    return this.service.reset(dto.resetToken, dto.password);
  }
  @Post("contact/request-otp") contactOtp(
    @Body() dto: ForgotDto,
    @Req() r: AuthRequest,
  ) {
    return this.service.requestOtp(
      dto.contact,
      "contact",
      r.ip ?? "unknown",
      r.user.userId,
    );
  }
  @Post("contact/verify-otp") contactVerify(
    @Body() dto: VerifyOtpDto,
    @Req() r: AuthRequest,
  ) {
    return this.service.verifyOtp(dto, r.ip ?? "unknown", r.user.userId);
  }
  @Post("change-password") change(
    @Body() dto: ChangePasswordDto,
    @Req() r: AuthRequest,
  ) {
    return this.service.changePassword(
      r.user,
      dto.currentPassword,
      dto.password,
    );
  }
  @Post("logout") logout(@Req() r: AuthRequest) {
    return this.service.logout(r.user, "current");
  }
  @Post("logout-all") all(@Req() r: AuthRequest) {
    return this.service.logout(r.user, "all");
  }
}
@Controller("sessions")
export class SessionsController {
  constructor(private readonly service: AuthService) {}
  @Get() list(@Req() r: AuthRequest) {
    return this.service.sessions(r.user);
  }
  @Delete(":id") remove(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() r: AuthRequest,
  ) {
    return this.service.logout(r.user, "current", id);
  }
  @Post("logout-others") others(@Req() r: AuthRequest) {
    return this.service.logout(r.user, "others");
  }
}
