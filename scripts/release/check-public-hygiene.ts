import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

type StatusEntry = {
  status: string;
  path: string;
};

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, "../..");
const errors: string[] = [];

const forbiddenPathRules: Array<{ label: string; test: (filePath: string) => boolean }> = [
  { label: "private legacy media", test: (filePath) => hasPathPrefix(filePath, "assets/private/") },
  { label: "private legacy data", test: (filePath) => hasPathPrefix(filePath, "data/private/") },
  { label: "legacy media", test: (filePath) => hasPathPrefix(filePath, "assets/legacy/") },
  { label: "legacy data", test: (filePath) => hasPathPrefix(filePath, "data/legacy/") },
  { label: "legacy shelter media", test: (filePath) => hasPathPrefix(filePath, "assets/shelter/") },
  { label: "legacy shelter data", test: (filePath) => filePath === "data/shelter_pets.json" },
  { label: "legacy presentation artifact", test: (filePath) => hasPathPrefix(filePath, "assets/presentation/") },
  { label: "legacy xiaobai media", test: (filePath) => hasPathPrefix(filePath, "assets/pets/pet_xiaobai/") },
  { label: "legacy xiaobai data", test: (filePath) => hasPathPrefix(filePath, "data/pets/pet_xiaobai/") },
  { label: "generated output", test: (filePath) => hasPathPrefix(filePath, "outputs/") },
  {
    label: "local pet frames",
    test: (filePath) => /^data\/pets\/[^/]+\/frames\//.test(normalizeGitPath(filePath)),
  },
  {
    label: "local pet events",
    test: (filePath) => /^data\/pets\/[^/]+\/events\//.test(normalizeGitPath(filePath)),
  },
  {
    label: "local pet reports",
    test: (filePath) => /^data\/pets\/[^/]+\/reports\//.test(normalizeGitPath(filePath)),
  },
  {
    label: "alpha preview artifact",
    test: (filePath) => /\.(alpha_preview|alpha_contact_sheet)\.jpg$/i.test(filePath),
  },
  {
    label: "checker preview artifact",
    test: (filePath) => /_preview_checker\.png$/i.test(filePath),
  },
];

const forbiddenFileRules: Array<{ label: string; test: (filePath: string) => boolean }> = [
  {
    label: "local environment file",
    test: (filePath) => filePath !== ".env.example" && /^\.env(?:\.|$)/.test(filePath),
  },
  { label: "private key file", test: (filePath) => /\.(key|pem)$/i.test(filePath) },
];

const gitAvailable = await hasGitMetadata();
const candidateFiles = gitAvailable ? await gitCandidateFiles() : await filesystemCandidateFiles();
if (gitAvailable) {
  const statusEntries = await gitStatusEntries();
  checkStatusEntries(statusEntries);
} else {
  checkFilesystemEntries(candidateFiles);
}
await checkSecretContent(candidateFiles);

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`ERROR ${error}`);
  }
  process.exit(1);
}

console.log("public hygiene check passed");

async function hasGitMetadata(): Promise<boolean> {
  try {
    await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: repoRoot,
      windowsHide: true,
    });
    return true;
  } catch {
    return false;
  }
}

async function gitStatusEntries(): Promise<StatusEntry[]> {
  const { stdout } = await execFileAsync("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
    cwd: repoRoot,
    windowsHide: true,
  });
  return stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => parseStatusLine(line));
}

function parseStatusLine(line: string): StatusEntry[] {
  const status = line.slice(0, 2);
  const rawPath = line.slice(3).trim();
  if (rawPath.includes(" -> ")) {
    return rawPath.split(" -> ").map((filePath) => ({ status, path: unquoteGitPath(filePath) }));
  }
  return [{ status, path: unquoteGitPath(rawPath) }];
}

function checkStatusEntries(entries: StatusEntry[]): void {
  for (const entry of entries) {
    const filePath = normalizeGitPath(entry.path);
    const deletionOnly = isDeletionOnly(entry.status);
    for (const rule of forbiddenPathRules) {
      if (rule.test(filePath) && !deletionOnly) {
        errors.push(`${filePath} is ${rule.label}; remove it from the public release surface`);
      }
    }
    for (const rule of forbiddenFileRules) {
      if (rule.test(filePath) && !deletionOnly) {
        errors.push(`${filePath} is a ${rule.label}; do not commit it`);
      }
    }
  }
}

function checkFilesystemEntries(files: string[]): void {
  for (const filePath of files) {
    for (const rule of forbiddenPathRules) {
      if (rule.test(filePath)) {
        errors.push(`${filePath} is ${rule.label}; remove it from the public release surface`);
      }
    }
    for (const rule of forbiddenFileRules) {
      if (rule.test(filePath)) {
        errors.push(`${filePath} is a ${rule.label}; do not publish it`);
      }
    }
  }
}

