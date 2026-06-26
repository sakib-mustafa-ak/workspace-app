import { ValidationPipe, VersioningType } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  const configService = app.get(ConfigService);

  app.enableCors();

  app.setGlobalPrefix("api");

  app.enableVersioning({
    type: VersioningType.URI,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = configService.get<number>("port") ?? 4000;

  await app.listen(port);

  console.log(`🚀 API running at http://localhost:${port}/api/v1`);
}

bootstrap();