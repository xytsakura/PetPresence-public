import { spawn } from "node:child_process";
import { rmdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const smokeRunId = `${Date.now()}_${process.pid}`;
const petId = `pet_provider_smoke_${smokeRunId}`;
const action = "idle";
const smokeRoot = path.join(repoRoot, "outputs", "provider-smoke");
const outputPath = path.join(smokeRoot, smokeRunId, `${action}.mp4`);

try {
  await runTsxScript("scripts/providers/example-video-provider.ts", [
    "--pet-id",
    petId,
    "--action",
    action,
    "--output",
    outputPath,
    "--prompt",
    "Create a tiny synthetic provider smoke clip.",
  ]);
  await assertExists(outputPath);
  console.log("example provider smoke passed");
} finally {
  await rm(path.join(smokeRoot, smokeRunId), { force: true, recursive: true });
  await rmdir(smokeRoot).catch(() => {});
}

async function runTsxScript(scriptPath: string, args: string[]): Promise<void> {
  const tsxCli = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
  await run(process.execPath, [tsxCli, path.join(repoRoot, scriptPath), ...args]);
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
    throw new Error(`Expected provider smoke output was not found: ${filePath}`);
  }
}
