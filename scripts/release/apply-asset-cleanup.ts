import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

type CleanupAction = "git-rm" | "delete-local";

type CleanupPlanItem = {
  path: string;
  git_status: "tracked" | "untracked";
  cleanup_action: "keep" | "git-rm" | "delete-local" | "replace" | "decide";
  release_decision: string;
};

type CleanupPlan = {
  items: CleanupPlanItem[];
};

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, "../..");
const flags = readFlags(process.argv.slice(2));
const action = actionFlag(flags);
const apply = booleanFlag("apply");
const keepLocal = booleanFlag("keep-local");
const limit = numberFlag("limit", Number.POSITIVE_INFINITY);

const plan = await readCleanupPlan();
const targets = plan.items
  .filter((item) => item.cleanup_action === action)
  .slice(0, limit)
  .map((item) => ({
    ...item,
    absolutePath: safeRepoPath(item.path),
  }));

printPreview(targets);

if (!apply) {
  console.log("");
  console.log("Dry run only. Add --apply to execute this action.");
  process.exit(0);
}

if (targets.length === 0) {
  console.log("No targets to clean.");
  process.exit(0);
}

if (action === "git-rm") {
  await runGitRm(targets.map((item) => item.path));
} else {
  await deleteLocalFiles(targets.map((item) => item.absolutePath));
}

console.log(`Applied cleanup action "${action}" to ${targets.length} item(s).`);

async function readCleanupPlan(): Promise<CleanupPlan> {
  const tsxPath = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
  const planScript = path.join(repoRoot, "scripts", "release", "plan-asset-cleanup.ts");
  const { stdout } = await execFileAsync(process.execPath, [tsxPath, planScript, "--json"], {
    cwd: repoRoot,
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 16,
  });
  const jsonStart = stdout.indexOf("{");
  if (jsonStart < 0) {
    throw new Error("release:plan-cleanup did not return JSON");
  }
  return JSON.parse(stdout.slice(jsonStart)) as CleanupPlan;
}

function printPreview(targets: Array<CleanupPlanItem & { absolutePath: string }>): void {
  console.log("PetPresence cleanup apply");
  console.log("");
  console.log(`Action: ${action}`);
  console.log(`Mode: ${apply ? "apply" : "dry-run"}`);
  console.log(`Targets: ${targets.length}`);
  console.log("");
  for (const item of targets.slice(0, 80)) {
    console.log(`- ${item.path}`);
  }
  if (targets.length > 80) {
    console.log(`- ... ${targets.length - 80} more item(s) not shown.`);
  }
}

async function runGitRm(repoRelativePaths: string[]): Promise<void> {
  const args = keepLocal ? ["rm", "--cached", "--", ...repoRelativePaths] : ["rm", "--", ...repoRelativePaths];
  await execFileAsync("git", args, {
    cwd: repoRoot,
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 16,
  });
}

async function deleteLocalFiles(absolutePaths: string[]): Promise<void> {
  for (const absolutePath of absolutePaths) {
    await rm(absolutePath, { force: true });
  }
}

function safeRepoPath(repoRelativePath: string): string {
  const normalized = repoRelativePath.replace(/\\/g, "/");
  if (path.isAbsolute(normalized) || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new Error(`Unsafe cleanup path: ${repoRelativePath}`);
  }
  const absolutePath = path.resolve(repoRoot, normalized);
  const relative = path.relative(repoRoot, absolutePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Cleanup path escapes repository: ${repoRelativePath}`);
  }
  return absolutePath;
}

function actionFlag(flags: Set<string>): CleanupAction {
  const actionArg = [...flags].find((flag) => flag.startsWith("action="));
  const value = actionArg ? actionArg.slice("action=".length) : "";
  if (value === "git-rm" || value === "delete-local") {
    return value;
  }
  throw new Error("Use --action=git-rm or --action=delete-local");
}

function readFlags(args: string[]): Set<string> {
  return new Set(args.filter((arg) => arg.startsWith("--")).map((arg) => arg.slice(2)));
}

function booleanFlag(name: string): boolean {
  return flags.has(name);
}

function numberFlag(name: string, fallback: number): number {
  const flag = [...flags].find((entry) => entry.startsWith(`${name}=`));
  if (!flag) {
    return fallback;
  }
  const value = Number(flag.slice(name.length + 1));
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`--${name} must be a non-negative number`);
  }
  return value;
}
