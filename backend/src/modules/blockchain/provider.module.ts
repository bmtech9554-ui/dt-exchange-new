import { DisabledTronProvider, dormantManualChain } from "./disabled-tron.provider";
import { Module } from "@nestjs/common";
import { TronBlockchainProvider } from "./tron.provider";
import { MockTronProvider } from "./providers/mock-tron.provider";
import { TronHttpProvider } from "./providers/tron-http.provider";
import { chainConfig } from "./chain.config";
@Module({
  providers: [
    MockTronProvider,
    TronHttpProvider,
    {
      provide: TronBlockchainProvider,
      inject: [MockTronProvider, TronHttpProvider],
      useFactory: (mock: MockTronProvider, http: TronHttpProvider) =>
        dormantManualChain() ? new DisabledTronProvider() : chainConfig().sandbox ? mock : http,
    },
  ],
  exports: [TronBlockchainProvider],
})
export class ChainProviderModule {}
