import { Module } from "@nestjs/common";
import { ChainProviderModule } from "./provider.module";
import { DepositsModule } from "../deposits/deposits.module";
import { ScanService } from "./scan.service";
@Module({
  imports: [ChainProviderModule, DepositsModule],
  providers: [ScanService],
  exports: [ScanService],
})
export class BlockchainModule {}
