import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

type Flags = Record<string, string | boolean>;

type PetProfile = {
  pet_id?: string;
  name?: string;
  species?: string;
  description?: string;
};

type ActionPlan = {
  title: string;
  motion: string;
  loop: boolean;
  durationMs: number;
  message: string;
};

const repoRoot = path.resolve(import.meta.dirname, "../..");
const flags = readFlags(process.argv.slice(2));
const petId = requiredFlag(flags, "pet-id");
assertSafeId(petId, "pet-id");

const force = booleanFlag(flags, "force");
const actions = parseActions(stringFlag(flags, "actions", "idle,sleep,eat,play"));
const profile = await readProfile(petId);
const petName = stringFlag(flags, "name", profile.name || petId);
const species = stringFlag(flags, "species", profile.species || "pet");
const description = stringFlag(flags, "description", profile.description || "");
const dataDir = path.join(repoRoot, "data", "pets", petId);
const promptDir = path.join(dataDir, "prompts");
const planPath = path.join(dataDir, "action_plan.md");

await mkdir(promptDir, { recursive: true });

const sections: string[] = [
  `# ${petName} Action Plan`,
  "",
  "This file is generated for an Agent-assisted PetPresence workflow.",
  "It does not call a video API, upload media, or register assets. Use it to prepare prompts and source clips.",
  "",
  "## Pet",
  "",
  `- pet_id: ${petId}`,
  `- name: ${petName}`,
  `- species: ${species}`,
  `- description: ${description || "TBD"}`,
  "",
  "## Actions",
  "",
];

for (const action of actions) {
  const plan = actionPlan(action);
  const prompt = buildPrompt({ action, description, petName, plan, species });
  const promptPath = path.join(promptDir, `${action}.txt`);
  await writeTextIfAllowed(promptPath, `${prompt}\n`, force);

  sections.push(
    `### ${action}`,
    "",
    `- purpose: ${plan.title}`,
    `- motion: ${plan.motion}`,
    `- loop: ${plan.loop}`,
    `- duration_ms: ${plan.durationMs}`,
    `- fallback_message: ${plan.message}`,
    `- prompt_file: ${toRepoRelative(promptPath)}`,
    "",
    "Suggested local synthetic provider command:",
    "",
    "```powershell",
    `npm run provider:example -- --pet-id ${petId} --action ${action} --prompt-file "${toRepoRelative(promptPath)}"`,
    "```",
    "",
    "After a real or synthetic provider writes an MP4, register it with:",
    "",
    "```powershell",
    [
      "npm run pet:add-action --",
      `--pet-id ${petId}`,
      `--action ${action}`,
      `--input "outputs/generated/${petId}/${action}.mp4"`,
      "--convert-alpha",
      `--loop ${String(plan.loop)}`,
      `--duration-ms ${plan.durationMs}`,
      `--message "${plan.message}"`,
    ].join(" "),
    "```",
    "",
  );
}

sections.push(
  "## Final Checks",
  "",
  "```powershell",
  `npm run pet:doctor -- --pet-id ${petId}`,
  `npm run pet:validate -- --pet-id ${petId}`,
  `npm run desktop -- --pet-id ${petId}`,
  "```",
  "",
);

await writeTextIfAllowed(planPath, `${sections.join("\n")}\n`, force);

console.log(`Action plan: ${toRepoRelative(planPath)}`);
console.log(`Prompt files: ${toRepoRelative(promptDir)}`);
console.log(`Actions: ${actions.join(", ")}`);
console.log(`Next: review ${toRepoRelative(planPath)}`);

async function readProfile(id: string): Promise<PetProfile> {
  const profilePath = path.join(repoRoot, "data", "pets", id, "profile.json");
  if (!(await exists(profilePath))) {
    throw new Error(`Missing profile.json. Run: npm run pet:init -- --pet-id ${id} --name <name>`);
  }
  return JSON.parse(await readFile(profilePath, "utf8")) as PetProfile;
}

function actionPlan(action: string): ActionPlan {
  const known: Record<string, ActionPlan> = {
    idle: {
      title: "default calm presence",
      motion: "front-facing, mostly still, subtle breathing, tiny head or body movement",
      loop: true,
      durationMs: 4000,
      message: "I am here~",
    },
    sleep: {
      title: "quiet resting state",
      motion: "lying down or curled up, eyes closed or sleepy, subtle breathing",
      loop: true,
      durationMs: 4000,
      message: "I am sleeping~",
    },
    eat: {
      title: "short eating action",
      motion: "lowering head, nibbling, or reacting gently to food",
      loop: false,
      durationMs: 3500,
      message: "I am eating~",
    },
    play: {
      title: "small playful action",
      motion: "tiny jump, turn, paw movement, or playful reaction",
      loop: false,
      durationMs: 3500,
      message: "Let's play~",
    },
    alert: {
      title: "attention cue",
      motion: "looking up, turning toward the viewer, or making a small attentive movement",
      loop: false,
      durationMs: 3000,
      message: "Please check on me~",
    },
    out_of_view: {
      title: "temporarily away",
      motion: "stepping away, peeking from the edge, or returning into view",
      loop: false,
      durationMs: 3000,
      message: "I stepped away~",
    },
    wave_paw: {
      title: "friendly greeting",
      motion: "raising one paw or making a tiny greeting movement",
      loop: false,
      durationMs: 3000,
      message: "Hi~",
    },
  };
  return (
    known[action] ?? {
      title: `custom ${action} action`,
      motion: "a clear, gentle, short motion that matches the action name",
      loop: false,
      durationMs: 3500,
      message: "I am here~",
    }
  );
}

function buildPrompt(input: {
  action: string;
  description: string;
  petName: string;
  plan: ActionPlan;
  species: string;
}): string {
  const description = input.description.trim().replace(/[.。]+$/, "");
  return [
    `Create a short ${(input.plan.durationMs / 1000).toFixed(1)}-second video of ${input.petName}, a ${input.species}, for a desktop pet "${input.action}" animation.`,
    description ? `Pet identity notes: ${description}.` : "Keep the pet identity consistent with the provided reference images.",
    `Motion: ${input.plan.motion}.`,
    "Keep the camera stable and the full body visible.",
    "Use a clean plain background with soft lighting.",
    "The pet should remain recognizable and centered enough for foreground extraction.",
    "No text, no watermark, no subtitles, no extra objects, no camera shake.",
  ].join("\n");
}

function parseActions(value: string): string[] {
  const actions = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (actions.length === 0) {
    throw new Error("--actions must include at least one action");
  }
  for (const action of actions) {
    assertSafeId(action, "actions");
  }
  return [...new Set(actions)];
}

async function writeTextIfAllowed(filePath: string, value: string, force: boolean): Promise<void> {
  if (!force && (await exists(filePath))) {
    console.log(`Keep existing file: ${toRepoRelative(filePath)}`);
    return;
  }
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, value, "utf8");
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

function requiredFlag(flags: Flags, key: string): string {
  const value = flags[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`--${key} is required`);
  }
  return value.trim();
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
