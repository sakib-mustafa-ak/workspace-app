import { Global, Module } from "@nestjs/common";
import { db } from "@repo/database";
//import { constructor } from "zod/v4/locales/yo.cjs";

@Global()
@Module({
  providers: [
    {
      provide: "DATABASE",
      useValue: db,
    },
  ],
  exports: ["DATABASE"],
})
export class DatabaseModule {}


// constructor(
//   @Inject("DATABASE")
//   private readonly db: typeof db,
// ) {}