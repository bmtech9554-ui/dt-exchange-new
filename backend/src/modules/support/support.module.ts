import {
  Module,
  Controller,
  Get,
  Post,
  Req,
  Body,
  Param,
  Query,
  Headers,
  ParseUUIDPipe,
} from "@nestjs/common";
import { AuthRequest, Public } from "../../common/auth.guard";
import {
  SupportService,
  TicketDto,
  ReplyDto,
  AttachmentDto,
  SupportStorageProvider,
  MockSupportStorage,
} from "./support.service";
@Controller("support")
class SupportController {
  constructor(private readonly s: SupportService) {}
  @Get("tickets") list(@Req() r: AuthRequest, @Query("page") p = "1") {
    return this.s.list(r.user.userId, Number(p));
  }
  @Post("tickets") create(
    @Req() r: AuthRequest,
    @Body() d: TicketDto,
    @Headers("idempotency-key") k?: string,
  ) {
    return this.s.create(r.user.userId, d, k);
  }
  @Get("tickets/:id") detail(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.s.detail(id, r.user.userId);
  }
  @Post("tickets/:id/replies") reply(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: ReplyDto,
    @Headers("idempotency-key") k?: string,
  ) {
    return this.s.reply(r.user.userId, id, d, k);
  }
  @Post("tickets/:id/close") close(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.s.close(r.user.userId, id);
  }
  @Post("tickets/:id/attachments") attachment(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: AttachmentDto,
  ) {
    return this.s.attachment(r.user.userId, id, d);
  }
  @Get("attachments/:id") file(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.s.file(r.user.userId, id);
  }
  @Public() @Get("faq") faq() {
    return this.s.faqs();
  }
}
@Module({
  controllers: [SupportController],
  providers: [
    SupportService,
    { provide: SupportStorageProvider, useClass: MockSupportStorage },
  ],
  exports: [SupportService],
})
export class SupportModule {}
