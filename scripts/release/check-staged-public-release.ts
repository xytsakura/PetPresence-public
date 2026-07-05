import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

type StagedEntry = {
  status: string;
  path: string;
};

const execFileAsync = promisify(execFile);
const repoRoot = process.cwd();
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
  { label: "local pet frames", test: (filePath) => /^data\/pets\/[^/]+\/frames\//.test(filePath) },
  { label: "local pet events", test: (filePath) => /^data\/pets\/[^/]+\/events\//.test(filePath) },
  { label: "local pet reports", test: (filePath) => /^data\/pets\/[^/]+\/reports\//.test(filePath) },
  { label: "alpha preview artifact", test: (filePath) => /\.(alpha_preview|alpha_contact_sheet)\.jpg$/i.test(filePath) },
  { label: "checker preview artifact", test: (filePath) => /_preview_checker\.png$/i.test(filePath) },
];

const forbiddenFileRules: Array<{ label: string; test: (filePath: string) => boolean }> = [
  {
    label: "local environment file",
    test: (filePath) => filePath !== ".env.example" && /^\.env(?:\.|$)/.test(filePath),
  },
  { label: "private key file", test: (filePath) => /\.(key|pem)$/i.test(filePath) },
];

const stagedEntries = await readStagedEntries();
if (stagedEntries.length === 0) {
  console.log("staged public release check passed: no staged files");
  process.exit(0);
}

checkStagedPaths(stagedEntries);
await checkStagedTextContent(stagedEntries);

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`ERROR ${error}`);
  }
  process.exit(1);
}

console.log(`staged public release check passed: ${stagedEntries.length} staged entries reviewed`);

async function readStagedEntries(): Promise<StagedEntry[]> {
  const { stdout } = await execFileAsync("git", ["diff", "--cached", "--name-status"], {
    cwd: repoRoot,
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 32,
  });

  return stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => parseNameStatusLine(line));
}

function parseNameStatusLine(line: string): StagedEntry[] {
  const parts = line.split("\t");
  const status = parts[0] ?? "";
  if (status.startsWith("R") || status.startsWith("C")) {
    const oldPath = normalizeGitPath(parts[1] ?? "");
    const newPath = normalizeGitPath(parts[2] ?? "");
    return [
      { status: "D", path: oldPath },
      { status: status[0] ?? "M", path: newPath },
    ].filter((entry) => entry.path);
  }

  const filePath = normalizeGitPath(parts[1] ?? "");
  return filePath ? [{ status, path: filePath }] : [];
}

function checkStagedPaths(entries: StagedEntry[]): void {
  for (const entry of entries) {
    const filePath = normalizeGitPath(entry.path);
    const deletionOnly = entry.status === "D";
    for (const rule of forbiddenPathRules) {
      if (rule.test(filePath) && !deletionOnly) {
        errors.push(`${filePath} is staged as ${rule.label}; unstage it before the public release commit`);
      }
    }
    for (const rule of forbiddenFileRules) {
      if (rule.test(filePath) && !deletionOnly) {
        errors.push(`${filePath} is staged as a ${rule.label}; unstage it before committing`);
      }
    }
  }
}

async function checkStagedTextContent(entries: StagedEntry[]): Promise<void> {
  for (const entry of entries) {
    if (entry.status === "D" || !shouldScanTextFile(entry.path)) {
      continue;
    }
    const text = await readStagedTextIfPossible(entry.path);
    if (text === undefined) {
      continue;
    }
    checkSecretTokens(entry.path, text);
    checkSecretAssignments(entry.path, text);
  }
}

async function readStagedTextIfPossible(filePath: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("git", ["show", `:${filePath}`], {
      cwd: repoRoot,
      encoding: "buffer",
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 32,
    });
    const buffer = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
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
    errors.push(`${filePath} contains a local hackathon workspace path; unstage it before committing`);
  }

  const rawMediaMatches = text.match(/\b[a-f0-9]{32}\.mp4\b/gi) ?? [];
  for (const match of rawMediaMatches) {
    errors.push(`${filePath} contains a raw generated media filename (${match}); unstage it before committing`);
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
    errors.push(`${filePath} assigns a non-placeholder value to ${key}; unstage the secret before committing`);
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

function redact(value: string): string {
  if (value.length <= 10) {
    return "***";
  }
  return `${value.slice(0, 5)}...${value.slice(-4)}`;
}
