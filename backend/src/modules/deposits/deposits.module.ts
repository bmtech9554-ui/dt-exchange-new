import { Module } from "@nestjs/common";
import { ChainProviderModule } from "../blockchain/provider.module";
import { LedgerModule } from "../ledger/ledger.module";
import { OrdersModule } from "../orders/orders.module";
import { DepositsService } from "./deposits.service";
@Module({
  imports: [ChainProviderModule, LedgerModule, OrdersModule],
  providers: [DepositsService],
  exports: [DepositsService],
})
export class DepositsModule {}
