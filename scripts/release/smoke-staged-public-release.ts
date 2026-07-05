import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, "../..");
const smokeRoot = path.join(os.tmpdir(), `petpresence_staged_smoke_${Date.now()}_${process.pid}`);
const checkerScript = path.join(repoRoot, "scripts", "release", "check-staged-public-release.ts");
const tsxCli = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");

try {
  await mkdir(smokeRoot, { recursive: true });
  await git(["init"]);
  await git(["config", "user.email", "smoke@example.invalid"]);
  await git(["config", "user.name", "PetPresence Smoke"]);
  await writeSmokeFile("README.md", "# staged smoke\n");
  await git(["add", "README.md"]);
  await git(["commit", "-m", "initial"]);

  const fakeSecret = ["sk", "stagedpublicreleasecheckfake000000"].join("-");
  await writeSmokeFile(".env", `OPENAI_API_KEY=${fakeSecret}\n`);
  await writeSmokeFile("assets/private/pet/idle/idle.webm", "private");
  await writeSmokeFile("assets/pets/pet_xiaobai/idle/idle.webm", "legacy xiaobai media");
  await writeSmokeFile("data/pets/pet_xiaobai/profile.json", "{}\n");
  await writeSmokeFile("outputs/generated/source.txt", "generated");
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
  await git([
    "add",
    ".env",
    "assets/private/pet/idle/idle.webm",
    "assets/pets/pet_xiaobai/idle/idle.webm",
    "data/pets/pet_xiaobai/profile.json",
    "outputs/generated/source.txt",
    "leaky-path.md",
  ]);

  const failingOutput = await runCheckerExpectFailure();
  assertText(failingOutput, ".env is staged as a local environment file", "Staged smoke must block .env");
  assertText(
    failingOutput,
    "assets/private/pet/idle/idle.webm is staged as private legacy media",
    "Staged smoke must block private legacy media",
  );
  assertText(
    failingOutput,
    "assets/pets/pet_xiaobai/idle/idle.webm is staged as legacy xiaobai media",
    "Staged smoke must block legacy xiaobai media",
  );
  assertText(
    failingOutput,
    "data/pets/pet_xiaobai/profile.json is staged as legacy xiaobai data",
    "Staged smoke must block legacy xiaobai data",
  );
  assertText(
    failingOutput,
    "outputs/generated/source.txt is staged as generated output",
    "Staged smoke must block generated outputs",
  );
  assertText(failingOutput, "looks like a real API secret", "Staged smoke must block likely real API secrets");
  assertText(
    failingOutput,
    "leaky-path.md contains a local hackathon workspace path",
    "Staged smoke must block local hackathon workspace paths",
  );
  assertText(
    failingOutput,
    "leaky-path.md contains a raw generated media filename",
    "Staged smoke must block raw generated media filenames",
  );

  await git([
    "rm",
    "--cached",
    ".env",
    "assets/private/pet/idle/idle.webm",
    "assets/pets/pet_xiaobai/idle/idle.webm",
    "data/pets/pet_xiaobai/profile.json",
    "outputs/generated/source.txt",
    "leaky-path.md",
  ]);
  const passingOutput = await runChecker();
  assertText(passingOutput, "staged public release check passed", "Staged smoke must pass after cleanup");

  console.log("staged public release smoke passed");
} finally {
  await rm(smokeRoot, { recursive: true, force: true });
}

async function writeSmokeFile(relativePath: string, content: string): Promise<void> {
  const absolutePath = path.join(smokeRoot, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
}

async function git(args: string[]): Promise<void> {
  await execFileAsync("git", args, { cwd: smokeRoot, windowsHide: true });
}

async function runChecker(): Promise<string> {
  const { stdout, stderr } = await execFileAsync(process.execPath, [tsxCli, checkerScript], {
    cwd: smokeRoot,
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 8,
  });
  return `${stdout}${stderr}`;
}

async function runCheckerExpectFailure(): Promise<string> {
  try {
    const output = await runChecker();
    throw new Error(`Expected staged checker to fail, but it passed:\n${output}`);
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string; code?: number; message?: string };
    const output = `${failure.stdout ?? ""}${failure.stderr ?? ""}`;
    if (failure.code && failure.code !== 0) {
      return output;
    }
    throw error;
  }
}

function assertText(text: string, expected: string, message: string): void {
  if (!text.includes(expected)) {
    throw new Error(`${message}. Expected to find: ${expected}\nOutput:\n${text}`);
  }
}
