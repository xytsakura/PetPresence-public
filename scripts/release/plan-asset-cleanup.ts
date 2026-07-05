import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

type ReleaseDecision = "keep" | "remove" | "replace" | "pending" | "none";
type GitStatus = "tracked" | "untracked";

type AuditItem = {
  path: string;
  git_status: GitStatus;
  size_bytes: number;
  category: string;
  reason: string;
  recommendation: string;
  release_decision: ReleaseDecision;
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
  by_release_decision: Record<string, number>;
  items: AuditItem[];
};

type CleanupAction = "keep" | "git-rm" | "delete-local" | "replace" | "decide";

type CleanupPlanItem = {
  path: string;
  git_status: GitStatus;
  size_bytes: number;
  release_decision: ReleaseDecision;
  cleanup_action: CleanupAction;
  category: string;
  reason: string;
  note: string;
};

type CleanupPlan = {
  summary: {
    candidate_file_count: number;
    reviewed_file_count: number;
    unresolved_file_count: number;
    blocking_file_count: number;
    by_cleanup_action: Record<CleanupAction, number>;
    by_release_decision: Record<string, number>;
  };
  items: CleanupPlanItem[];
};

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, "../..");
const flags = readFlags(process.argv.slice(2));
const jsonOutput = booleanFlag("json");
const writeMd = booleanFlag("write-md");

const audit = await readAuditSummary();
const plan = createCleanupPlan(audit);

if (jsonOutput) {
  console.log(JSON.stringify(plan, null, 2));
} else {
  printHumanPlan(plan);
}

if (writeMd) {
  const outputPath = path.join(repoRoot, "docs", "release_cleanup_plan.md");
  await writeFile(outputPath, renderMarkdownPlan(plan), "utf8");
  console.error(`Wrote ${path.relative(repoRoot, outputPath).replace(/\\/g, "/")}`);
}

async function readAuditSummary(): Promise<AuditSummary> {
  const tsxPath = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
  const auditScript = path.join(repoRoot, "scripts", "release", "audit-public-assets.ts");
  const { stdout } = await execFileAsync(process.execPath, [tsxPath, auditScript, "--json"], {
    cwd: repoRoot,
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 16,
  });
  const jsonStart = stdout.indexOf("{");
  if (jsonStart < 0) {
    throw new Error("release:audit-assets did not return JSON");
  }
  return JSON.parse(stdout.slice(jsonStart)) as AuditSummary;
}

function createCleanupPlan(audit: AuditSummary): CleanupPlan {
  const items = audit.items.map((item): CleanupPlanItem => {
    const cleanupAction = cleanupActionFor(item);
    return {
      path: item.path,
      git_status: item.git_status,
      size_bytes: item.size_bytes,
      release_decision: item.release_decision,
      cleanup_action: cleanupAction,
      category: item.category,
      reason: item.reason,
      note: noteFor(item, cleanupAction),
    };
  });

  const byCleanupAction = {
    keep: 0,
    "git-rm": 0,
    "delete-local": 0,
    replace: 0,
    decide: 0,
  } satisfies Record<CleanupAction, number>;

  for (const item of items) {
    byCleanupAction[item.cleanup_action] += 1;
  }

  return {
    summary: {
      candidate_file_count: audit.candidate_file_count,
      reviewed_file_count: audit.reviewed_file_count,
      unresolved_file_count: audit.unresolved_file_count,
      blocking_file_count: audit.blocking_file_count,
      by_cleanup_action: byCleanupAction,
      by_release_decision: audit.by_release_decision,
    },
    items,
  };
}

function cleanupActionFor(item: AuditItem): CleanupAction {
  if (item.release_decision === "keep") {
    return "keep";
  }
  if (item.release_decision === "remove") {
    return item.git_status === "tracked" ? "git-rm" : "delete-local";
  }
  if (item.release_decision === "replace") {
    return "replace";
  }
  return "decide";
}

function noteFor(item: AuditItem, cleanupAction: CleanupAction): string {
  if (cleanupAction === "keep") {
    return item.decision_note || "Keep in public release.";
  }
  if (cleanupAction === "git-rm") {
    return "Remove from the public release with git rm, or move to a private archive before committing.";
  }
  if (cleanupAction === "delete-local") {
    return "Delete the local untracked file or keep it ignored/private before release.";
  }
  if (cleanupAction === "replace") {
    return item.decision_note || "Replace with a synthetic or explicitly publishable fixture.";
  }
  return item.decision_note || "Make a final keep/remove/replace decision.";
}

