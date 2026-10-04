export function resolveDatabaseUrl(env: Record<string, string | undefined> = process.env) {
  const source = env.DATABASE_URL;
  if (!source) throw new Error("DATABASE_URL belum dikonfigurasi.");
  if (env.DATABASE_PURPOSE !== "testing" || !env.TEST_DATABASE_NAME) return source;
  if (!/^[a-zA-Z0-9_-]*test[a-zA-Z0-9_-]*$/i.test(env.TEST_DATABASE_NAME)) {
    throw new Error("TEST_DATABASE_NAME wajib berupa nama database yang mengandung 'test'.");
  }
  const url = new URL(source);
  url.pathname = `/${env.TEST_DATABASE_NAME}`;
  return url.toString();
}
