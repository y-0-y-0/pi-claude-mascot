import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const packageRoot = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(join(packageRoot, "..", "package.json"), "utf8"));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const publishedVersion = execFileSync(
  npmCommand,
  ["view", packageJson.name, "version", "--json"],
  { cwd: packageRoot, encoding: "utf8" },
).trim();

const normalizedVersion = JSON.parse(publishedVersion);
if (normalizedVersion !== packageJson.version) {
  throw new Error(`npm version mismatch: expected ${packageJson.version}, found ${normalizedVersion}`);
}

process.stdout.write(`${packageJson.name}@${normalizedVersion} is published.\n`);
