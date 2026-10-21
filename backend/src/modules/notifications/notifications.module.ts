import {
  Module,
  Global,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Req,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from "@nestjs/common";
import { AuthRequest } from "../../common/auth.guard";
import {
  NotificationService,
  DeviceDto,
  PreferencesDto,
} from "./notification.service";
import {
  PushNotificationProvider,
  EmailProvider,
  SmsProvider,
  DisabledDeliveryProvider,
  MockPushProvider,
  MockEmailProvider,
  MockSmsProvider,
} from "./delivery.providers";
@Controller("notifications")
class NotificationsController {
  constructor(private readonly service: NotificationService) {}
  @Get() list(
    @Req() r: AuthRequest,
    @Query("page") p = "1",
    @Query("limit") l = "20",
  ) {
    return this.service.list(r.user.userId, Number(p), Number(l));
  }
  @Post("read-all") all(@Req() r: AuthRequest) {
    return this.service.read(r.user.userId);
  }
  @Patch(":id/read") read(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.read(r.user.userId, id);
  }
  @Delete(":id") archive(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.archive(r.user.userId, id);
  }
  @Get("preferences") prefs(@Req() r: AuthRequest) {
    return this.service.preferences(r.user.userId);
  }
  @Patch("preferences") save(@Req() r: AuthRequest, @Body() d: PreferencesDto) {
    return this.service.preferences(r.user.userId, d);
  }
  @Post("devices") device(@Req() r: AuthRequest, @Body() d: DeviceDto) {
    return this.service.device(r.user, d);
  }
  @Delete("devices/:id") remove(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(r.user.userId, id);
  }
  @Get("announcements") announcements(@Req() r: AuthRequest) {
    return this.service.announcements(r.user.userId);
  }
}
@Global()
@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationService,
    { provide: PushNotificationProvider, useFactory: () => process.env.NODE_ENV === "production" ? new DisabledDeliveryProvider() : new MockPushProvider() },
    { provide: EmailProvider, useFactory: () => process.env.NODE_ENV === "production" ? new DisabledDeliveryProvider() : new MockEmailProvider() },
    { provide: SmsProvider, useFactory: () => process.env.NODE_ENV === "production" ? new DisabledDeliveryProvider() : new MockSmsProvider() },
  ],
  exports: [NotificationService],
})
export class NotificationsModule {}
