import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

type Flags = Record<string, string | boolean>;

type CheckStatus = "ok" | "warn" | "error";

type CheckResult = {
  status: CheckStatus;
  label: string;
  detail: string;
};

type DoctorReport = {
  schema_version: 1;
  pet_id: string | null;
  require_alpha: boolean;
  summary: Record<CheckStatus, number>;
  checks: CheckResult[];
};

type ActionAssetsConfig = {
  pet_id?: string;
  default_action?: string;
  idle_action?: string;
  assets?: Record<
    string,
    {
      type?: string;
      path?: string;
      transparent_background?: boolean;
      loop?: boolean;
      duration_ms?: number;
      fallback_message?: string;
    }
  >;
};

const repoRoot = path.resolve(import.meta.dirname, "../..");
const flags = readFlags(process.argv.slice(2));
const petId = stringFlag(flags, "pet-id", "");
const requireAlpha = booleanFlag(flags, "require-alpha");
const jsonOutput = booleanFlag(flags, "json");

const results: CheckResult[] = [];

await checkProjectFiles();
await checkNodeVersion();
await checkCommand("npm", ["--version"], "npm", "required for install and project scripts");
await checkPowerShell();
await checkDesktopInstall();
await checkFfmpeg();

if (petId) {
  assertSafeId(petId, "pet-id");
  await checkPet(petId);
}

if (jsonOutput) {
  printJsonResults(results);
} else {
  printResults(results);
}

const errorCount = results.filter((result) => result.status === "error").length;
if (errorCount > 0) {
  process.exit(1);
}

async function checkProjectFiles(): Promise<void> {
  await checkFile("package.json", "root package manifest");
  await checkFile("package-lock.json", "root lockfile for npm ci");
  await checkFile(".env.example", "public config template");
  await checkFile(path.join("apps", "desktop", "package.json"), "desktop package manifest");
  await checkFile(path.join("apps", "desktop", "package-lock.json"), "desktop lockfile for npm ci");
}

async function checkFile(relativePath: string, detail: string): Promise<void> {
  const fullPath = path.join(repoRoot, relativePath);
  if (existsSync(fullPath)) {
    results.push({ status: "ok", label: relativePath, detail });
    return;
  }
  results.push({ status: "error", label: relativePath, detail: `missing ${detail}` });
}

async function checkNodeVersion(): Promise<void> {
  const version = process.versions.node;
  const major = Number(version.split(".")[0]);
  if (Number.isFinite(major) && major >= 22) {
    results.push({ status: "ok", label: "node", detail: `v${version}` });
    return;
  }
  results.push({ status: "warn", label: "node", detail: `v${version}; Node.js >= 22 is recommended` });
}

