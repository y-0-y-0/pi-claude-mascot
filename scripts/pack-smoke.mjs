import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const temporaryDirectory = mkdtempSync(join(tmpdir(), "pi-claude-mascot-pack-"));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npmEnvironment = { ...process.env, npm_config_dry_run: "false" };

try {
  const packed = JSON.parse(
    execFileSync(
      npmCommand,
      ["pack", "--json", "--pack-destination", temporaryDirectory],
      { cwd: packageRoot, encoding: "utf8", env: npmEnvironment },
    ),
  );
  const packInfo = Array.isArray(packed) ? packed[0] : Object.values(packed)[0];
  const tarballName = packInfo?.filename;
  if (typeof tarballName !== "string" || tarballName.length === 0) {
    throw new Error("npm pack did not return a tarball filename");
  }

  const tarballPath = join(temporaryDirectory, tarballName);
  execFileSync(
    npmCommand,
    ["install", "--ignore-scripts", "--no-save", "--omit=peer", tarballPath],
    { cwd: temporaryDirectory, stdio: "pipe", env: npmEnvironment },
  );

  const installedRoot = join(temporaryDirectory, "node_modules", "pi-claude-mascot");
  const installedPackage = JSON.parse(readFileSync(join(installedRoot, "package.json"), "utf8"));
  const extensionEntry = installedPackage.pi?.extensions?.[0];
  if (typeof extensionEntry !== "string") {
    throw new Error("Packed package does not declare a Pi extension entry");
  }

  const extensionPath = join(installedRoot, extensionEntry, "mascot-widget.ts");
  try {
    readFileSync(extensionPath, "utf8");
  } catch (error) {
    throw new Error(`Packed package is missing its extension entry at ${extensionPath}`, { cause: error });
  }
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
