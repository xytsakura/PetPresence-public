import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

type GitStatus = {
  code: string;
  path: string;
  originalPath?: string;
};

type StageDecision = "stage" | "keep-deleted" | "do-not-stage" | "manual-review";

type StagePlanItem = {
  path: string;
  status: string;
  decision: StageDecision;
  group: string;
  note: string;
};

type StagePlan = {
  summary: Record<StageDecision, number>;
  items: StagePlanItem[];
};

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, "../..");
const flags = readFlags(process.argv.slice(2));
const jsonOutput = flags.has("json");
const writeMd = flags.has("write-md");
const stagePlanPath = "docs/first_public_stage_plan.md";

const status = await readGitStatus();
const plan = createStagePlan(status);

if (jsonOutput) {
  console.log(JSON.stringify(plan, null, 2));
} else {
  printHumanPlan(plan);
}

if (writeMd) {
  const outputPath = path.join(repoRoot, "docs", "first_public_stage_plan.md");
  await writeFile(outputPath, renderMarkdown(plan), "utf8");
  console.error(`Wrote ${toRepoRelative(outputPath)}`);
}

async function readGitStatus(): Promise<GitStatus[]> {
  const { stdout } = await execFileAsync("git", ["status", "--porcelain", "--untracked-files=all"], {
    cwd: repoRoot,
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 32,
  });

  return stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const code = line.slice(0, 2);
      const rawPath = line.slice(3);
      if (rawPath.includes(" -> ")) {
        const [originalPath, newPath] = rawPath.split(" -> ", 2);
        return { code, path: newPath ?? rawPath, originalPath };
      }
      return { code, path: rawPath };
    });
}

function createStagePlan(status: GitStatus[]): StagePlan {
  const items = status.filter((item) => normalizeGitPath(item.path) !== stagePlanPath).map((item) => classify(item));
  const summary: Record<StageDecision, number> = {
    stage: 0,
    "keep-deleted": 0,
    "do-not-stage": 0,
    "manual-review": 0,
  };
  for (const item of items) {
    summary[item.decision] += 1;
  }
  return {
    summary,
    items: items.sort(compareItems),
  };
}

function classify(item: GitStatus): StagePlanItem {
  const normalized = item.path.replace(/\\/g, "/");
  const deleted = item.code.includes("D");

  if (isForbiddenPrivatePath(normalized)) {
    return {
      path: normalized,
      status: item.code,
      decision: deleted ? "keep-deleted" : "do-not-stage",
      group: "private-or-legacy-media",
      note: deleted
        ? "Keep this deletion staged for the public release; do not restore this private/legacy material."
        : "Do not stage this path for the public release unless release decisions and publication rights are updated.",
    };
  }

  if (isGeneratedPrivatePath(normalized)) {
    return {
      path: normalized,
      status: item.code,
      decision: "do-not-stage",
      group: "generated-private-output",
      note: "Keep generated outputs, frames, events, reports, and local env files private.",
    };
  }

  if (isOldRootLegacyDoc(normalized)) {
    return {
      path: normalized,
      status: item.code,
      decision: deleted ? "keep-deleted" : "manual-review",
      group: "legacy-doc-move",
      note: deleted
        ? "Keep the root-level legacy doc deletion; the public copy should live under docs/legacy-hackathon/."
        : "Check whether this belongs under docs/legacy-hackathon/ instead of the root docs surface.",
    };
  }

  if (isPublicReleasePath(normalized)) {
    return {
      path: normalized,
      status: item.code,
      decision: "stage",
      group: "public-release-surface",
      note: "Intended first public release surface or release tooling.",
    };
  }

  if (isExperimentalCodePath(normalized)) {
    return {
      path: normalized,
      status: item.code,
      decision: "stage",
      group: "experimental-labelled-code",
      note: "Stage only if the related docs continue to mark this module experimental or legacy.",
    };
  }

  return {
    path: normalized,
    status: item.code,
    decision: "manual-review",
    group: "uncategorized",
    note: "Review manually before staging.",
  };
}

function isForbiddenPrivatePath(filePath: string): boolean {
  return [
    "assets/private/",
    "data/private/",
    "assets/legacy/",
    "data/legacy/",
    "assets/shelter/",
    "data/shelter_pets.json",
    "assets/presentation/",
    "assets/pets/pet_xiaobai/",
    "data/pets/pet_xiaobai/",
  ].some((prefix) => filePath === prefix.replace(/\/$/, "") || filePath.startsWith(prefix));
}

function isGeneratedPrivatePath(filePath: string): boolean {
  return (
    filePath === ".env" ||
    (filePath.startsWith(".env.") && filePath !== ".env.example") ||
    filePath.startsWith("outputs/") ||
    filePath.includes("/frames/") ||
    filePath.includes("/events/") ||
    filePath.includes("/reports/") ||
    filePath.endsWith(".alpha_preview.jpg") ||
    filePath.endsWith(".alpha_contact_sheet.jpg") ||
    filePath.endsWith("_preview_checker.png")
  );
}

function isOldRootLegacyDoc(filePath: string): boolean {
  return [
    "docs/demo_runbook.md",
    "docs/hackathon_benchmark_cases.md",
    "docs/petpresence_engineering_experiment.md",
    "docs/petpresence_mvp_engineering_slice.md",
    "docs/petpresence_one_page_intro.md",
    "docs/petpresence_phase1_experiment_plan.md",
    "docs/petpresence_project_plan.md",
  ].includes(filePath);
}

