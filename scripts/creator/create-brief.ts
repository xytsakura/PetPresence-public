import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

type Flags = Record<string, string | boolean>;

type PetProfile = {
  pet_id?: string;
  name?: string;
  species?: string;
  description?: string;
};

const repoRoot = path.resolve(import.meta.dirname, "../..");
const flags = readFlags(process.argv.slice(2));
const petId = requiredFlag(flags, "pet-id");
assertSafeId(petId, "pet-id");

const force = booleanFlag(flags, "force");
const profile = await readProfile(petId);
const petName = stringFlag(flags, "name", profile.name || petId);
const species = stringFlag(flags, "species", profile.species || "other");
const personality = stringFlag(flags, "personality", profile.description || "TBD");
const actions = parseList(stringFlag(flags, "actions", "idle,sleep,eat,play"));
const existingMedia = parseList(stringFlag(flags, "media", "TBD"));
const videoApi = stringFlag(flags, "video-api", "not configured");
const uploadConsent = stringFlag(flags, "upload-consent", "ask every time before uploading pet media");
const localOnly = booleanFlag(flags, "local-only", true);
const outputPath = path.join(repoRoot, "data", "pets", petId, "creator_brief.md");

await writeTextIfAllowed(outputPath, `${renderBrief()}\n`, force);

console.log(`Creator brief: ${toRepoRelative(outputPath)}`);
console.log(`Next: review ${toRepoRelative(outputPath)} with the user before generating or uploading media.`);

function renderBrief(): string {
  return [
    `# ${petName} Creator Brief`,
    "",
    "This brief is the user-confirmed starting point for an Agent-assisted PetPresence workflow.",
    "It does not call a video API, upload media, or register assets. Review it before generating prompts or using external providers.",
    "",
    "## Pet Identity",
    "",
    `- pet_id: ${petId}`,
    `- name: ${petName}`,
    `- species: ${species}`,
    `- personality: ${personality}`,
    `- local_only_default: ${String(localOnly)}`,
    "",
    "## Requested Actions",
    "",
    ...actions.map((action) => `- ${action}`),
    "",
    "## Available Media",
    "",
    ...existingMedia.map((item) => `- ${item}`),
    "",
    "## Video Generation",
    "",
    `- video_api_status: ${videoApi}`,
    `- upload_consent: ${uploadConsent}`,
    "- provider_boundary: Do not upload reference images or videos unless the user explicitly confirms that provider and upload.",
    "- api_key_boundary: Do not write real API keys into repository files, docs, screenshots, or issues.",
    "",
    "## Privacy Boundary",
    "",
    "- Treat `assets/pets/<pet_id>/` as private user media unless the user confirms publication rights.",
    "- Treat `outputs/`, extracted frames, event logs, and generated reports as private local data.",
    "- Do not commit paid-model outputs unless the provider terms and user permission allow publication.",
    "- Do not make medical, psychological, health, or safety diagnosis claims.",
    "",
    "## Acceptance Checks",
    "",
    "- `npm run pet:doctor -- --pet-id <pet_id>` has no `ERROR`.",
    "- `npm run pet:validate -- --pet-id <pet_id>` passes.",
    "- `npm --prefix apps/desktop run smoke -- --pet-id <pet_id>` passes.",
    "- `npm run desktop -- --pet-id <pet_id>` opens a preview the user can inspect.",
    "- The user can identify which files are private and should not be committed.",
    "",
    "## Recommended Next Commands",
    "",
    "```powershell",
    `npm run pet:scaffold-actions -- --pet-id ${petId} --actions ${actions.join(",")}`,
    `npm run pet:doctor -- --pet-id ${petId}`,
    "```",
  ].join("\n");
}

async function readProfile(id: string): Promise<PetProfile> {
  const profilePath = path.join(repoRoot, "data", "pets", id, "profile.json");
  if (!(await exists(profilePath))) {
    throw new Error(`Missing profile.json. Run: npm run pet:init -- --pet-id ${id} --name <name>`);
  }
  return JSON.parse(await readFile(profilePath, "utf8")) as PetProfile;
}

async function writeTextIfAllowed(filePath: string, value: string, allowOverwrite: boolean): Promise<void> {
  if (!allowOverwrite && (await exists(filePath))) {
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

function parseList(value: string): string[] {
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? [...new Set(items)] : ["TBD"];
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
