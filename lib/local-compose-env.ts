/** Derive container connectivity only from an existing valid local DSN. Never log it. */
export function localComposeEnvironment(
  env: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  if (!env.DATABASE_URL)
    throw new Error("Isi DATABASE_URL lokal terlebih dahulu.");
  const url = new URL(env.DATABASE_URL);
  if (
    !["postgresql:", "postgres:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.port !== "5434"
  ) {
    throw new Error(
      "Compose lokal hanya untuk PostgreSQL loopback port 5434. Gunakan panduan deployment terpisah untuk server lain.",
    );
  }
  const user = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  const database = url.pathname.slice(1);
  if (!user || !password || !/^[a-zA-Z0-9_-]+$/.test(database))
    throw new Error(
      "DATABASE_URL wajib memuat user, password, dan nama database valid.",
    );
  for (const [key, actual] of [
    ["POSTGRES_USER", user],
    ["POSTGRES_PASSWORD", password],
    ["POSTGRES_DB", database],
  ]) {
    if (env[key] && env[key] !== actual)
      throw new Error(
        `${key} berbeda dari DATABASE_URL. Cocokkan konfigurasi, jangan mengubah kredensial existing.`,
      );
  }
  url.hostname = "postgres";
  url.port = "5432";
  return {
    ...env,
    POSTGRES_USER: user,
    POSTGRES_PASSWORD: password,
    POSTGRES_DB: database,
    DATABASE_URL_DOCKER: url.toString(),
  };
}
