import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

type ProviderResult = {
  ok: true;
  provider: string;
  pet_id: string;
  action: string;
  source_video: string;
  prompt: string;
  reference_images: string[];
  next_command: string;
};

type DoctorJson = {
  schema_version: 1;
  pet_id: string | null;
  summary: {
    ok: number;
    warn: number;
    error: number;
  };
  checks: Array<{
    status: "ok" | "warn" | "error";
    label: string;
    detail: string;
  }>;
};

type ValidationJson = {
  schema_version: 1;
  pet_id: string;
  summary: {
    ok: boolean;
    error: number;
    warn: number;
  };
  errors: string[];
  warnings: string[];
};

const repoRoot = path.resolve(import.meta.dirname, "../..");
const smokeRunId = `${Date.now()}_${process.pid}`;
const petId = `pet_agent_pipeline_${smokeRunId}`;
const action = "idle";
const smokeRoot = path.join(repoRoot, "outputs", "agent-pipeline-smoke", smokeRunId);
const sourceMp4 = path.join(smokeRoot, "source.mp4");
const importedMp4 = path.join(smokeRoot, "imported.mp4");
const providerResultPath = path.join(smokeRoot, "provider-result.json");

try {
  await cleanup();
  await mkdir(smokeRoot, { recursive: true });

  await runTsxScript("scripts/creator/pet-cli.ts", [
    "init",
    "--pet-id",
    petId,
    "--name",
    "AgentPipelineSmoke",
    "--species",
    "synthetic",
    "--description",
    "Temporary end-to-end Agent pipeline smoke pet",
    "--force",
  ]);
  const initialDoctor = await runTsxScriptCapture("scripts/creator/doctor.ts", ["--pet-id", petId]);
  assertText(initialDoctor, `pet:${petId}:creator_brief`, "Doctor must check creator brief state");
  assertText(initialDoctor, "missing creator_brief.md", "Doctor must explain missing creator brief");
  await runTsxScript("scripts/creator/create-brief.ts", [
    "--pet-id",
    petId,
    "--actions",
    action,
    "--media",
    "TBD",
    "--video-api",
    "example-local-synthetic",
    "--upload-consent",
    "no upload needed for local synthetic provider",
    "--force",
  ]);
  const creatorBriefPath = path.join(repoRoot, "data", "pets", petId, "creator_brief.md");
  await assertExists(creatorBriefPath);
  const creatorBrief = await readFile(creatorBriefPath, "utf8");
  assertText(creatorBrief, "upload_consent", "Creator brief must record upload consent");
  assertText(
    creatorBrief,
    "Do not upload reference images or videos",
    "Creator brief must preserve provider upload boundary",
  );
  assertText(creatorBrief, "Acceptance Checks", "Creator brief must include acceptance checks");
  await runTsxScript("scripts/creator/scaffold-actions.ts", ["--pet-id", petId, "--actions", action, "--force"]);
  const promptFile = path.join(repoRoot, "data", "pets", petId, "prompts", `${action}.txt`);
  await assertExists(promptFile);
  const plannedDoctor = await runTsxScriptCapture("scripts/creator/doctor.ts", ["--pet-id", petId]);
  assertText(plannedDoctor, `pet:${petId}:creator_brief`, "Doctor must check generated creator brief");
  assertText(plannedDoctor, `pet:${petId}:action_plan`, "Doctor must check generated action plan");
  assertText(plannedDoctor, `pet:${petId}:prompts`, "Doctor must check generated prompt files");
  assertText(plannedDoctor, "1 prompt file(s): idle.txt", "Doctor must summarize generated prompt files");
  const plannedDoctorJson = JSON.parse(
    await runTsxScriptCapture("scripts/creator/doctor.ts", ["--pet-id", petId, "--json"]),
  ) as DoctorJson;
  if (plannedDoctorJson.schema_version !== 1 || plannedDoctorJson.pet_id !== petId) {
    throw new Error("Doctor JSON must include schema_version 1 and the requested pet_id");
  }
  if (plannedDoctorJson.summary.error !== 0) {
    throw new Error("Doctor JSON must report zero errors for the planned smoke pet");
  }
  assertDoctorCheck(plannedDoctorJson, `pet:${petId}:creator_brief`);
  assertDoctorCheck(plannedDoctorJson, `pet:${petId}:action_plan`);
  assertDoctorCheck(plannedDoctorJson, `pet:${petId}:prompts`);

  await runTsxScript("scripts/providers/example-video-provider.ts", [
    "--pet-id",
    petId,
    "--action",
    action,
    "--output",
    sourceMp4,
    "--prompt-file",
    promptFile,
  ]);
  await assertExists(sourceMp4);

  const importJson = await runTsxScriptCapture("scripts/providers/import-local-video.ts", [
    "--pet-id",
    petId,
    "--action",
    action,
    "--input",
    sourceMp4,
    "--output",
    importedMp4,
    "--prompt-file",
    promptFile,
  ]);
  const providerResult = JSON.parse(importJson) as ProviderResult;
  await writeFile(providerResultPath, importJson, "utf8");
  await assertExists(importedMp4);

  await runTsxScript("scripts/providers/validate-provider-result.ts", [
    "--input",
    providerResultPath,
    "--pet-id",
    petId,
    "--action",
    action,
  ]);

  await runTsxScript("scripts/creator/pet-cli.ts", [
    "add-action",
    "--pet-id",
    petId,
    "--action",
    action,
    "--input",
    path.join(repoRoot, providerResult.source_video),
    "--skip-alpha",
    "--loop",
    "true",
    "--message",
    "Agent pipeline smoke passed~",
  ]);
  await runTsxScript("scripts/creator/pet-cli.ts", ["validate", "--pet-id", petId]);
  const validationJson = JSON.parse(
    await runTsxScriptCapture("scripts/creator/pet-cli.ts", ["validate", "--pet-id", petId, "--json"]),
  ) as ValidationJson;
  if (validationJson.schema_version !== 1 || validationJson.pet_id !== petId) {
    throw new Error("Validation JSON must include schema_version 1 and the requested pet_id");
  }
  if (!validationJson.summary.ok || validationJson.summary.error !== 0) {
    throw new Error("Validation JSON must report a successful planned smoke pet");
  }
  await runNpm(["--prefix", "apps/desktop", "run", "smoke", "--", "--pet-id", petId]);

  console.log("agent pipeline smoke passed");
} finally {
  await cleanup();
}

