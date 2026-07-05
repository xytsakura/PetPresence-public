import { execFile } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

type ReleaseDecision = "keep" | "remove" | "replace" | "pending";
type DecisionMatchType = "exact" | "prefix";

type DecisionRule = {
  match: string;
  match_type?: DecisionMatchType;
  decision: ReleaseDecision;
  note: string;
  owner?: string;
};

type DecisionFile = {
  version: 1;
  rules: DecisionRule[];
};

type AuditItem = {
  path: string;
  git_status: "tracked" | "untracked" | "filesystem";
  size_bytes: number;
  category: string;
  reason: string;
  recommendation: "keep-review" | "replace-or-remove" | "private-data" | "large-file-review";
  release_decision: ReleaseDecision | "none";
  decision_note?: string;
  decision_rule?: string;
};

type AuditSummary = {
  candidate_file_count: number;
  tracked_file_count: number;
  untracked_file_count: number;
  reviewed_file_count: number;
  unresolved_file_count: number;
  blocking_file_count: number;
  total_review_size_bytes: number;
  by_category: Record<string, number>;
  by_recommendation: Record<string, number>;
  by_release_decision: Record<string, number>;
  items: AuditItem[];
};

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, "../..");
const flags = readFlags(process.argv.slice(2));
const jsonOutput = booleanFlag("json");
const failOnUnresolved = booleanFlag("fail-on-unresolved");

const candidates = await gitCandidateFiles(["assets", "data", "outputs", "docs/images"]);
const decisionFile = await loadDecisionFile();
const items = await auditFiles(candidates, decisionFile.rules);
const summary = summarize(candidates, items);

if (jsonOutput) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  printHumanSummary(summary);
}

if (failOnUnresolved && summary.blocking_file_count > 0) {
  console.error("");
  console.error(
    `Release asset audit failed: ${summary.blocking_file_count} reviewed files are not approved to keep.`,
  );
  process.exitCode = 1;
}

