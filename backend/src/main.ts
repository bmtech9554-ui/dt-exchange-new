import { ObservabilityService } from "./common/observability.service";
import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { ConsoleLogger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { json, urlencoded } from "express";
import type { Request, Response, NextFunction } from "express";
import { AppModule } from "./app.module";
import { environment } from "./config/environment";
import { HttpErrorFilter } from "./common/http-exception.filter";
import { securityObservation } from "./common/security-observation";
export async function createApp(rootModule = AppModule) {
  const app = await NestFactory.create(rootModule, {
    rawBody: true,
    bodyParser: false,
    logger: new ConsoleLogger({ json: true }),
  });
  const trustedProxy = process.env.TRUST_PROXY_CIDR;
  if (trustedProxy) {
    if (!/^\d{1,3}(\.\d{1,3}){3}\/(\d|[12]\d|3[0-2])$/.test(trustedProxy))
      throw new Error("INVALID_TRUSTED_PROXY_CIDR");
    app.getHttpAdapter().getInstance().set("trust proxy", trustedProxy);
  }
  app.use(helmet());
  app.enableCors({
    origin: environment.CORS_ORIGINS.split(",").map((s) => s.trim()),
    credentials: false,
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    const started = Date.now();
    res.setHeader("x-request-id", requestId);
    res.on("finish", () => {
      const security = securityObservation(req.path, res.statusCode);
      if (security) console.log(JSON.stringify({ ...security, requestId }));
      void app
        .get(ObservabilityService)
        .observe("api_latency_ms", Date.now() - started, {
          result: res.statusCode >= 400 ? "error" : "ok",
        });
      console.log(
        JSON.stringify({
          event: "http_request",
          requestId,
          method: req.method,
          status: res.statusCode,
          duration: Date.now() - started,
        }),
      );
    });
    next();
  });
  app.use(
    json({
      limit: "64kb",
      verify: (req, _res, body) => {
        (req as any).rawBody = body;
      },
    }),
  );
  app.use(urlencoded({ extended: false, limit: "16kb" }));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: false,
    }),
  );
  app.useGlobalFilters(new HttpErrorFilter());
  app.setGlobalPrefix("api/v1", {
    exclude: ["health", "health/live", "health/ready"],
  });
  app.enableShutdownHooks();
  return app;
}
if (require.main === module)
  void createApp().then((app) =>
    app.listen(environment.PORT, environment.HOST),
  );