async function runTsxScript(scriptPath: string, args: string[]): Promise<void> {
  const tsxCli = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
  await run(process.execPath, [tsxCli, path.join(repoRoot, scriptPath), ...args], true);
}

async function runTsxScriptCapture(scriptPath: string, args: string[]): Promise<string> {
  const tsxCli = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
  return await run(process.execPath, [tsxCli, path.join(repoRoot, scriptPath), ...args], false);
}

async function runNpm(args: string[]): Promise<void> {
  if (process.platform === "win32") {
    await run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", ["npm", ...args].join(" ")], true);
    return;
  }
  await run("npm", args, true);
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
    throw new Error(`Expected Agent pipeline smoke file was not found: ${filePath}`);
  }
}

function assertText(text: string, expected: string, message: string): void {
  if (!text.includes(expected)) {
    throw new Error(message);
  }
}

function assertDoctorCheck(report: DoctorJson, label: string): void {
  if (!report.checks.some((check) => check.label === label)) {
    throw new Error(`Doctor JSON must include check: ${label}`);
  }
}

async function cleanup(): Promise<void> {
  await Promise.all([
    rm(path.join(repoRoot, "data", "pets", petId), { force: true, recursive: true }),
    rm(path.join(repoRoot, "assets", "pets", petId), { force: true, recursive: true }),
    rm(smokeRoot, { force: true, recursive: true }),
  ]);
  await rm(path.join(repoRoot, "outputs", "agent-pipeline-smoke"), { force: true, recursive: true }).catch(() => {});
  await mkdir(path.join(repoRoot, "data", "pets"), { recursive: true });
  await mkdir(path.join(repoRoot, "assets", "pets"), { recursive: true });
}
