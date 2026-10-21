import { Injectable, ServiceUnavailableException } from "@nestjs/common";
export interface MarketRate {
  rate: string;
  source: string;
  observedAt: Date;
  sandbox: boolean;
}
export abstract class RateProvider {
  abstract fetch(): Promise<MarketRate>;
}
@Injectable()
export class MockRateProvider extends RateProvider {
  async fetch() {
    if (
      process.env.NODE_ENV === "production" ||
      process.env.RATE_PROVIDER !== "mock"
    )
      throw new ServiceUnavailableException(
        "Market rate provider not configured",
      );
    return {
      rate: process.env.MOCK_USDT_INR_RATE ?? "92.45000000",
      source: "development_mock",
      observedAt: new Date(),
      sandbox: true,
    };
  }
}