async function checkPowerShell(): Promise<void> {
  if (process.platform === "win32") {
    await checkCommand("powershell.exe", ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"], "powershell", "required for MP4 alpha conversion scripts");
    return;
  }
  await checkCommand("pwsh", ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"], "pwsh", "required for MP4 alpha conversion scripts outside Windows", "warn");
}

async function checkDesktopInstall(): Promise<void> {
  const desktopNodeModules = path.join(repoRoot, "apps", "desktop", "node_modules");
  if (existsSync(desktopNodeModules)) {
    results.push({ status: "ok", label: "apps/desktop/node_modules", detail: "desktop dependencies are installed" });
    return;
  }
  results.push({
    status: "warn",
    label: "apps/desktop/node_modules",
    detail: "missing desktop dependencies; run: npm --prefix apps/desktop install",
  });
}

async function checkFfmpeg(): Promise<void> {
  const envPath = process.env.FFMPEG_PATH || process.env.FFMPEG_BIN;
  if (envPath && existsSync(envPath)) {
    results.push({ status: "ok", label: "ffmpeg", detail: `using ${envPath}` });
    return;
  }

  try {
    const module = await import("ffmpeg-static");
    const candidate = module.default || module;
    if (typeof candidate === "string" && existsSync(candidate)) {
      results.push({ status: "ok", label: "ffmpeg", detail: `using ffmpeg-static at ${candidate}` });
      return;
    }
  } catch {
    // Continue to the warning/error below.
  }

  results.push({
    status: requireAlpha ? "error" : "warn",
    label: "ffmpeg",
    detail: "not found; set FFMPEG_PATH or run npm install before MP4 alpha conversion",
  });
}

async function checkPet(id: string): Promise<void> {
  const profilePath = path.join(repoRoot, "data", "pets", id, "profile.json");
  const configPath = path.join(repoRoot, "data", "pets", id, "action_assets.json");

  if (!(await exists(profilePath))) {
    results.push({ status: "error", label: `pet:${id}:profile`, detail: "missing profile.json" });
  } else {
    results.push({ status: "ok", label: `pet:${id}:profile`, detail: toRepoRelative(profilePath) });
  }

  if (!(await exists(configPath))) {
    results.push({ status: "error", label: `pet:${id}:manifest`, detail: "missing action_assets.json" });
    return;
  }

  let config: ActionAssetsConfig;
  try {
    config = JSON.parse(await readFile(configPath, "utf8")) as ActionAssetsConfig;
  } catch (error) {
    results.push({
      status: "error",
      label: `pet:${id}:manifest`,
      detail: `invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    });
    return;
  }

  if (config.pet_id !== id) {
    results.push({ status: "error", label: `pet:${id}:manifest`, detail: `pet_id must be "${id}"` });
  } else {
    results.push({ status: "ok", label: `pet:${id}:manifest`, detail: toRepoRelative(configPath) });
  }

  await checkCreatorPipelineFiles(id);

  const assets = config.assets ?? {};
  const assetEntries = Object.entries(assets);
  if (assetEntries.length === 0) {
    results.push({ status: "warn", label: `pet:${id}:assets`, detail: "no actions registered yet" });
    return;
  }

  if (!config.default_action || !assets[config.default_action]) {
    results.push({ status: "error", label: `pet:${id}:default_action`, detail: "default_action must point to a registered action" });
  } else {
    results.push({ status: "ok", label: `pet:${id}:default_action`, detail: config.default_action });
  }

  for (const [action, asset] of assetEntries) {
    if (!asset.path) {
      results.push({ status: "error", label: `pet:${id}:${action}`, detail: "asset path is missing" });
      continue;
    }
    const assetPath = path.resolve(repoRoot, asset.path);
    if (!(await exists(assetPath))) {
      results.push({ status: "error", label: `pet:${id}:${action}`, detail: `missing ${asset.path}` });
      continue;
    }
    const assetStat = await stat(assetPath);
    const ext = path.extname(asset.path).toLowerCase().slice(1);
    const typeMatches = asset.type === ext;
    const alphaNote = asset.transparent_background === false && ext === "mp4" ? "; source MP4 is not transparent" : "";
    results.push({
      status: typeMatches ? "ok" : "error",
      label: `pet:${id}:${action}`,
      detail: `${asset.path} (${formatBytes(assetStat.size)})${typeMatches ? alphaNote : `; type should be ${ext}`}`,
    });
  }
}

async function checkCreatorPipelineFiles(id: string): Promise<void> {
  const dataDir = path.join(repoRoot, "data", "pets", id);
  const creatorBriefPath = path.join(dataDir, "creator_brief.md");
  const actionPlanPath = path.join(dataDir, "action_plan.md");
  const promptDir = path.join(dataDir, "prompts");

  await checkCreatorTextFile(
    `pet:${id}:creator_brief`,
    creatorBriefPath,
    "missing creator_brief.md; run pet:create-brief before provider planning",
  );
  await checkCreatorTextFile(
    `pet:${id}:action_plan`,
    actionPlanPath,
    "missing action_plan.md; run pet:scaffold-actions before provider planning",
  );

  if (!(await exists(promptDir))) {
    results.push({
      status: "warn",
      label: `pet:${id}:prompts`,
      detail: "missing prompts directory; run pet:scaffold-actions before provider planning",
    });
    return;
  }

  let promptEntries: string[];
  try {
    promptEntries = (await readdir(promptDir)).filter((entry) => entry.endsWith(".txt")).sort();
  } catch (error) {
    results.push({
      status: "warn",
      label: `pet:${id}:prompts`,
      detail: `could not read prompts directory: ${error instanceof Error ? error.message : String(error)}`,
    });
    return;
  }

  if (promptEntries.length === 0) {
    results.push({
      status: "warn",
      label: `pet:${id}:prompts`,
      detail: "prompts directory has no .txt files; run pet:scaffold-actions with desired actions",
    });
    return;
  }

  const emptyPrompts: string[] = [];
  for (const entry of promptEntries) {
    const promptPath = path.join(promptDir, entry);
    const promptText = await readFile(promptPath, "utf8");
    if (promptText.trim().length === 0) {
      emptyPrompts.push(entry);
    }
  }

  if (emptyPrompts.length > 0) {
    results.push({
      status: "warn",
      label: `pet:${id}:prompts`,
      detail: `empty prompt files: ${emptyPrompts.join(", ")}`,
    });
    return;
  }

  results.push({
    status: "ok",
    label: `pet:${id}:prompts`,
    detail: `${promptEntries.length} prompt file(s): ${promptEntries.join(", ")}`,
  });
}

async function checkCreatorTextFile(label: string, filePath: string, missingDetail: string): Promise<void> {
  if (!(await exists(filePath))) {
    results.push({ status: "warn", label, detail: missingDetail });
    return;
  }
  const fileText = await readFile(filePath, "utf8");
  if (fileText.trim().length === 0) {
    results.push({ status: "warn", label, detail: `${toRepoRelative(filePath)} is empty` });
    return;
  }
  results.push({ status: "ok", label, detail: toRepoRelative(filePath) });
}

async function checkCommand(
  command: string,
  args: string[],
  label: string,
  detail: string,
  missingStatus: CheckStatus = "error",
): Promise<void> {
  const result = command === "npm" ? await runNpm(args) : await run(command, args);
  if (result.ok) {
    const output = result.output.trim().split(/\r?\n/)[0] ?? "";
    results.push({ status: "ok", label, detail: output ? `${output}; ${detail}` : detail });
    return;
  }
  results.push({ status: missingStatus, label, detail: `${detail}; ${result.output || result.error}` });
}

async function runNpm(args: string[]): Promise<{ ok: true; output: string } | { ok: false; output: string; error: string }> {
  if (process.platform === "win32") {
    return await run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", ["npm", ...args].join(" ")]);
  }
  return await run("npm", args);
}

async function run(command: string, args: string[]): Promise<{ ok: true; output: string } | { ok: false; output: string; error: string }> {
  return await new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      shell: false,
      windowsHide: true,
    });
    let output = "";
    child.stdout?.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", (error) => {
      resolve({ ok: false, output: output.trim(), error: error.message });
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ ok: true, output: output.trim() });
        return;
      }
      resolve({ ok: false, output: output.trim(), error: `exit code ${code}` });
    });
  });
}

function printResults(items: CheckResult[]): void {
  console.log("PetPresence doctor");
  console.log("");
  for (const item of items) {
    console.log(`${badge(item.status)} ${item.label} - ${item.detail}`);
  }
  console.log("");
  const ok = items.filter((item) => item.status === "ok").length;
  const warn = items.filter((item) => item.status === "warn").length;
  const error = items.filter((item) => item.status === "error").length;
  console.log(`Summary: ${ok} ok, ${warn} warn, ${error} error`);
}

function printJsonResults(items: CheckResult[]): void {
  const report: DoctorReport = {
    schema_version: 1,
    pet_id: petId || null,
    require_alpha: requireAlpha,
    summary: countStatuses(items),
    checks: items,
  };
  console.log(JSON.stringify(report, null, 2));
}

function countStatuses(items: CheckResult[]): Record<CheckStatus, number> {
  return {
    ok: items.filter((item) => item.status === "ok").length,
    warn: items.filter((item) => item.status === "warn").length,
    error: items.filter((item) => item.status === "error").length,
  };
}

function badge(status: CheckStatus): string {
  if (status === "ok") {
    return "OK";
  }
  if (status === "warn") {
    return "WARN";
  }
  return "ERROR";
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function readFlags(args: string[]): Flags {
  const values: Flags = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg?.startsWith("--")) {
      continue;
    }
    const parts = arg.slice(2).split("=", 2);
    const key = parts[0];
    const inlineValue = parts[1];
    if (!key) {
      continue;
    }
    const next = args[index + 1];
    if (inlineValue !== undefined) {
      values[key] = inlineValue;
    } else if (next && !next.startsWith("--")) {
      values[key] = next;
      index += 1;
    } else {
      values[key] = true;
    }
  }
  return values;
}

function stringFlag(flags: Flags, key: string, fallback: string): string {
  const value = flags[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function booleanFlag(flags: Flags, key: string, fallback = false): boolean {
  const value = flags[key];
  if (value === undefined) {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value;
  }
  return ["1", "true", "yes", "y"].includes(value.toLowerCase());
}

function assertSafeId(value: string, label: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error(`--${label} may only contain letters, numbers, underscores, and hyphens`);
  }
}

function toRepoRelative(filePath: string): string {
  return path.relative(repoRoot, filePath).replace(/\\/g, "/");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}
