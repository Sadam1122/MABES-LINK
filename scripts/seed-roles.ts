import "./load-env";

import { randomBytes } from "node:crypto";
import { writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { assertRoleSeedEnvironment } from "../lib/role-seed-guard";
import { resolveDatabaseUrl } from "../lib/database-url";

const seedUsers = [
  { id: "role-test-admin-11539", email: "admin.11539@mabeslink.test", name: "Admin Uji 11539", role: Role.ADMIN, scope: "Semua cabang, akun, konfigurasi, dan pekerjaan" },
  { id: "role-test-cs-11539", email: "cs.11539@mabeslink.test", name: "CS Uji 11539", role: Role.CS, scope: "Penugasan dan serah terima CS pada cabang 11539" },
  { id: "role-test-supervisor-11539", email: "supervisor.11539@mabeslink.test", name: "Supervisor Uji 11539", role: Role.SUPERVISOR, scope: "Seluruh pekerjaan pada cabang 11539" },
  { id: "role-test-outbranch-11539", email: "outbranch.11539@mabeslink.test", name: "Outbranch Uji 11539", role: Role.OUT_BRANCH, scope: "Pekerjaan yang ditugaskan kepada akun ini" },
] as const;

function strongPassword() {
  return `Ml!${randomBytes(18).toString("base64url")}9aA`;
}

async function main() {
  const connectionString = resolveDatabaseUrl();
  assertRoleSeedEnvironment({ ...process.env, DATABASE_URL: connectionString });
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const roleFile = resolve(process.cwd(), "role.md");
  try {
    if (process.argv.includes("--remove")) {
      const matches = await db.user.findMany({ where: { id: { in: seedUsers.map((row) => row.id) } }, select: { id: true, email: true, isTest: true } });
      if (matches.some((row) => !row.isTest || !row.email.endsWith("@mabeslink.test"))) throw new Error("Penghapusan ditolak karena ada identitas seeder yang bukan akun uji.");
      await db.user.deleteMany({ where: { id: { in: matches.map((row) => row.id) }, isTest: true } });
      console.log(`${matches.length} akun role uji dihapus. Branch dan data operasional tidak diubah.`);
      return;
    }

    const existing = await db.user.findMany({ where: { OR: [{ id: { in: seedUsers.map((row) => row.id) } }, { email: { in: seedUsers.map((row) => row.email) } }] }, select: { id: true, email: true, role: true, branchId: true, isTest: true } });
    if (existing.length) {
      if (existing.length !== seedUsers.length || existing.some((row) => !row.isTest)) throw new Error("Seeder menemukan akun parsial atau akun non-testing; tidak ada data yang diubah.");
      try { await readFile(roleFile, "utf8"); } catch { throw new Error("Akun uji sudah ada tetapi role.md tidak tersedia. Hapus dengan seed:roles:remove lalu buat ulang agar password baru terdokumentasi."); }
      console.log("Empat akun role uji sudah tersedia; password dan akun tidak diubah.");
      return;
    }

    const branch = await db.branch.upsert({ where: { code: "11539" }, create: { code: "11539", name: "KCP Mandiri Jakarta Mangga Besar", classCode: "B.2", timezone: "Asia/Jakarta" }, update: {} });
    const credentials = await Promise.all(seedUsers.map(async (row) => {
      const password = strongPassword();
      return { ...row, password, passwordHash: await hashPassword(password) };
    }));
    await db.$transaction(async (tx) => {
      for (const item of credentials) {
        await tx.user.create({ data: { id: item.id, name: item.name, email: item.email, emailVerified: true, role: item.role, branchId: branch.id, active: true, isTest: true, emailNotificationsEnabled: false } });
        await tx.account.create({ data: { userId: item.id, accountId: item.id, providerId: "credential", password: item.passwordHash } });
      }
    });
    const loginUrl = new URL("/login", process.env.APP_URL ?? "http://localhost:3000").toString();
    const table = credentials.map((item) => `| ${item.role} | ${item.email} | \`${item.password}\` | ${item.scope} |`).join("\n");
    await writeFile(roleFile, `# Akun Role MABES LINK — Lokal Privat\n\nDokumen ini dibuat otomatis oleh \`npm run seed:roles\`, diabaikan Git, dan tidak boleh disalin ke UI atau repository. Akun hanya ada pada database testing terpisah.\n\n- Login: ${loginUrl}\n- Cabang: 11539 — KCP Mandiri Jakarta Mangga Besar\n- Dibuat: ${new Date().toISOString()}\n\n| Role | Email | Password | Cakupan |\n|---|---|---|---|\n${table}\n\n## Menjalankan\n\nGunakan database bernama mengandung \`test\`, lalu set \`DATABASE_PURPOSE=testing\`, \`ROLE_SEED_ENABLED=true\`, dan \`ROLE_SEED_CONFIRM=MABESLINK_TEST_ONLY\`. Jalankan \`npm run seed:roles\`.\n\n## Menghapus\n\nDengan penanda testing yang sama, jalankan \`npm run seed:roles:remove\`. Perintah hanya menargetkan empat ID akun uji di atas dan menolak akun non-testing.\n`, { encoding: "utf8", mode: 0o600 });
    console.log("Empat akun role uji dibuat. Kredensial hanya ditulis ke role.md (diabaikan Git).");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "Seeder role gagal."); process.exitCode = 1; });