function printHumanPlan(plan: CleanupPlan): void {
  console.log("PetPresence asset cleanup plan");
  console.log("");
  console.log(`Candidate files: ${plan.summary.candidate_file_count}`);
  console.log(`Reviewed files: ${plan.summary.reviewed_file_count}`);
  console.log(`Unresolved files: ${plan.summary.unresolved_file_count}`);
  console.log(`Files not approved to keep: ${plan.summary.blocking_file_count}`);
  console.log("");
  console.log("By cleanup action:");
  for (const [action, count] of Object.entries(plan.summary.by_cleanup_action)) {
    console.log(`- ${action}: ${count}`);
  }
  console.log("");
  console.log("Priority cleanup items:");
  for (const item of priorityItems(plan.items).slice(0, 40)) {
    console.log(`- [${item.cleanup_action}/${item.git_status}] ${item.path} - ${item.note}`);
  }
  if (plan.items.length > 40) {
    console.log(`- ... ${plan.items.length - 40} total reviewed items not shown. Run with --json for the full plan.`);
  }
}

function renderMarkdownPlan(plan: CleanupPlan): string {
  const lines: string[] = [
    "# Release Cleanup Plan",
    "",
    "This file is generated by `npm run release:plan-cleanup -- --write-md`.",
    "It is a review aid for the open-source release. It does not delete, move, or replace files.",
    "",
    "## Summary",
    "",
    `- Candidate files: ${plan.summary.candidate_file_count}`,
    `- Reviewed files: ${plan.summary.reviewed_file_count}`,
    `- Unresolved files: ${plan.summary.unresolved_file_count}`,
    `- Files not approved to keep: ${plan.summary.blocking_file_count}`,
    "",
    "## By Cleanup Action",
    "",
    "| Action | Count | Meaning |",
    "| --- | ---: | --- |",
    `| keep | ${plan.summary.by_cleanup_action.keep} | Keep in the public release. |`,
    `| git-rm | ${plan.summary.by_cleanup_action["git-rm"]} | Remove tracked files from the public release. |`,
    `| delete-local | ${plan.summary.by_cleanup_action["delete-local"]} | Delete or keep private untracked local files. |`,
    `| replace | ${plan.summary.by_cleanup_action.replace} | Replace with synthetic or explicitly publishable fixtures. |`,
    `| decide | ${plan.summary.by_cleanup_action.decide} | Still needs a final keep/remove/replace decision. |`,
    "",
  ];

  appendSection(lines, "Tracked Files To Remove", plan.items.filter((item) => item.cleanup_action === "git-rm"), 40);
  appendSection(lines, "Untracked Local Files To Delete Or Keep Private", plan.items.filter((item) => item.cleanup_action === "delete-local"), 40);
  appendSection(lines, "Files To Replace", plan.items.filter((item) => item.cleanup_action === "replace"), 40);
  appendSection(lines, "Files Still Needing A Decision", plan.items.filter((item) => item.cleanup_action === "decide"), 40);
  appendSection(lines, "Files Approved To Keep", plan.items.filter((item) => item.cleanup_action === "keep"), 40);

  lines.push(
    "## Next Steps",
    "",
    "1. Keep `pet_demo` and cleaned `pet_bichon_demo` as the public fixtures.",
    "2. Keep private legacy workspaces, source MP4 clips, frames, reports, preview artifacts, and shelter assets out of Git.",
    "3. Re-run `npm run release:audit-assets -- --fail-on-unresolved` until every reviewed file is approved to keep.",
    "",
  );

  return `${lines.join("\n")}\n`;
}

function appendSection(lines: string[], title: string, items: CleanupPlanItem[], limit: number): void {
  const sorted = priorityItems(items);
  lines.push(`## ${title}`, "");
  if (sorted.length === 0) {
    lines.push("No items.", "");
    return;
  }

  lines.push("| Path | Status | Category | Note |", "| --- | --- | --- | --- |");
  for (const item of sorted.slice(0, limit)) {
    lines.push(
      `| \`${escapePipes(item.path)}\` | ${item.git_status} | ${item.category} | ${escapePipes(item.note)} |`,
    );
  }
  if (sorted.length > limit) {
    lines.push(`| ... | ... | ... | ${sorted.length - limit} more items. Use \`npm run release:plan-cleanup -- --json\` for the full list. |`);
  }
  lines.push("");
}

function escapePipes(value: string): string {
  return value.replace(/\|/g, "\\|");
}

function priorityItems(items: CleanupPlanItem[]): CleanupPlanItem[] {
  const rank: Record<CleanupAction, number> = {
    "git-rm": 0,
    "delete-local": 1,
    replace: 2,
    decide: 3,
    keep: 4,
  };
  return [...items].sort((a, b) => {
    const actionOrder = rank[a.cleanup_action] - rank[b.cleanup_action];
    if (actionOrder !== 0) {
      return actionOrder;
    }
    return b.size_bytes - a.size_bytes || a.path.localeCompare(b.path);
  });
}

function readFlags(args: string[]): Set<string> {
  return new Set(args.filter((arg) => arg.startsWith("--")).map((arg) => arg.slice(2)));
}

function booleanFlag(name: string): boolean {
  return flags.has(name);
}
