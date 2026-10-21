import { Controller, Get, Module } from "@nestjs/common";
import { RateProvider, MockRateProvider } from "./rate.provider";
import { RatesService } from "./rates.service";
@Controller("rates")
class RatesController {
  constructor(private readonly service: RatesService) {}
  @Get("usdt-inr") async rate() {
    const rate = await this.service.current();
    // Public policy data only: never log request headers, identity or session data.
    console.info(JSON.stringify({event:'authenticated_rate_response',httpStatus:200,response:{exchangeRate:rate.exchangeRate,source:rate.source,timestamp:rate.timestamp,validUntil:rate.validUntil,sandbox:rate.sandbox,quotesConfigured:rate.quotesConfigured}}));
    return rate;
  }
}
@Module({
  controllers: [RatesController],
  providers: [
    RatesService,
    { provide: RateProvider, useClass: MockRateProvider },
  ],
  exports: [RatesService],
})
export class RatesModule {}
