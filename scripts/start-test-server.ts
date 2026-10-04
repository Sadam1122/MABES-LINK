import "./load-env";

import { spawn } from "node:child_process";
import { resolve } from "node:path";

const databaseName = process.env.TEST_DATABASE_NAME ?? "mabeslink_test";
if (!databaseName.toLowerCase().includes("test")) throw new Error("TEST_DATABASE_NAME wajib mengandung 'test'.");
const port = process.env.TEST_SERVER_PORT ?? "3100";
const url = `http://localhost:${port}`;
const child = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "start", "-p", port], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "production", DATABASE_PURPOSE: "testing", TEST_DATABASE_NAME: databaseName, APP_URL: url, BETTER_AUTH_URL: url },
});

for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => { process.exitCode = code ?? 1; });