function isDeletionOnly(status: string): boolean {
  return /^[ D]{2}$/.test(status) && status.includes("D");
}

async function gitCandidateFiles(): Promise<string[]> {
  const { stdout } = await execFileAsync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    cwd: repoRoot,
    windowsHide: true,
  });
  return stdout
    .split(/\r?\n/)
    .map((line) => normalizeGitPath(line.trim()))
    .filter(Boolean)
    .filter((filePath) => shouldScanTextFile(filePath));
}

async function filesystemCandidateFiles(): Promise<string[]> {
  const files: string[] = [];
  await walkDirectory(repoRoot, files);
  return files.map((filePath) => normalizeGitPath(path.relative(repoRoot, filePath))).sort((a, b) => a.localeCompare(b));
}

async function walkDirectory(directory: string, files: string[]): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = normalizeGitPath(path.relative(repoRoot, absolutePath));
    if (entry.isDirectory()) {
      if (shouldSkipDirectory(relativePath)) {
        continue;
      }
      await walkDirectory(absolutePath, files);
      continue;
    }
    if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
}

function shouldSkipDirectory(relativePath: string): boolean {
  return (
    relativePath === ".git" ||
    relativePath === "node_modules" ||
    relativePath === "apps/desktop/node_modules" ||
    relativePath.endsWith("/node_modules")
  );
}

async function checkSecretContent(files: string[]): Promise<void> {
  for (const filePath of files) {
    const text = await readTextIfPossible(filePath);
    if (text === undefined) {
      continue;
    }
    checkSecretTokens(filePath, text);
    checkSecretAssignments(filePath, text);
  }
}

async function readTextIfPossible(filePath: string): Promise<string | undefined> {
  try {
    const buffer = await readFile(path.join(repoRoot, filePath));
    if (buffer.includes(0)) {
      return undefined;
    }
    return buffer.toString("utf8");
  } catch {
    return undefined;
  }
}

function checkSecretTokens(filePath: string, text: string): void {
  const secretMatches = text.match(/\bsk-[A-Za-z0-9_-]{20,}\b/g) ?? [];
  for (const match of secretMatches) {
    errors.push(`${filePath} contains a value that looks like a real API secret (${redact(match)})`);
  }

  if (/[A-Za-z]:\\[^\r\n]*(HuaweiMoveData|夏令营|黑客松)/.test(text)) {
    errors.push(`${filePath} contains a local hackathon workspace path; replace it with a public placeholder`);
  }

  const rawMediaMatches = text.match(/\b[a-f0-9]{32}\.mp4\b/gi) ?? [];
  for (const match of rawMediaMatches) {
    errors.push(`${filePath} contains a raw generated media filename (${match}); replace it with a public placeholder`);
  }
}

function checkSecretAssignments(filePath: string, text: string): void {
  const assignmentPattern =
    /^(OPENAI_API_KEY|PETPRESENCE_VIDEO_API_KEY|IE_CRS_API_KEY)[^\S\r\n]*=[^\S\r\n]*(.*)$/gm;
  let match: RegExpExecArray | null;
  while ((match = assignmentPattern.exec(text)) !== null) {
    const key = match[1] ?? "API_KEY";
    const value = (match[2] ?? "").trim().replace(/^['"]|['"]$/g, "");
    if (!value || isPlaceholderSecretValue(value)) {
      continue;
    }
    errors.push(`${filePath} assigns a non-placeholder value to ${key}; remove the secret before release`);
  }
}

function isPlaceholderSecretValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "..." ||
    normalized === "<api-key>" ||
    normalized === "<your-api-key>" ||
    normalized === "your_api_key_here" ||
    normalized === "replace_me" ||
    normalized === "not configured"
  );
}

function shouldScanTextFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return [
    "",
    ".cjs",
    ".css",
    ".html",
    ".js",
    ".json",
    ".md",
    ".mjs",
    ".ps1",
    ".ts",
    ".txt",
    ".yaml",
    ".yml",
  ].includes(ext);
}

function hasPathPrefix(filePath: string, prefix: string): boolean {
  return normalizeGitPath(filePath).startsWith(prefix);
}

function normalizeGitPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function unquoteGitPath(filePath: string): string {
  if (filePath.startsWith('"') && filePath.endsWith('"')) {
    return filePath.slice(1, -1).replace(/\\"/g, '"');
  }
  return filePath;
}

function redact(value: string): string {
  if (value.length <= 10) {
    return "***";
  }
  return `${value.slice(0, 5)}...${value.slice(-4)}`;
}
