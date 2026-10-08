import "./load-env";
import { spawn } from "node:child_process";
import { localComposeEnvironment } from "../lib/local-compose-env";

const commands: Record<string, string[]> = {
  db: ["up", "-d", "postgres"],
  up: ["--profile", "app", "up", "-d", "--build"],
  build: ["--profile", "app", "build"],
  check: ["--profile", "app", "config", "--quiet"],
};
const action = process.argv[2] ?? "check";
if (!commands[action]) throw new Error("Aksi Compose tidak dikenal.");
// No secret is written to disk or printed in the command line/config output.
const child = spawn("docker", ["compose", ...commands[action]], {
  stdio: "inherit",
  env: localComposeEnvironment(process.env),
});
child.on("error", () => {
  console.error("Docker tidak dapat dijalankan.");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
