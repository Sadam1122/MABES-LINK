import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Never inherit the operational database or an enabled SMTP transport.
    env: {
      DATABASE_PURPOSE: "testing",
      TEST_DATABASE_NAME: process.env.TEST_DATABASE_NAME ?? "mabeslink_test",
      EMAIL_ENABLED: "false",
      SMTP_DRY_RUN: "true",
    },
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/server-only.ts", import.meta.url),
      ),
    },
  },
});
