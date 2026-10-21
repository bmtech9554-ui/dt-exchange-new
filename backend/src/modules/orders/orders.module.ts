import {NotificationsModule} from '../notifications/notifications.module';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from "@nestjs/common";
import { HistoryController } from "./history.controller";
import { AuthRequest } from "../../common/auth.guard";
import { RatesModule } from "../rates/rates.module";
import { LimitsService } from "./limits.service";
import { QuotesService, QuoteDto } from "./quotes.service";
import { WalletsModule } from "../wallets/wallets.module";
import { LedgerModule } from "../ledger/ledger.module";
import { OrderTransitionService } from "./order-transition.service";
import { OrdersService, CreateOrderDto } from "./orders.service";
@Controller("sell/orders")
class OrdersController {
  constructor(private readonly service: OrdersService) {}
  @Post() create(
    @Req() r: AuthRequest,
    @Body() dto: CreateOrderDto,
    @Headers("idempotency-key") key?: string,
  ) {
    return this.service.create(r.user.userId, dto, key);
  }
  @Get(":id") get(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.get(r.user.userId, id);
  }
}
@Controller("sell")
class QuotesController {
  constructor(private readonly service: QuotesService) {}
  @Post("quote") create(
    @Req() r: AuthRequest,
    @Body() dto: QuoteDto,
    @Headers("idempotency-key") key?: string,
  ) {
    return this.service.create(r.user.userId, dto, key);
  }
  @Get("quote/:id") get(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.get(r.user.userId, id);
  }
  @Delete("quote/:id") cancel(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.cancel(r.user.userId, id);
  }
}
@Module({
  imports: [RatesModule, WalletsModule, LedgerModule, NotificationsModule],
  controllers: [QuotesController, OrdersController, HistoryController],
  providers: [
    QuotesService,
    LimitsService,
    OrdersService,
    OrderTransitionService,
  ],
  exports: [OrdersService, OrderTransitionService],
})
export class OrdersModule {}
