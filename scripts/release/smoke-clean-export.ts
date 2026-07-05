import { execFile, spawn } from "node:child_process";
import { copyFile, mkdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, "../..");
const smokeRunId = `${Date.now()}_${process.pid}`;
const exportRoot = path.join(os.tmpdir(), `petpresence_clean_export_${smokeRunId}`);

try {
  const files = await releaseFileList();
  await mkdir(exportRoot, { recursive: true });
  for (const file of files) {
    await copyRepoFile(file, exportRoot);
  }

  console.log(`Clean export created: ${exportRoot}`);
  console.log(`Copied files: ${files.length}`);

  const steps: CleanExportStep[] = [
    { name: "Install root dependencies", args: ["ci"] },
    { name: "Install desktop dependencies", args: ["--prefix", "apps/desktop", "ci"] },
    { name: "Run quick verification", args: ["run", "verify:quick"] },
  ];
  for (const [index, step] of steps.entries()) {
    await runNpm(`[${index + 1}/${steps.length}] ${step.name}`, step.args, exportRoot);
  }

  console.log("clean export smoke passed");
} finally {
  await rm(exportRoot, { force: true, recursive: true });
}

type CleanExportStep = {
  name: string;
  args: string[];
};

async function releaseFileList(): Promise<string[]> {
  const tracked = await gitLines(["ls-files"]);
  const untracked = await gitLines(["ls-files", "--others", "--exclude-standard"]);
  return [...new Set([...tracked, ...untracked])]
    .filter((file) => !shouldExclude(file))
    .sort((a, b) => a.localeCompare(b));
}

async function gitLines(args: string[]): Promise<string[]> {
  const { stdout } = await execFileAsync("git", args, { cwd: repoRoot, windowsHide: true });
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function shouldExclude(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return (
    normalized === ".env" ||
    normalized.startsWith(".git/") ||
    normalized.startsWith("node_modules/") ||
    normalized.startsWith("apps/desktop/node_modules/") ||
    normalized.startsWith("outputs/") ||
    normalized.startsWith("assets/private/") ||
    normalized.startsWith("data/private/") ||
    normalized.startsWith("assets/legacy/") ||
    normalized.startsWith("data/legacy/") ||
    normalized.startsWith("assets/shelter/") ||
    normalized === "data/shelter_pets.json"
  );
}

async function copyRepoFile(relativeFile: string, destinationRoot: string): Promise<void> {
  const source = path.join(repoRoot, relativeFile);
  const sourceStat = await stat(source).catch(() => null);
  if (!sourceStat) {
    return;
  }
  if (!sourceStat.isFile()) {
    return;
  }
  const target = path.join(destinationRoot, relativeFile);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(source, target);
}

async function runNpm(name: string, args: string[], cwd: string): Promise<void> {
  console.log(`\n${name}: npm ${args.join(" ")}`);
  const command = process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : "npm";
  const commandArgs = process.platform === "win32" ? ["/d", "/s", "/c", ["npm", ...args].join(" ")] : args;
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd,
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
      reject(new Error(`${name} failed with exit code ${code}`));
    });
  });
}
