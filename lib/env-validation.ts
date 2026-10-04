export function requireEnvironment(names: readonly string[]) {
  const missing = names.filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    throw new Error(`Konfigurasi belum lengkap: ${missing.join(", ")}.`);
  }
}

export function validateWorkerEnvironment() {
  requireEnvironment(["DATABASE_URL"]);
  const interval = Number(process.env.WORKER_POLL_INTERVAL_MS ?? "60000");
  if (!Number.isInteger(interval) || interval < 5_000) throw new Error("WORKER_POLL_INTERVAL_MS wajib bilangan bulat minimal 5000.");
  if (process.env.EMAIL_ENABLED === "true" && process.env.SMTP_DRY_RUN === "false") {
    requireEnvironment(["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM", "APP_URL"]);
    const port = Number(process.env.SMTP_PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("SMTP_PORT wajib bilangan bulat 1-65535.");
    const limit = Number(process.env.EMAIL_DAILY_LIMIT ?? "250");
    if (!Number.isInteger(limit) || limit < 1) throw new Error("EMAIL_DAILY_LIMIT wajib bilangan bulat positif.");
    try { new URL(process.env.APP_URL!); } catch { throw new Error("APP_URL tidak valid."); }
  }
}
