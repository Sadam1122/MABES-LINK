import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const connectionString = process.env.DATABASE_URL;
const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

if (!connectionString) throw new Error("DATABASE_URL wajib tersedia.");
if (!name || name.length < 2)
  throw new Error("BOOTSTRAP_ADMIN_NAME minimal 2 karakter.");
if (!email || !/^\S+@\S+\.\S+$/.test(email))
  throw new Error("BOOTSTRAP_ADMIN_EMAIL tidak valid.");
if (
  !password ||
  password.length < 14 ||
  !/[a-z]/.test(password) ||
  !/[A-Z]/.test(password) ||
  !/\d/.test(password) ||
  !/[^A-Za-z0-9]/.test(password)
)
  throw new Error(
    "BOOTSTRAP_ADMIN_PASSWORD minimal 14 karakter dan wajib memiliki huruf besar, huruf kecil, angka, serta simbol.",
  );

const databaseUrl = connectionString;
const adminName = name;
const adminEmail = email;
const adminPassword = password;

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

async function main() {
  const activeAdmin = await db.user.findFirst({
    where: { role: Role.ADMIN, active: true, isTest: false },
    select: { email: true },
  });
  if (activeAdmin)
    throw new Error(
      `ADMIN operasional sudah tersedia (${activeAdmin.email}); kelola akun berikutnya dari menu Pengaturan.`,
    );
  if (await db.user.findUnique({ where: { email: adminEmail } }))
    throw new Error("Email sudah dipakai dan tidak akan ditimpa.");

  const branch = await db.branch.upsert({
    where: { code: "11539" },
    create: {
      code: "11539",
      name: "KCP Mandiri Jakarta Mangga Besar",
      classCode: "B.2",
      timezone: "Asia/Jakarta",
    },
    update: {},
  });
  const passwordHash = await hashPassword(adminPassword);
  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        emailVerified: true,
        role: Role.ADMIN,
        branchId: branch.id,
        active: true,
        isTest: false,
      },
    });
    await tx.account.create({
      data: {
        userId: created.id,
        accountId: created.id,
        providerId: "credential",
        password: passwordHash,
      },
    });
    await tx.auditLog.create({
      data: {
        branchId: branch.id,
        entityType: "User",
        entityId: created.id,
        action: "INITIAL_ADMIN_PROVISIONED",
        after: { email: created.email, role: created.role },
      },
    });
    return created;
  });
  console.log(`ADMIN awal dibuat untuk ${user.email}. Password tidak dicetak.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
