import "./scripts/load-env";
import { defineConfig } from "prisma/config";
import { resolveDatabaseUrl } from "./lib/database-url";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: resolveDatabaseUrl(),
  },
});
