import {
  Controller,
  Get,
  Post,
  Req,
  Param,
  ParseUUIDPipe,
  Module,
  Headers,
  RawBodyRequest,
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { DatabaseService } from "../../common/database.service";
import { Request } from "express";
import { AuthRequest, Public } from "../../common/auth.guard";
import { OrdersModule } from "../orders/orders.module";
import { LedgerModule } from "../ledger/ledger.module";
import {
  PayoutProvider,
  MockPayoutProvider,
  ManualPayoutProvider,
  payoutConfig,
} from "./payout.provider";
import { PayoutsService } from "./payouts.service";
@Controller("payouts")
class PayoutsController {
  constructor(private readonly payouts: PayoutsService) {}
  @Get(":id") get(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.payouts.view(id, r.user.userId);
  }
}
@Public()
@Controller("webhooks/payout")
class PayoutWebhookController {
  constructor(private readonly payouts: PayoutsService) {}
  @Post(":provider") webhook(
    @Req() r: RawBodyRequest<Request>,
    @Param("provider") provider: string,
    @Headers("x-payout-timestamp") timestamp: string,
    @Headers("x-payout-signature") signature: string,
  ) {
    if (!r.rawBody || r.rawBody.length > 65536) throw new BadRequestException();
    return this.payouts.webhook(
      provider,
      r.rawBody,
      timestamp ?? "",
      signature ?? "",
    );
  }
}
@Module({
  imports: [OrdersModule, LedgerModule],
  controllers: [PayoutsController, PayoutWebhookController],
  providers: [
    PayoutsService,
    {
      provide: PayoutProvider,
      useFactory: (db: DatabaseService) => {
        if(process.env.MANUAL_PAYOUT === "true") return new ManualPayoutProvider();
        const config = payoutConfig();
        // Register reviewed vendor adapters here. Business services depend only on the port.
        const adapters: Record<string, () => PayoutProvider> = {
          mock: () => new MockPayoutProvider(db),
        };
        const factory = adapters[config.provider];
        if (!factory)
          throw new ServiceUnavailableException(
            "Configured payout adapter unavailable",
          );
        const provider = factory();
        if (
          config.enabled &&
          process.env.NODE_ENV === "production" &&
          provider.sandbox
        )
          throw new ServiceUnavailableException(
            "Sandbox payout provider forbidden in production",
          );
        return provider;
      },
      inject: [DatabaseService],
    },
  ],
  exports: [PayoutsService, PayoutProvider],
})
export class PayoutsModule {}
