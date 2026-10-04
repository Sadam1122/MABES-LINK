import "./load-env";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL tidak tersedia.");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  console.log(await db.prospect.count());
}

main().finally(async () => db.$disconnect());
