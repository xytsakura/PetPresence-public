import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const errors: string[] = [];

const envExample = await readText(".env.example");
const contributing = await readText("CONTRIBUTING.md");

expectText(
  envExample,
  "The default creator pipeline runs with pet_demo and the local synthetic provider.",
  ".env.example must lead with the no-API creator pipeline default",
);
expectText(
  envExample,
  "It does not require paid APIs, media uploads, camera streams, or observer services.",
  ".env.example must make the no-paid-API/no-camera boundary explicit",
);
expectLine(envExample, "PETPRESENCE_PET_ID=pet_demo", ".env.example must default to the public demo pet");
expectLine(
  envExample,
  "PETPRESENCE_VIDEO_PROVIDER=example-local-synthetic",
  ".env.example must use the local synthetic provider as its placeholder",
);
expectLine(contributing, "npm run verify:quick", "CONTRIBUTING.md must point contributors to verify:quick");
expectLine(contributing, "npm run release:verify", "CONTRIBUTING.md must mention the full release gate");

forbidPattern(
  envExample,
  /^PETPRESENCE_PET_ID=pet_(private|legacy)/m,
  ".env.example must not default to private or legacy pet workspaces",
);
forbidSecretValue(envExample, "OPENAI_API_KEY");
forbidSecretValue(envExample, "PETPRESENCE_VIDEO_API_KEY");

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`ERROR ${error}`);
  }
  process.exit(1);
}

console.log("public config check passed");

async function readText(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

function expectLine(text: string, line: string, message: string): void {
  if (!text.split(/\r?\n/).includes(line)) {
    errors.push(message);
  }
}

function expectText(text: string, expected: string, message: string): void {
  if (!text.includes(expected)) {
    errors.push(message);
  }
}

function forbidLine(text: string, line: string, message: string): void {
  if (text.split(/\r?\n/).includes(line)) {
    errors.push(message);
  }
}

function forbidPattern(text: string, pattern: RegExp, message: string): void {
  if (pattern.test(text)) {
    errors.push(message);
  }
}

function forbidSecretValue(text: string, key: string): void {
  const match = text.match(new RegExp(`^${key}=(.+)$`, "m"));
  if (match?.[1]?.trim()) {
    errors.push(`${key} in .env.example must be empty`);
  }
}
