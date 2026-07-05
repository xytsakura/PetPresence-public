import { mkdir, rm, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const smokeRunId = `${Date.now()}_${process.pid}`;
const petId = `pet_quickstart_smoke_${smokeRunId}`;
const demoAsset = path.join(repoRoot, "assets", "pets", "pet_demo", "idle", "idle.webm");

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

try {
  await cleanup();
  await assertExists(demoAsset);

  await runTsxScript("scripts/creator/doctor.ts", []);
  await runTsxScript("scripts/creator/pet-cli.ts", ["validate", "--pet-id", "pet_demo"]);
  await runNpm(["--prefix", "apps/desktop", "run", "smoke", "--", "--pet-id", "pet_demo"]);

  await runTsxScript("scripts/creator/pet-cli.ts", [
    "init",
    "--pet-id",
    petId,
    "--name",
    "QuickstartSmoke",
    "--species",
    "synthetic",
    "--description",
    "Temporary quickstart smoke pet",
    "--force",
  ]);
  await runTsxScript("scripts/creator/create-brief.ts", [
    "--pet-id",
    petId,
    "--actions",
    "idle,wave_paw",
    "--media",
    "assets/pets/pet_demo/idle/idle.webm",
    "--video-api",
    "not configured",
    "--upload-consent",
    "no upload needed for quickstart",
    "--force",
  ]);
  await runTsxScript("scripts/creator/scaffold-actions.ts", [
    "--pet-id",
    petId,
    "--actions",
    "idle,wave_paw",
    "--force",
  ]);
  const doctorOutput = await runTsxScriptCapture("scripts/creator/doctor.ts", ["--pet-id", petId]);
  assertText(doctorOutput, `pet:${petId}:creator_brief`, "Doctor must check generated creator brief");
  assertText(doctorOutput, `pet:${petId}:action_plan`, "Doctor must check generated action plan");
  assertText(doctorOutput, `pet:${petId}:prompts`, "Doctor must check generated prompt files");
  assertText(doctorOutput, "2 prompt file(s): idle.txt, wave_paw.txt", "Doctor must summarize quickstart prompt files");
  const doctorJson = JSON.parse(
    await runTsxScriptCapture("scripts/creator/doctor.ts", ["--pet-id", petId, "--json"]),
  ) as DoctorJson;
  if (doctorJson.schema_version !== 1 || doctorJson.pet_id !== petId) {
    throw new Error("Doctor JSON must include schema_version 1 and the requested pet_id");
  }
  if (doctorJson.summary.error !== 0) {
    throw new Error("Doctor JSON must report zero errors for the quickstart smoke pet");
  }
  assertDoctorCheck(doctorJson, `pet:${petId}:creator_brief`);
  assertDoctorCheck(doctorJson, `pet:${petId}:action_plan`);
  assertDoctorCheck(doctorJson, `pet:${petId}:prompts`);
  await assertExists(path.join(repoRoot, "data", "pets", petId, "creator_brief.md"));
  await assertExists(path.join(repoRoot, "data", "pets", petId, "action_plan.md"));
  await assertExists(path.join(repoRoot, "data", "pets", petId, "prompts", "idle.txt"));
  await assertExists(path.join(repoRoot, "data", "pets", petId, "prompts", "wave_paw.txt"));

  await runTsxScript("scripts/creator/pet-cli.ts", [
    "add-action",
    "--pet-id",
    petId,
    "--action",
    "idle",
    "--input",
    demoAsset,
    "--skip-alpha",
    "--loop",
    "true",
    "--message",
    "Quickstart smoke idle",
  ]);
  await runTsxScript("scripts/creator/pet-cli.ts", ["validate", "--pet-id", petId]);
  const validationJson = JSON.parse(
    await runTsxScriptCapture("scripts/creator/pet-cli.ts", ["validate", "--pet-id", petId, "--json"]),
  ) as ValidationJson;
  if (validationJson.schema_version !== 1 || validationJson.pet_id !== petId) {
    throw new Error("Validation JSON must include schema_version 1 and the requested pet_id");
  }
  if (!validationJson.summary.ok || validationJson.summary.error !== 0) {
    throw new Error("Validation JSON must report a successful quickstart smoke pet");
  }
  await runNpm(["--prefix", "apps/desktop", "run", "smoke", "--", "--pet-id", petId]);

  console.log("quickstart smoke passed");
} finally {
  await cleanup();
}

async function runTsxScript(scriptPath: string, args: string[]): Promise<void> {
  const tsxCli = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
  await run(process.execPath, [tsxCli, path.join(repoRoot, scriptPath), ...args]);
}

async function runTsxScriptCapture(scriptPath: string, args: string[]): Promise<string> {
  const tsxCli = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
  return await runCapture(process.execPath, [tsxCli, path.join(repoRoot, scriptPath), ...args]);
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

async function runCapture(command: string, args: string[]): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
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
    throw new Error(`Expected quickstart smoke file was not found: ${filePath}`);
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
  ]);
  await mkdir(path.join(repoRoot, "data", "pets"), { recursive: true });
  await mkdir(path.join(repoRoot, "assets", "pets"), { recursive: true });
}
