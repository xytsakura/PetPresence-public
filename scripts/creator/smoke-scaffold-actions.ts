import { mkdir, readFile, rm, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const smokeRunId = `${Date.now()}_${process.pid}`;
const petId = `pet_scaffold_smoke_${smokeRunId}`;

try {
  await cleanup();
  await runTsxScript("scripts/creator/pet-cli.ts", [
    "init",
    "--pet-id",
    petId,
    "--name",
    "ScaffoldSmoke",
    "--species",
    "synthetic",
    "--description",
    "Temporary scaffold smoke pet",
    "--force",
  ]);
  await runTsxScript("scripts/creator/create-brief.ts", [
    "--pet-id",
    petId,
    "--actions",
    "idle,wave_paw,custom_spin",
    "--media",
    "TBD",
    "--video-api",
    "not configured",
    "--upload-consent",
    "ask every time before uploading pet media",
    "--force",
  ]);
  await runTsxScript("scripts/creator/scaffold-actions.ts", [
    "--pet-id",
    petId,
    "--actions",
    "idle,wave_paw,custom_spin",
    "--force",
  ]);
  const briefPath = path.join(repoRoot, "data", "pets", petId, "creator_brief.md");
  await assertExists(briefPath);
  const brief = await readFile(briefPath, "utf8");
  assertText(brief, "upload_consent", "creator brief must record upload consent");
  assertText(brief, "Do not upload reference images or videos", "creator brief must preserve provider upload boundary");
  assertText(brief, "Acceptance Checks", "creator brief must include acceptance checks");
  await assertExists(path.join(repoRoot, "data", "pets", petId, "action_plan.md"));
  await assertExists(path.join(repoRoot, "data", "pets", petId, "prompts", "idle.txt"));
  await assertExists(path.join(repoRoot, "data", "pets", petId, "prompts", "wave_paw.txt"));
  await assertExists(path.join(repoRoot, "data", "pets", petId, "prompts", "custom_spin.txt"));
  console.log("creator scaffold actions smoke passed");
} finally {
  await cleanup();
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
    throw new Error(`Expected scaffold output was not found: ${filePath}`);
  }
}

function assertText(text: string, expected: string, message: string): void {
  if (!text.includes(expected)) {
    throw new Error(message);
  }
}

async function cleanup(): Promise<void> {
  await Promise.all([
    rm(path.join(repoRoot, "data", "pets", petId), { force: true, recursive: true }),
    rm(path.join(repoRoot, "assets", "pets", petId), { force: true, recursive: true }),
  ]);
  await mkdir(path.join(repoRoot, "data", "pets"), { recursive: true });
  await mkdir(path.join(repoRoot, "assets", "pets"), { recursive: true });
}
