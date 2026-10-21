import { Controller, Get, Module, Post, Req } from "@nestjs/common";
import { AuthRequest } from "../../common/auth.guard";
import { ChainProviderModule } from "../blockchain/provider.module";
import {
  AddressCustodyProvider,
  ConfiguredCustodyProvider,
} from "./custody.provider";
import { WalletsService } from "./wallets.service";
@Controller("wallet")
class WalletController {
  constructor(private readonly service: WalletsService) {}
  @Get() balance(@Req() r: AuthRequest) {
    return this.service.balance(r.user.userId);
  }
  @Post("deposit-address") address(@Req() r: AuthRequest) {
    return this.service.address(r.user.userId);
  }
}
@Module({
  imports: [ChainProviderModule],
  controllers: [WalletController],
  providers: [
    WalletsService,
    { provide: AddressCustodyProvider, useClass: ConfiguredCustodyProvider },
  ],
  exports: [WalletsService],
})
export class WalletsModule {}
