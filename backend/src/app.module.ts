import { OwnerModule } from './modules/owner/owner.module';
import { ManualModule } from './modules/manual/manual.module';
import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller";
import { CoreModule } from "./common/core.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { VerificationModule } from "./modules/verification/verification.module";
import { BanksModule } from "./modules/banks/banks.module";
import { RatesModule } from "./modules/rates/rates.module";
import { WalletsModule } from "./modules/wallets/wallets.module";
import { BlockchainModule } from "./modules/blockchain/blockchain.module";
import { DepositsModule } from "./modules/deposits/deposits.module";
import { LedgerModule } from "./modules/ledger/ledger.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PayoutsModule } from "./modules/payouts/payouts.module";
import { ReferralsModule } from "./modules/referrals/referrals.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { SupportModule } from "./modules/support/support.module";
import { AdminModule } from "./modules/admin/admin.module";
import { AuditModule } from "./modules/audit/audit.module";
@Module({
  imports: [
    CoreModule,
    OwnerModule,
    ManualModule,
    AuthModule,
    UsersModule,
    VerificationModule,
    BanksModule,
    RatesModule,
    WalletsModule,
    BlockchainModule,
    DepositsModule,
    LedgerModule,
    OrdersModule,
    PayoutsModule,
    ReferralsModule,
    NotificationsModule,
    SupportModule,
    AdminModule,
    AuditModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
