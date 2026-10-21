import { OperationsService, SystemController } from './operations.service';
import { StartupService } from './startup.service';
import {ObservabilityService} from './observability.service';
import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { DatabaseService } from "./database.service";
import { CryptoService } from "./crypto.service";
import { SecurityService } from "./security.service";
import { AuthGuard } from "./auth.guard";
@Global()
@Module({
  controllers: [SystemController],
  providers: [
    OperationsService,
    DatabaseService,
    StartupService,
    ObservabilityService,
    CryptoService,
    SecurityService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [OperationsService,ObservabilityService, DatabaseService, CryptoService, SecurityService],
})
export class CoreModule {}
