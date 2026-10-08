import { describe, expect, it } from "vitest";
import { localComposeEnvironment } from "../lib/local-compose-env";

describe("konfigurasi Compose lokal tanpa menebak secret", () => {
  it("menurunkan nilai dari DSN yang valid dan mempertahankan password ter-encode", () => {
    const result = localComposeEnvironment({
      NODE_ENV: "test",
      DATABASE_URL:
        "postgresql://local:p%40ss@localhost:5434/mabeslink?schema=public",
    });
    expect(result.POSTGRES_PASSWORD).toBe("p@ss");
    expect(result.POSTGRES_DB).toBe("mabeslink");
    expect(new URL(result.DATABASE_URL_DOCKER!).hostname).toBe("postgres");
    expect(new URL(result.DATABASE_URL_DOCKER!).password).toBe("p%40ss");
  });
  it("menolak host eksternal dan kredensial yang tidak cocok", () => {
    expect(() =>
      localComposeEnvironment({
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://u:p@remote.internal:5434/db",
      }),
    ).toThrow(/loopback/);
    expect(() =>
      localComposeEnvironment({
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://u:p@localhost:5434/db",
        POSTGRES_PASSWORD: "different",
      }),
    ).toThrow(/berbeda/);
  });
});
