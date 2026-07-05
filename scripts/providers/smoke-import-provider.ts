import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const smokeRunId = `${Date.now()}_${process.pid}`;
const petId = `pet_import_smoke_${smokeRunId}`;
const sourceAction = "idle";
const importedAction = "wave_paw";
const smokeRoot = path.join(repoRoot, "outputs", "provider-import-smoke", smokeRunId);
const sourcePath = path.join(smokeRoot, "source.mp4");
const importedPath = path.join(smokeRoot, "imported.mp4");
const resultPath = path.join(smokeRoot, "provider-result.json");

try {
  await mkdir(smokeRoot, { recursive: true });
  await runTsxScript("scripts/providers/example-video-provider.ts", [
    "--pet-id",
    petId,
    "--action",
    sourceAction,
    "--output",
    sourcePath,
    "--prompt",
    "Create a source clip for import smoke.",
  ]);
  await assertExists(sourcePath);

  const importJson = await runTsxScriptCapture("scripts/providers/import-local-video.ts", [
    "--pet-id",
    petId,
    "--action",
    importedAction,
    "--input",
    sourcePath,
    "--output",
    importedPath,
    "--prompt",
    "Import this local clip as a provider contract smoke.",
  ]);
  JSON.parse(importJson);
  await writeFile(resultPath, importJson, "utf8");
  await assertExists(importedPath);

  await runTsxScript("scripts/providers/validate-provider-result.ts", [
    "--input",
    resultPath,
    "--pet-id",
    petId,
    "--action",
    importedAction,
  ]);

  console.log("import provider smoke passed");
} finally {
  await rm(smokeRoot, { force: true, recursive: true });
  await rm(path.join(repoRoot, "outputs", "provider-import-smoke"), { force: true, recursive: true }).catch(() => {});
}

async function runTsxScript(scriptPath: string, args: string[]): Promise<void> {
  const tsxCli = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
  await run(process.execPath, [tsxCli, path.join(repoRoot, scriptPath), ...args], true);
}

async function runTsxScriptCapture(scriptPath: string, args: string[]): Promise<string> {
  const tsxCli = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
  return await run(process.execPath, [tsxCli, path.join(repoRoot, scriptPath), ...args], false);
}

async function run(command: string, args: string[], inherit: boolean): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      shell: false,
      stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    if (!inherit) {
      child.stdout?.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr?.on("data", (chunk) => {
        stderr += chunk.toString();
      });
    }
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}: ${stderr}`));
    });
  });
}

async function assertExists(filePath: string): Promise<void> {
  try {
    await stat(filePath);
  } catch {
    throw new Error(`Expected provider import smoke output was not found: ${filePath}`);
  }
}