async function gitLsFiles(paths: string[]): Promise<string[]> {
  const { stdout } = await execFileAsync("git", ["ls-files", ...paths], {
    cwd: repoRoot,
    windowsHide: true,
  });
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

async function gitUntrackedFiles(paths: string[]): Promise<string[]> {
  const { stdout } = await execFileAsync("git", ["ls-files", "--others", "--exclude-standard", ...paths], {
    cwd: repoRoot,
    windowsHide: true,
  });
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

async function gitCandidateFiles(paths: string[]): Promise<Map<string, AuditItem["git_status"]>> {
  const candidates = new Map<string, AuditItem["git_status"]>();
  try {
    for (const filePath of await gitLsFiles(paths)) {
      candidates.set(filePath, "tracked");
    }
    for (const filePath of await gitUntrackedFiles(paths)) {
      candidates.set(filePath, "untracked");
    }
  } catch (error) {
    if (!isMissingGitRepositoryError(error)) {
      throw error;
    }
    for (const filePath of await filesystemCandidateFiles(paths)) {
      candidates.set(filePath, "filesystem");
    }
  }
  return candidates;
}

async function filesystemCandidateFiles(paths: string[]): Promise<string[]> {
  const files: string[] = [];

  for (const rootPath of paths) {
    const absoluteRoot = path.join(repoRoot, rootPath);
    if (!(await pathExists(absoluteRoot))) {
      continue;
    }
    await walkFiles(absoluteRoot, rootPath, files);
  }

  return files.sort((a, b) => a.localeCompare(b));
}

async function walkFiles(absoluteDirectory: string, relativeDirectory: string, files: string[]): Promise<void> {
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(absoluteDirectory, entry.name);
    const relativePath = `${relativeDirectory}/${entry.name}`.replace(/\\/g, "/");
    if (entry.isDirectory()) {
      await walkFiles(absolutePath, relativePath, files);
      continue;
    }
    if (entry.isFile()) {
      files.push(relativePath);
    }
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function isMissingGitRepositoryError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const errorWithStderr = error as Error & { stderr?: string };
  const message = `${error.message}\n${errorWithStderr.stderr ?? ""}`;
  return message.includes("not a git repository");
}

async function loadDecisionFile(): Promise<DecisionFile> {
  const decisionPath = path.join(repoRoot, "docs", "release_asset_decisions.json");
  try {
    const raw = await readFile(decisionPath, "utf8");
    const parsed = JSON.parse(raw) as DecisionFile;
    if (parsed.version !== 1 || !Array.isArray(parsed.rules)) {
      throw new Error("expected version 1 with a rules array");
    }
    for (const rule of parsed.rules) {
      if (!rule.match || !rule.decision || !rule.note) {
        throw new Error(`invalid decision rule: ${JSON.stringify(rule)}`);
      }
      if (!["keep", "remove", "replace", "pending"].includes(rule.decision)) {
        throw new Error(`invalid decision value for ${rule.match}: ${rule.decision}`);
      }
      if (rule.match_type && !["exact", "prefix"].includes(rule.match_type)) {
        throw new Error(`invalid match_type for ${rule.match}: ${rule.match_type}`);
      }
    }
    return parsed;
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? (error as { code?: string }).code : "";
    if (code === "ENOENT") {
      return { version: 1, rules: [] };
    }
    throw error;
  }
}

async function auditFiles(files: Map<string, AuditItem["git_status"]>, decisionRules: DecisionRule[]): Promise<AuditItem[]> {
  const items: AuditItem[] = [];

  for (const [filePath, gitStatus] of files) {
    const normalized = filePath.replace(/\\/g, "/");
    const category = categorize(normalized);
    if (!category) {
      continue;
    }

    const absolutePath = path.join(repoRoot, normalized);
    const fileStat = await stat(absolutePath);
    const item: AuditItem = {
      path: normalized,
      git_status: gitStatus,
      size_bytes: fileStat.size,
      ...category,
      ...releaseDecisionFor(normalized, decisionRules),
    };

    if (fileStat.size >= 5 * 1024 * 1024 && item.recommendation === "keep-review") {
      item.recommendation = "large-file-review";
      item.reason = `${item.reason}; file is >= 5MB`;
    }

    items.push(item);
  }

  return items.sort((a, b) => {
    const recommendationOrder = recommendationRank(a.recommendation) - recommendationRank(b.recommendation);
    if (recommendationOrder !== 0) {
      return recommendationOrder;
    }
    return b.size_bytes - a.size_bytes || a.path.localeCompare(b.path);
  });
}

function releaseDecisionFor(
  filePath: string,
  decisionRules: DecisionRule[],
): Pick<AuditItem, "release_decision" | "decision_note" | "decision_rule"> {
  const matchingRules = decisionRules.filter((rule) => {
    const matchType = rule.match_type ?? "exact";
    if (matchType === "exact") {
      return filePath === rule.match;
    }
    return filePath.startsWith(rule.match);
  });

  if (matchingRules.length === 0) {
    return { release_decision: "none" };
  }

  matchingRules.sort((a, b) => b.match.length - a.match.length);
  const rule = matchingRules[0]!;
  return {
    release_decision: rule.decision,
    decision_note: rule.note,
    decision_rule: rule.match,
  };
}

function categorize(
  filePath: string,
): Omit<AuditItem, "path" | "git_status" | "size_bytes" | "release_decision"> | null {
  if (filePath === "data/shelter_pets.json") {
    return {
      category: "shelter-demo-data",
      reason: "legacy shelter demo data is not required for the default creator pipeline",
      recommendation: "replace-or-remove",
    };
  }

  if (
    /^data\/pets\/[^/]+\/(profile\.json|agent\.md|creator_brief\.md|action_assets\.json|action_plan\.md)$/.test(
      filePath,
    )
  ) {
    return {
      category: "pet-config",
      reason: "sample pet configuration should be reviewed for public demo fixture suitability",
      recommendation: "keep-review",
    };
  }

  if (/^data\/pets\/[^/]+\/prompts\/.+\.txt$/.test(filePath)) {
    return {
      category: "pet-config",
      reason: "sample pet configuration should be reviewed for public demo fixture suitability",
      recommendation: "keep-review",
    };
  }

  if (filePath.startsWith("outputs/")) {
    return {
      category: "generated-output",
      reason: "outputs/ is local generated data by default",
      recommendation: "private-data",
    };
  }

  if (/^data\/pets\/[^/]+\/events\//.test(filePath)) {
    return {
      category: "event-log",
      reason: "event JSONL may contain private observation history",
      recommendation: "private-data",
    };
  }

  if (/^data\/pets\/[^/]+\/frames\//.test(filePath)) {
    return {
      category: "observer-frame",
      reason: "extracted frames may contain private visual data",
      recommendation: "private-data",
    };
  }

  if (/^data\/pets\/[^/]+\/reports\//.test(filePath)) {
    return {
      category: "generated-report",
      reason: "reports are generated from private local events unless prepared as fixtures",
      recommendation: "private-data",
    };
  }

  if (/^assets\/pets\/[^/]+\/.+\.(mp4|webm|gif|png|jpg|jpeg|webp)$/i.test(filePath)) {
    return {
      category: "pet-media",
      reason: "pet media requires explicit publication rights",
      recommendation: "keep-review",
    };
  }

  if (/^assets\/shelter\/.+\.(png|jpg|jpeg|webp)$/i.test(filePath)) {
    return {
      category: "shelter-demo-media",
      reason: "legacy shelter demo media requires explicit publication rights",
      recommendation: "replace-or-remove",
    };
  }

  if (/^assets\/one_pager\/.+\.(html|pdf|png|jpg|jpeg)$/i.test(filePath)) {
    return {
      category: "presentation-artifact",
      reason: "presentation artifacts are not required for the default creator pipeline",
      recommendation: "replace-or-remove",
    };
  }

  if (/^docs\/images\/.+\.(png|jpg|jpeg|webp|gif)$/i.test(filePath)) {
    return {
      category: "readme-visual",
      reason: "README and documentation images require explicit publication review",
      recommendation: "keep-review",
    };
  }

  return null;
}

function summarize(candidates: Map<string, AuditItem["git_status"]>, items: AuditItem[]): AuditSummary {
  const byCategory: Record<string, number> = {};
  const byRecommendation: Record<string, number> = {};
  const byReleaseDecision: Record<string, number> = {};

  for (const item of items) {
    byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
    byRecommendation[item.recommendation] = (byRecommendation[item.recommendation] ?? 0) + 1;
    byReleaseDecision[item.release_decision] = (byReleaseDecision[item.release_decision] ?? 0) + 1;
  }

  return {
    candidate_file_count: candidates.size,
    tracked_file_count: [...candidates.values()].filter((status) => status === "tracked").length,
    untracked_file_count: [...candidates.values()].filter((status) => status === "untracked").length,
    reviewed_file_count: items.length,
    unresolved_file_count: items.filter(
      (item) => item.release_decision === "none" || item.release_decision === "pending",
    ).length,
    blocking_file_count: items.filter((item) => item.release_decision !== "keep").length,
    total_review_size_bytes: items.reduce((sum, item) => sum + item.size_bytes, 0),
    by_category: byCategory,
    by_recommendation: byRecommendation,
    by_release_decision: byReleaseDecision,
    items,
  };
}

function printHumanSummary(summary: AuditSummary): void {
  console.log("PetPresence public asset audit");
  console.log("");
  console.log(`Candidate files under assets/data/outputs/docs/images: ${summary.candidate_file_count}`);
  console.log(`Tracked candidate files: ${summary.tracked_file_count}`);
  console.log(`Untracked candidate files: ${summary.untracked_file_count}`);
  console.log(`Files requiring release review: ${summary.reviewed_file_count}`);
  console.log(`Files without final release decision: ${summary.unresolved_file_count}`);
  console.log(`Files not approved to keep: ${summary.blocking_file_count}`);
  console.log(`Review size: ${formatBytes(summary.total_review_size_bytes)}`);
  console.log("");
  console.log("By recommendation:");
  for (const [recommendation, count] of Object.entries(summary.by_recommendation)) {
    console.log(`- ${recommendation}: ${count}`);
  }
  console.log("");
  console.log("By release decision:");
  for (const [decision, count] of Object.entries(summary.by_release_decision)) {
    console.log(`- ${decision}: ${count}`);
  }
  console.log("");
  console.log("Top review items:");
  for (const item of summary.items.slice(0, 30)) {
    console.log(
      `- [${item.git_status}/${item.recommendation}/${item.release_decision}] ${item.path} (${formatBytes(item.size_bytes)}) - ${item.reason}`,
    );
  }
  if (summary.items.length > 30) {
    console.log(`- ... ${summary.items.length - 30} more items. Run with --json for the full list.`);
  }
}

function recommendationRank(recommendation: AuditItem["recommendation"]): number {
  const order: Record<AuditItem["recommendation"], number> = {
    "private-data": 0,
    "replace-or-remove": 1,
    "large-file-review": 2,
    "keep-review": 3,
  };
  return order[recommendation];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kib = bytes / 1024;
  if (kib < 1024) {
    return `${kib.toFixed(1)} KiB`;
  }
  const mib = kib / 1024;
  return `${mib.toFixed(2)} MiB`;
}

function readFlags(args: string[]): Set<string> {
  return new Set(args.filter((arg) => arg.startsWith("--")).map((arg) => arg.slice(2)));
}

function booleanFlag(name: string): boolean {
  return flags.has(name);
}