function isPublicReleasePath(filePath: string): boolean {
  if (
    [
      ".env.example",
      ".gitignore",
      "README.md",
      "README.zh-CN.md",
      "CONTRIBUTORS.md",
      "CHANGELOG.md",
      "CONTRIBUTING.md",
      "LICENSE",
      "PRIVACY.md",
      "package.json",
      "package-lock.json",
      "tsconfig.json",
      "AGENTS.md",
    ].includes(filePath)
  ) {
    return true;
  }

  return (
    filePath.startsWith(".github/") ||
    filePath.startsWith("apps/desktop/") ||
    filePath.startsWith("assets/pets/pet_demo/") ||
    filePath.startsWith("assets/pets/pet_bichon_demo/") ||
    filePath.startsWith("data/pets/pet_demo/") ||
    filePath.startsWith("data/pets/pet_bichon_demo/") ||
    filePath.startsWith("docs/") ||
    filePath.startsWith("packages/") ||
    filePath.startsWith("scripts/assets/") ||
    filePath.startsWith("scripts/creator/") ||
    filePath.startsWith("scripts/providers/") ||
    filePath.startsWith("scripts/release/")
  );
}

function isExperimentalCodePath(filePath: string): boolean {
  return (
    filePath.startsWith("apps/web/") ||
    filePath.startsWith("prompts/") ||
    filePath.startsWith("scripts/demo/") ||
    filePath.startsWith("scripts/observer/") ||
    filePath.startsWith("services/event-server/") ||
    filePath.startsWith("services/observer/")
  );
}

function compareItems(a: StagePlanItem, b: StagePlanItem): number {
  const rank: Record<StageDecision, number> = {
    "do-not-stage": 0,
    "keep-deleted": 1,
    "manual-review": 2,
    stage: 3,
  };
  return rank[a.decision] - rank[b.decision] || a.group.localeCompare(b.group) || a.path.localeCompare(b.path);
}

function printHumanPlan(plan: StagePlan): void {
  console.log("PetPresence first public release stage plan");
  console.log("");
  for (const [decision, count] of Object.entries(plan.summary)) {
    console.log(`- ${decision}: ${count}`);
  }
  console.log("");
  for (const section of ["do-not-stage", "keep-deleted", "manual-review", "stage"] satisfies StageDecision[]) {
    const items = plan.items.filter((item) => item.decision === section);
    console.log(`${section}:`);
    if (items.length === 0) {
      console.log("- none");
    } else {
      for (const item of items.slice(0, 50)) {
        console.log(`- [${item.status.trim() || "??"}/${item.group}] ${item.path} - ${item.note}`);
      }
      if (items.length > 50) {
        console.log(`- ... ${items.length - 50} more. Run with --json for the full plan.`);
      }
    }
    console.log("");
  }
}

function renderMarkdown(plan: StagePlan): string {
  const lines: string[] = [
    "# First Public Release Stage Plan",
    "",
    "This file is generated by `npm run release:stage-plan -- --write-md`.",
    "It is a non-destructive review aid. It does not run `git add`, `git rm`, or `git commit`.",
    "",
    "## Summary",
    "",
    `- Stage: ${plan.summary.stage}`,
    `- Keep deleted: ${plan.summary["keep-deleted"]}`,
    `- Do not stage: ${plan.summary["do-not-stage"]}`,
    `- Manual review: ${plan.summary["manual-review"]}`,
    "",
  ];

  appendSection(lines, "Do Not Stage", plan.items.filter((item) => item.decision === "do-not-stage"));
  appendSection(lines, "Keep Deleted", plan.items.filter((item) => item.decision === "keep-deleted"));
  appendSection(lines, "Manual Review", plan.items.filter((item) => item.decision === "manual-review"));
  appendSection(lines, "Suggested Stage", plan.items.filter((item) => item.decision === "stage"));

  lines.push(
    "## Safe Use",
    "",
    "1. Review this plan before staging the first public release.",
    "2. Stage files by topic, not all at once.",
    "3. After staging, inspect `git diff --cached --name-status`.",
    "4. If private legacy workspaces, shelter media, presentation artifacts, `outputs/`, frames, events, reports, `.env`, or real API keys appear as additions, stop and unstage them.",
    "",
  );

  return `${lines.join("\n")}\n`;
}

function appendSection(lines: string[], title: string, items: StagePlanItem[]): void {
  lines.push(`## ${title}`, "");
  if (items.length === 0) {
    lines.push("No items.", "");
    return;
  }
  lines.push("| Path | Status | Group | Note |", "| --- | --- | --- | --- |");
  for (const item of items.slice(0, 120)) {
    lines.push(`| \`${escapePipes(item.path)}\` | \`${item.status}\` | ${item.group} | ${escapePipes(item.note)} |`);
  }
  if (items.length > 120) {
    lines.push(`| ... | ... | ... | ${items.length - 120} more items. Use \`npm run release:stage-plan -- --json\` for the full list. |`);
  }
  lines.push("");
}

function escapePipes(value: string): string {
  return value.replace(/\|/g, "\\|");
}

function toRepoRelative(filePath: string): string {
  return path.relative(repoRoot, filePath).replace(/\\/g, "/");
}

function normalizeGitPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function readFlags(args: string[]): Set<string> {
  return new Set(args.filter((arg) => arg.startsWith("--")).map((arg) => arg.slice(2)));
}
