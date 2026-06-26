import { LoggerModule } from "nestjs-pino";

export const AppLoggerModule = LoggerModule.forRoot({
  pinoHttp: {
    transport: {
      target: "pino-pretty",
    },
  },
});