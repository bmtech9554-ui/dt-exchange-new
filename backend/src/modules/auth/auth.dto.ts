import { Transform } from "class-transformer";
import { normalizeIndiaMobile } from "./india-mobile";
import {
  Equals,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
export class RegisterDto {
  @IsString() @Length(2, 100) @Matches(/^[^\x00-\x1f<>]+$/) fullName!: string;
  @IsEmail() @MaxLength(254) email!: string;
  @Transform(({ value }) => typeof value === "string" ? normalizeIndiaMobile(value) : value)
  @Matches(/^\+[1-9][0-9]{7,14}$/) mobile!: string;
  @IsString() @Length(12, 128) password!: string;
  @Equals(true) termsAccepted!: boolean;
  @IsOptional() @Matches(/^DT[A-Z0-9]{8,32}$/) referralCode?: string;
}
export class LoginDto {
  @IsString() @Length(5, 254) contact!: string;
  @IsString() @Length(1, 128) password!: string;
  @IsString() @Length(8, 128) deviceId!: string;
  @IsOptional()
  @IsString()
  @Length(1, 80)
  @Matches(/^[^\x00-\x1f<>]+$/)
  deviceLabel?: string;
}
export class RequestOtpDto {
  @IsString() @Length(5, 254) contact!: string;
  @IsIn(["login", "register", "reset"]) purpose!: string;
}
export class VerifyOtpDto {
  @IsUUID() challengeId!: string;
  @Matches(/^[0-9]{6}$/) code!: string;
  @IsString() @Length(8, 128) deviceId!: string;
  @IsOptional()
  @IsString()
  @Length(1, 80)
  @Matches(/^[^\x00-\x1f<>]+$/)
  deviceLabel?: string;
}
export class RefreshDto {
  @IsString() @Length(40, 100) refreshToken!: string;
}
export class ForgotDto {
  @IsString() @Length(5, 254) contact!: string;
}
export class ResetDto {
  @IsString() @Length(40, 100) resetToken!: string;
  @IsString() @Length(12, 128) password!: string;
}
export class ChangePasswordDto {
  @IsString() @Length(1, 128) currentPassword!: string;
  @IsString() @Length(12, 128) password!: string;
}
