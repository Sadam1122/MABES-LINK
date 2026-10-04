export function assertRoleSeedEnvironment(env: NodeJS.ProcessEnv) {
  const required: string[] = [];
  if (!env.DATABASE_URL) required.push("DATABASE_URL");
  if (env.DATABASE_PURPOSE !== "testing") required.push("DATABASE_PURPOSE=testing");
  if (env.ROLE_SEED_ENABLED !== "true") required.push("ROLE_SEED_ENABLED=true");
  if (env.ROLE_SEED_CONFIRM !== "MABESLINK_TEST_ONLY") required.push("ROLE_SEED_CONFIRM=MABESLINK_TEST_ONLY");
  if (env.NODE_ENV === "production") required.push("NODE_ENV bukan production");
  if (required.length) throw new Error(`Seeder role ditolak. Konfigurasi wajib: ${required.join(", ")}.`);
  let databaseName = "";
  try { databaseName = new URL(env.DATABASE_URL!).pathname.toLowerCase(); }
  catch { throw new Error("Seeder role ditolak: DATABASE_URL tidak valid."); }
  if (!databaseName.includes("test")) throw new Error("Seeder role ditolak: nama database pada DATABASE_URL wajib mengandung 'test'.");
}
