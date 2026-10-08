import "./load-env";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolveDatabaseUrl } from "../lib/database-url";

const databaseName =
  process.env.TEST_DATABASE_NAME ?? "mabeslink_ui_test_20261008";
if (!/^mabeslink_ui_test_[0-9]+$/.test(databaseName))
  throw new Error("Runtime check wajib memakai database UI test terpisah.");
const dsn = new URL(
  resolveDatabaseUrl({
    ...process.env,
    DATABASE_PURPOSE: "testing",
    TEST_DATABASE_NAME: databaseName,
  }),
);
if (!/^(localhost|127\.0\.0\.1)$/.test(dsn.hostname) || dsn.port !== "5434")
  throw new Error("Runtime check hanya untuk PostgreSQL lokal port 5434.");
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: dsn.toString() }),
});
dsn.hostname = "host.docker.internal";
const baseURL = "http://localhost:3101";
const env = {
  ...process.env,
  DATABASE_URL: dsn.toString(),
  DATABASE_PURPOSE: "testing",
  TEST_DATABASE_NAME: databaseName,
  APP_URL: baseURL,
  BETTER_AUTH_URL: baseURL,
  EMAIL_ENABLED: "false",
  SMTP_DRY_RUN: "true",
  PRIVATE_STORAGE_PATH: "/data/uploads",
};
const keys = [
  "DATABASE_URL",
  "DATABASE_PURPOSE",
  "TEST_DATABASE_NAME",
  "APP_URL",
  "BETTER_AUTH_URL",
  "BETTER_AUTH_SECRET",
  "EMAIL_ENABLED",
  "SMTP_DRY_RUN",
  "PRIVATE_STORAGE_PATH",
];
const docker = promisify(execFile);
const web = "mabeslink-audit-web-20261008";
const worker = "mabeslink-audit-worker-20261008";
const image = process.env.AUDIT_DOCKER_IMAGE ?? "mabeslink:audit-20261008";
const volume = "mabeslink_audit_private_20261008";
const started: string[] = [];
let stage = "configuration";
async function run(args: string[]) {
  return (
    await docker("docker", args, { env, timeout: 45_000, maxBuffer: 512_000 })
  ).stdout.trim();
}
async function containerHttp(
  path: string,
): Promise<{ status: number; health?: Record<string, unknown> }> {
  const code = `fetch('http://127.0.0.1:3000'+${JSON.stringify(path)}).then(async r=>console.log(JSON.stringify({status:r.status,health:${JSON.stringify(path)}==='/api/health'?await r.json():undefined}))).catch(()=>process.exit(1))`;
  return JSON.parse(await run(["exec", web, "node", "-e", code]));
}
async function waitFor(check: () => Promise<boolean>, label: string) {
  for (let attempt = 0; attempt < 30; attempt++) {
    if (await check().catch(() => false)) return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`${label} tidak sehat dalam 30 detik.`);
}
async function main() {
  if (!process.env.BETTER_AUTH_SECRET)
    throw new Error(
      "Secret auth server valid wajib tersedia, tidak boleh ditebak.",
    );
  const before = await db.prospect.count();
  if (!before)
    throw new Error(
      "Jalankan test:audit-ui dahulu agar ada data samaran untuk uji persistence.",
    );
  const existing = await run(["ps", "-a", "--format", "{{.Names}}"]);
  if (existing.split("\n").some((name) => [web, worker].includes(name)))
    throw new Error(
      "Container audit bernama sama sudah ada; periksa secara manual, tidak ditimpa.",
    );
  // Join the existing local database network, never recreate or restart its container.
  const networkList = await run([
    "inspect",
    "--format",
    "{{range $name, $settings := .NetworkSettings.Networks}}{{$name}}{{println}}{{end}}",
    "mabeslink-postgres",
  ]);
  const network = networkList.split("\n")[0]?.trim();
  if (!network || !/^[a-zA-Z0-9_-]+$/.test(network))
    throw new Error("Network database lokal tidak ditemukan.");
  dsn.hostname = "mabeslink-postgres";
  dsn.port = "5432";
  env.DATABASE_URL = dsn.toString();
  try {
    const common = [
      "--rm",
      "-d",
      "--restart=no",
      "--network",
      network,
      ...keys.flatMap((key) => ["-e", key]),
      "-v",
      `${volume}:/data/uploads`,
    ];
    stage = "start web";
    await run([
      "run",
      ...common,
      "--name",
      web,
      "-p",
      "127.0.0.1:3101:3000",
      image,
    ]);
    started.push(web);
    stage = "start worker";
    await run([
      "run",
      ...common,
      "--name",
      worker,
      image,
      "npm",
      "run",
      "worker",
    ]);
    started.push(worker);
    stage = "web health";
    await waitFor(
      async () => (await containerHttp("/api/health")).status === 200,
      "Web/container PostgreSQL",
    );
    const hostname = await run([
      "inspect",
      "--format",
      "{{.Config.Hostname}}",
      worker,
    ]);
    stage = "worker heartbeat";
    await waitFor(
      async () =>
        !!(await db.workerHeartbeat.findFirst({ where: { hostname } })),
      "Heartbeat worker Docker",
    );
    stage = "routes and access";
    if ((await containerHttp("/api/mapping")).status !== 401)
      throw new Error("API internal tanpa login tidak ditolak.");
    for (const path of [
      "/",
      "/login",
      "/qris-custom",
      "/qris-template/template-batik-nusantara.png",
      "/qris-template/template-alam-indonesia.png",
    ])
      if ((await containerHttp(path)).status !== 200)
        throw new Error(`Route ${path} tidak tersedia di image.`);
    stage = "private volume write";
    await run([
      "exec",
      web,
      "node",
      "-e",
      "require('node:fs').writeFileSync('/data/uploads/.audit-persistence.txt','MABES-LINK-SYNTHETIC-STORAGE')",
    ]);
    const oldHeartbeat = await db.workerHeartbeat.findFirstOrThrow({
      where: { hostname },
      orderBy: { lastSeen: "desc" },
    });
    stage = "restart";
    await run(["restart", web, worker]);
    await waitFor(
      async () => (await containerHttp("/api/health")).status === 200,
      "Web setelah restart",
    );
    await waitFor(
      async () =>
        !!(await db.workerHeartbeat.findFirst({
          where: { hostname, lastSeen: { gt: oldHeartbeat.lastSeen } },
        })),
      "Worker setelah restart",
    );
    const stored = await run([
      "exec",
      web,
      "node",
      "-e",
      "process.stdout.write(require('node:fs').readFileSync('/data/uploads/.audit-persistence.txt','utf8'))",
    ]);
    if (
      stored !== "MABES-LINK-SYNTHETIC-STORAGE" ||
      (await db.prospect.count()) !== before
    )
      throw new Error("Persistence setelah restart tidak sesuai.");
    await run([
      "exec",
      web,
      "node",
      "-e",
      "require('node:fs').unlinkSync('/data/uploads/.audit-persistence.txt')",
    ]);
    const health = (await containerHttp("/api/health")).health;
    const hostReachable = await fetch(`${baseURL}/api/health`, {
      signal: AbortSignal.timeout(3_000),
    })
      .then((response) => response.ok)
      .catch(() => false);
    await mkdir(".artifacts/audit-ui", { recursive: true });
    await writeFile(
      ".artifacts/audit-ui/docker-runtime.json",
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          database: databaseName,
          image,
          health,
          hostReachable,
          mappingCount: before,
          checks: [
            "web FE+BE dan worker terpisah aktif",
            "API mapping tanpa login 401",
            "Home/login/QRIS dan dua template HTTP 200",
            "restart web+worker dan heartbeat baru",
            "database dan volume privat bertahan setelah restart",
            "email nonaktif/dry-run; tidak deploy publik",
          ],
        },
        null,
        2,
      ),
    );
    console.log(
      "Docker runtime lulus: health, akses 401, kedua template, restart web/worker, persistence database dan volume privat.",
    );
    console.log(
      hostReachable
        ? "Port host 3101 dapat diakses."
        : "Keterbatasan: port host 3101 belum dapat diakses pada Docker Desktop ini; HTTP diuji di dalam container. Periksa forwarding/firewall sebelum deployment.",
    );
  } catch (error) {
    for (const name of started) {
      const state = await run([
        "inspect",
        "--format",
        "{{.State.Status}} exit={{.State.ExitCode}}",
        name,
      ]).catch(() => "unavailable");
      console.error(`${name}: ${state}`);
    }
    throw error;
  } finally {
    // Only the two explicitly named containers created by this invocation are stopped.
    for (const name of started.reverse())
      await run(["stop", "--time", "10", name]).catch(() => {});
    await db.$disconnect();
  }
}
void main().catch((error) => {
  console.error(
    `Docker runtime check gagal pada ${stage} (${error instanceof Error ? error.name : "UNKNOWN"}); periksa image, database test dan port 3101. Rahasia tidak dicetak.`,
  );
  process.exitCode = 1;
});
