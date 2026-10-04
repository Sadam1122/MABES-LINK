import { describe, expect, it } from "vitest";
import { resolveDatabaseUrl } from "../lib/database-url";

describe("database testing terpisah", () => {
  it("mempertahankan koneksi operasional tanpa flag testing", () => {
    const source = "postgresql://user:pass@localhost:5432/mabeslink?schema=public";
    expect(resolveDatabaseUrl({ DATABASE_URL: source, DATABASE_PURPOSE: "operational" })).toBe(source);
  });

  it("mengganti hanya nama database saat testing eksplisit", () => {
    const value = resolveDatabaseUrl({ DATABASE_URL: "postgresql://user:pass@localhost:5432/mabeslink?schema=public", DATABASE_PURPOSE: "testing", TEST_DATABASE_NAME: "mabeslink_test" });
    expect(new URL(value).pathname).toBe("/mabeslink_test");
  });
});
