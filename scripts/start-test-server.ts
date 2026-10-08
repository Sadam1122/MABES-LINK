import "./load-env";

import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { resolveDatabaseUrl } from "../lib/database-url";

const databaseName = process.env.TEST_DATABASE_NAME ?? "mabeslink_test";
if (!databaseName.toLowerCase().includes("test"))
  throw new Error("TEST_DATABASE_NAME wajib mengandung 'test'.");
const port = process.env.TEST_SERVER_PORT ?? "3100";
const url = `http://localhost:${port}`;
const testDatabaseUrl = resolveDatabaseUrl({
  ...process.env,
  DATABASE_PURPOSE: "testing",
  TEST_DATABASE_NAME: databaseName,
});
// @next/env marks a loaded snapshot in the parent. Do not let that marker stop
// Next from loading its own runtime environment in the child process.
const childEnvironment = { ...process.env };
delete childEnvironment.__NEXT_PROCESSED_ENV;
console.log(`Server uji: ${databaseName}, SMTP nonaktif, port ${port}.`);
const child = spawn(
  process.execPath,
  [
    resolve("node_modules/next/dist/bin/next"),
    "start",
    "--hostname",
    "127.0.0.1",
    "-p",
    port,
  ],
  {
    cwd: process.cwd(),
    stdio: "inherit",
    env: {
      ...childEnvironment,
      NODE_ENV: "production",
      DATABASE_URL: testDatabaseUrl,
      DATABASE_PURPOSE: "testing",
      TEST_DATABASE_NAME: databaseName,
      APP_URL: url,
      BETTER_AUTH_URL: url,
      EMAIL_ENABLED: "false",
      SMTP_DRY_RUN: "true",
      PRIVATE_STORAGE_PATH: resolve(".data/audit-test-private"),
    },
  },
);

for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
