import { spawn } from "node:child_process";
import { rm, stat } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const smokeRunId = `${Date.now()}_${process.pid}`;
const petId = `pet_creator_smoke_${smokeRunId}`;
const sourceAsset = path.join(repoRoot, "assets", "pets", "pet_demo", "idle", "idle.webm");

try {
  await assertExists(sourceAsset);
  await runTsxScript("scripts/creator/pet-cli.ts", [
    "init",
    "--pet-id",
    petId,
    "--name",
    "CreatorSmoke",
    "--species",
    "cat",
    "--description",
    "Temporary creator smoke pet",
    "--force",
  ]);
  await runTsxScript("scripts/creator/pet-cli.ts", [
    "add-action",
    "--pet-id",
    petId,
    "--action",
    "idle",
    "--input",
    sourceAsset,
    "--skip-alpha",
    "--loop",
    "true",
    "--message",
    "Creator smoke passed~",
  ]);
  await runTsxScript("scripts/creator/pet-cli.ts", ["validate", "--pet-id", petId]);
  await runNpm(["--prefix", "apps/desktop", "run", "smoke", "--", "--pet-id", petId]);
  console.log("creator smoke passed");
} finally {
  await cleanup();
}

async function runTsxScript(scriptPath: string, args: string[]): Promise<void> {
  const tsxCli = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
  await run(process.execPath, [tsxCli, path.join(repoRoot, scriptPath), ...args]);
}

async function runNpm(args: string[]): Promise<void> {
  if (process.platform === "win32") {
    await run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", ["npm", ...args].join(" ")]);
    return;
  }
  await run("npm", args);
}

async function run(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      shell: false,
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function assertExists(filePath: string): Promise<void> {
  try {
    await stat(filePath);
  } catch {
    throw new Error(`Required smoke asset not found: ${filePath}`);
  }
}

async function cleanup(): Promise<void> {
  await Promise.all([
    rm(path.join(repoRoot, "data", "pets", petId), { force: true, recursive: true }),
    rm(path.join(repoRoot, "assets", "pets", petId), { force: true, recursive: true }),
  ]);
}
