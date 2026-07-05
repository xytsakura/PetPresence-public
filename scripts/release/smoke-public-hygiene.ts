import { spawn } from "node:child_process";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

type RunResult = {
  code: number | null;
  stdout: string;
  stderr: string;
};

const repoRoot = path.resolve(import.meta.dirname, "../..");
const smokeRoot = path.join(os.tmpdir(), `petpresence_hygiene_smoke_${Date.now()}_${process.pid}`);
const hygieneScript = path.join(smokeRoot, "scripts", "release", "check-public-hygiene.ts");

try {
  await cp(path.join(repoRoot, "scripts", "release", "check-public-hygiene.ts"), hygieneScript, {
    force: true,
    recursive: true,
  });
  await writeSmokeFile("package.json", JSON.stringify({ type: "module" }, null, 2));
  await mkdir(path.join(smokeRoot, "node_modules", "ignored"), { recursive: true });
  await writeFile(path.join(smokeRoot, "node_modules", "ignored", ".env"), "OPENAI_API_KEY=sk-ignored\n");

  const fakeSecret = `sk-${"testsecret".padEnd(24, "0")}`;
  await writeSmokeFile(".env", `OPENAI_API_KEY=${fakeSecret}\n`);
  await writeSmokeFile("petpresence.pem", "fake private key");
  await writeSmokeFile("safe.md", "PETPRESENCE_VIDEO_API_KEY=<api-key>\n");
  await writeSmokeFile("secrets.md", "PETPRESENCE_VIDEO_API_KEY=real-provider-token\n");
  const localWorkspacePath = [
    "D:",
    "HuaweiMoveData",
    "Users",
    "name",
    "Desktop",
    "summer-camp",
    "hackathon",
    `${"abcdef".repeat(5)}ab.mp4`,
  ].join("\\");
  await writeSmokeFile("leaky-path.md", `${localWorkspacePath}\n`);
  await writeSmokeFile("outputs/generated/clip.mp4", "not a real video");
  await writeSmokeFile("assets/private/pet/idle/idle.webm", "private");
  await writeSmokeFile("assets/pets/pet_xiaobai/idle/idle.webm", "legacy xiaobai media");
  await writeSmokeFile("data/pets/pet_xiaobai/profile.json", "{}\n");
  await writeSmokeFile("data/pets/pet_demo/events/today.jsonl", "{}\n");

  const failingResult = await runHygiene();
  if (failingResult.code === 0) {
    throw new Error("Hygiene smoke expected forbidden files to fail, but the check passed");
  }
  const failingOutput = `${failingResult.stdout}\n${failingResult.stderr}`;
  assertText(failingOutput, ".env is a local environment file", "Hygiene smoke must block .env");
  assertText(failingOutput, "petpresence.pem is a private key file", "Hygiene smoke must block private key files");
  assertText(failingOutput, "outputs/generated/clip.mp4 is generated output", "Hygiene smoke must block outputs");
  assertText(
    failingOutput,
    "assets/private/pet/idle/idle.webm is private legacy media",
    "Hygiene smoke must block private legacy media",
  );
  assertText(
    failingOutput,
    "assets/pets/pet_xiaobai/idle/idle.webm is legacy xiaobai media",
    "Hygiene smoke must block legacy xiaobai media",
  );
  assertText(
    failingOutput,
    "data/pets/pet_xiaobai/profile.json is legacy xiaobai data",
    "Hygiene smoke must block legacy xiaobai data",
  );
  assertText(failingOutput, "data/pets/pet_demo/events/today.jsonl is local pet events", "Hygiene smoke must block events");
  assertText(
    failingOutput,
    "secrets.md assigns a non-placeholder value to PETPRESENCE_VIDEO_API_KEY",
    "Hygiene smoke must block non-placeholder API key assignments",
  );
  assertText(
    failingOutput,
    "leaky-path.md contains a local hackathon workspace path",
    "Hygiene smoke must block local hackathon workspace paths",
  );
  assertText(
    failingOutput,
    "leaky-path.md contains a raw generated media filename",
    "Hygiene smoke must block raw generated media filenames",
  );

  await rm(path.join(smokeRoot, ".env"), { force: true });
  await rm(path.join(smokeRoot, "petpresence.pem"), { force: true });
  await rm(path.join(smokeRoot, "secrets.md"), { force: true });
  await rm(path.join(smokeRoot, "leaky-path.md"), { force: true });
  await rm(path.join(smokeRoot, "outputs"), { force: true, recursive: true });
  await rm(path.join(smokeRoot, "assets"), { force: true, recursive: true });
  await rm(path.join(smokeRoot, "data"), { force: true, recursive: true });

  const passingResult = await runHygiene();
  if (passingResult.code !== 0) {
    throw new Error(`Hygiene smoke expected cleaned workspace to pass: ${passingResult.stderr}`);
  }
  assertText(passingResult.stdout, "public hygiene check passed", "Hygiene smoke must pass after cleanup");

  console.log("public hygiene smoke passed");
} finally {
  await rm(smokeRoot, { force: true, recursive: true });
}

async function runHygiene(): Promise<RunResult> {
  const tsxCli = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
  return await run(process.execPath, [tsxCli, hygieneScript], smokeRoot);
}

async function writeSmokeFile(relativePath: string, text: string): Promise<void> {
  const absolutePath = path.join(smokeRoot, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, text, "utf8");
}

async function run(command: string, args: string[], cwd: string): Promise<RunResult> {
  return await new Promise<RunResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
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
      resolve({ code, stdout, stderr });
    });
  });
}

function assertText(text: string, expected: string, message: string): void {
  if (!text.includes(expected)) {
    throw new Error(`${message}. Expected to find: ${expected}`);
  }
}
