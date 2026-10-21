import { Injectable, OnModuleInit } from "@nestjs/common";
import { assertProduction } from "../config/production";
@Injectable()
export class StartupService implements OnModuleInit {
  onModuleInit() {
    assertProduction();
  }
}
