import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

type PackageJson = {
  name?: string;
  description?: string;
  license?: string;
  private?: boolean;
  repository?: { type?: string; url?: string };
  homepage?: string;
  bugs?: { url?: string };
  keywords?: string[];
  scripts?: Record<string, string>;
};

const repoRoot = path.resolve(import.meta.dirname, "../..");
const execFileAsync = promisify(execFile);
const errors: string[] = [];

await expectFile("README.md");
await expectFile("README.zh-CN.md");
await expectFile("CONTRIBUTORS.md");
await expectFile("CHANGELOG.md");
await expectFile("LICENSE");
await expectFile("PRIVACY.md");
await expectFile("CONTRIBUTING.md");
await expectFile(".env.example");
await expectFile(".github/workflows/ci.yml");
await expectFile(".github/PULL_REQUEST_TEMPLATE.md");
await expectFile(".github/ISSUE_TEMPLATE/config.yml");
await expectFile(".github/ISSUE_TEMPLATE/bug_report.yml");
await expectFile(".github/ISSUE_TEMPLATE/creator_pipeline_help.yml");
await expectFile(".github/ISSUE_TEMPLATE/provider_adapter.yml");
await expectFile(".github/ISSUE_TEMPLATE/media_privacy_review.yml");
await expectFile("docs/README.md");
await expectFile("docs/quickstart.md");
await expectFile("docs/open_source_creator_pipeline.md");
await expectFile("docs/user_guide_create_private_pet.md");
await expectFile("docs/agent-recipes/create-your-pet.md");
await expectFile("docs/provider-adapters.md");
await expectFile("docs/provider_adapter_cookbook.md");
await expectFile("docs/troubleshooting.md");
await expectFile("docs/maintainer_triage.md");
await expectFile("docs/release_checklist.md");
await expectFile("docs/media_and_data_policy.md");
await expectFile("docs/release_notes_template.md");
await expectFile("docs/packaging.md");
await expectFile("docs/first_public_release_runbook.md");
await expectFile("docs/first_public_stage_plan.md");
await expectFile("docs/open_source_release_audit.md");
await expectFile("docs/bichon_demo_resource_audit.md");
await expectFile("docs/release_asset_decisions.json");
await expectFile("docs/images/bichon-xiaobai.jpg");
await expectFile("docs/images/creator-pipeline-workflow.svg");
await expectFile("docs/images/bichon-demo-idle.png");
await expectFile("docs/images/bichon-demo-play.png");
await expectFile("docs/images/bichon-demo-sleep.png");
await expectFile("data/pets/pet_demo/profile.json");
await expectFile("data/pets/pet_demo/agent.md");
await expectFile("data/pets/pet_demo/creator_brief.md");
await expectFile("data/pets/pet_demo/action_plan.md");
await expectFile("data/pets/pet_demo/prompts/idle.txt");
await expectFile("data/pets/pet_demo/prompts/wave_paw.txt");
await expectFile("data/pets/pet_demo/action_assets.json");
await expectFile("assets/pets/pet_demo/idle/idle.webm");
await expectFile("assets/pets/pet_demo/wave_paw/wave_paw.webm");
await expectFile("data/pets/pet_bichon_demo/profile.json");
await expectFile("data/pets/pet_bichon_demo/agent.md");
await expectFile("data/pets/pet_bichon_demo/creator_brief.md");
await expectFile("data/pets/pet_bichon_demo/action_plan.md");
await expectFile("data/pets/pet_bichon_demo/action_assets.json");
for (const action of ["idle", "eat", "sleep", "alert", "play", "out_of_view"]) {
  await expectFile(`data/pets/pet_bichon_demo/prompts/${action}.txt`);
  await expectFile(`assets/pets/pet_bichon_demo/${action}/${action}.webm`);
}

const packageJson = await readJson<PackageJson>("package.json");
expectEqual(packageJson.name, "petpresence", "package.json name must be petpresence");
expectTruthy(packageJson.description, "package.json description is required");
expectEqual(packageJson.license, "MIT", "package.json license must be MIT");
expectTruthy(packageJson.repository?.url, "package.json repository.url is required");
expectTruthy(packageJson.homepage, "package.json homepage is required");
expectTruthy(packageJson.bugs?.url, "package.json bugs.url is required");
expectIncludes(packageJson.keywords ?? [], "desktop-pet", "package keywords must include desktop-pet");
expectIncludes(packageJson.keywords ?? [], "creator-pipeline", "package keywords must include creator-pipeline");

for (const scriptName of [
  "pet:init",
  "pet:add-action",
  "pet:validate",
  "pet:print-plan",
  "pet:doctor",
  "pet:create-brief",
  "pet:scaffold-actions",
  "provider:example",
  "provider:template",
  "provider:import",
  "provider:validate-result",
  "demo:bichon",
  "smoke:bichon",
  "smoke:provider-example",
  "smoke:provider-import",
  "smoke:public-hygiene",
  "smoke:staged-release",
  "smoke:creator",
  "smoke:creator-scaffold",
  "smoke:agent-pipeline",
  "smoke:quickstart",
  "smoke:creator-alpha",
  "release:stage-plan",
  "release:check-config",
  "release:check-hygiene",
  "release:check-staged",
  "release:readiness",
  "release:smoke-clean-export",
  "release:preflight",
  "verify:quick",
  "release:verify",
  "audit:root",
  "audit:desktop",
]) {
  expectTruthy(packageJson.scripts?.[scriptName], `package.json script ${scriptName} is required`);
}

const readme = await readText("README.md");
expectText(readme, "open-source creator pipeline", "README must present the creator pipeline");
expectText(readme, "README.zh-CN.md", "README must link to the Simplified Chinese README");
expectText(readme, "CONTRIBUTORS.md", "README must link to team acknowledgements");
expectText(readme, "docs/images/bichon-xiaobai.jpg", "README must show the public Bichon demo pet image");
expectText(readme, "docs/images/creator-pipeline-workflow.svg", "README must show the creator pipeline workflow diagram");
expectText(readme, "docs/images/bichon-demo-idle.png", "README must show the transparent Bichon idle demo preview");
expectText(readme, "docs/images/bichon-demo-play.png", "README must show the transparent Bichon play demo preview");
expectText(readme, "docs/images/bichon-demo-sleep.png", "README must show the transparent Bichon sleep demo preview");
expectText(readme, "two release surfaces", "README must describe both public release surfaces");
expectText(readme, "docs/quickstart.md", "README must point to quickstart");
expectText(readme, "pet_demo", "README must point to pet_demo as the public fixture");
expectText(readme, "pet_bichon_demo", "README must point to the public Bichon demo fixture");
expectText(readme, "npm run smoke:bichon", "README must document Bichon demo smoke");
expectText(readme, "npm run demo:bichon", "README must document Bichon demo launch");
expectText(readme, "npm run pet:doctor", "README must document the local doctor check");
expectText(readme, "npm run pet:create-brief", "README must document creator brief generation");
expectText(readme, "creator_brief.md", "README must describe the creator brief output");
expectText(readme, "prompts/*.txt", "README must state per-pet doctor checks prompt files");
expectText(readme, "npm run pet:doctor -- --pet-id pet_huahua --json", "README must document doctor JSON output");
expectText(readme, "npm run pet:validate -- --pet-id pet_huahua --json", "README must document validate JSON output");
expectText(readme, "npm run pet:scaffold-actions", "README must document action scaffolding");
expectText(readme, "npm run provider:import", "README must document local provider imports");
expectText(readme, "docs/provider_adapter_cookbook.md", "README must point to the provider adapter cookbook");
expectText(readme, "npm run smoke:agent-pipeline", "README must document the Agent pipeline smoke");
expectText(readme, "creator brief generation", "README must state Agent pipeline smoke covers creator brief generation");
expectText(readme, "npm run smoke:quickstart", "README must document the quickstart smoke");
expectText(readme, "docs/user_guide_create_private_pet.md", "README must point to the non-technical user guide");
expectText(readme, "docs/agent-recipes/create-your-pet.md", "README must point to the Agent recipe");
expectText(readme, "docs/troubleshooting.md", "README must point to troubleshooting");
expectText(readme, "docs/maintainer_triage.md", "README must point to maintainer triage guidance");
expectText(readme, "public hygiene checks", "README must explain public hygiene checks");
expectText(readme, "npm run release:preflight", "README must mention first-public-release preflight");
expectText(readme, "npm run release:check-staged", "README must mention staged public release check");
expectText(readme, "CHANGELOG.md", "README must link the changelog");

const contributing = await readText("CONTRIBUTING.md");
expectText(contributing, ".github/PULL_REQUEST_TEMPLATE.md", "CONTRIBUTING must point to the PR template");
expectText(contributing, "docs/maintainer_triage.md", "CONTRIBUTING must point to maintainer triage");
expectText(contributing, "npm run release:check-hygiene", "CONTRIBUTING must mention public hygiene check");
expectText(contributing, "npm run smoke:public-hygiene", "CONTRIBUTING must mention public hygiene smoke");
expectText(contributing, "private pet media", "CONTRIBUTING must preserve private media warning");

const agentRecipe = await readText("docs/agent-recipes/create-your-pet.md");
expectText(agentRecipe, "docs/user_guide_create_private_pet.md", "Agent recipe must point non-technical users to the user guide");
expectText(agentRecipe, "docs/troubleshooting.md", "Agent recipe must point to troubleshooting");
expectText(agentRecipe, "npm run pet:doctor", "Agent recipe must run pet:doctor before creating pets");
expectText(agentRecipe, "npm run pet:create-brief", "Agent recipe must document creator brief generation");
expectText(agentRecipe, "creator_brief.md", "Agent recipe must require user confirmation of the creator brief");
expectText(agentRecipe, "npm run pet:scaffold-actions", "Agent recipe must document action scaffolding");
expectText(agentRecipe, "npm run provider:import", "Agent recipe must document local provider imports");
expectText(agentRecipe, "docs/provider_adapter_cookbook.md", "Agent recipe must point to the provider adapter cookbook");
expectText(agentRecipe, "npm run smoke:agent-pipeline", "Agent recipe must document the Agent pipeline smoke");
expectText(agentRecipe, "生成 creator brief", "Agent recipe must state Agent pipeline smoke covers creator brief generation");
expectText(agentRecipe, "pet:doctor -- --pet-id", "Agent recipe must document per-pet doctor checks");
expectText(agentRecipe, "creator_brief`、`action_plan` 和 `prompts", "Agent recipe must state doctor checks creator planning files");
expectText(agentRecipe, "summary.error", "Agent recipe must explain doctor JSON summary usage");
expectText(agentRecipe, "summary.ok", "Agent recipe must explain validate JSON summary usage");

const changelog = await readText("CHANGELOG.md");
expectText(changelog, "## [0.1.0] - Unreleased", "CHANGELOG must include the current 0.1.0 release entry");
expectText(changelog, "creator pipeline", "CHANGELOG must describe the creator pipeline scope");
expectText(changelog, "pet:create-brief", "CHANGELOG must mention creator brief generation");
expectText(changelog, "creator brief, scaffold", "CHANGELOG must state Agent pipeline smoke covers creator brief");
expectText(changelog, "real-provider scaffold template", "CHANGELOG must mention the provider template");
expectText(changelog, "release:check-hygiene", "CHANGELOG must mention public hygiene check");
expectText(changelog, "release:check-staged", "CHANGELOG must mention staged public release check");
expectText(changelog, "smoke:staged-release", "CHANGELOG must mention staged release smoke");
expectText(changelog, "smoke:public-hygiene", "CHANGELOG must mention public hygiene smoke");
expectText(changelog, "release verification, runs clean export smoke", "CHANGELOG must mention release preflight scope");
expectText(changelog, "pet_bichon_demo", "CHANGELOG must mention the public Bichon demo");
expectText(changelog, "Packaged installers are future work", "CHANGELOG must preserve packaging limitation");

const docsIndex = await readText("docs/README.md");
expectText(docsIndex, "../CHANGELOG.md", "docs index must link the changelog");
expectText(docsIndex, "quickstart.md", "docs index must link quickstart");
expectText(docsIndex, "npm run release:preflight", "docs index must mention first-public-release preflight");
expectText(docsIndex, "npm run release:check-hygiene", "docs index must mention public hygiene check");
expectText(docsIndex, "npm run release:check-staged", "docs index must mention staged public release check");
expectText(docsIndex, "npm run smoke:staged-release", "docs index must mention staged release smoke");
expectText(docsIndex, "npm run smoke:public-hygiene", "docs index must mention public hygiene smoke");
expectText(docsIndex, "npm run smoke:quickstart", "docs index must mention the quickstart smoke");
expectText(docsIndex, "open_source_creator_pipeline.md", "docs index must link the creator pipeline design");
expectText(docsIndex, "user_guide_create_private_pet.md", "docs index must link the non-technical user guide");
expectText(docsIndex, "agent-recipes/create-your-pet.md", "docs index must link the Agent recipe");
expectText(docsIndex, "provider-adapters.md", "docs index must link provider adapters");
expectText(docsIndex, "provider_adapter_cookbook.md", "docs index must link provider adapter cookbook");
expectText(docsIndex, "troubleshooting.md", "docs index must link troubleshooting");
expectText(docsIndex, "maintainer_triage.md", "docs index must link maintainer triage");
expectText(docsIndex, "release_checklist.md", "docs index must link the release checklist");
expectText(docsIndex, "first_public_release_runbook.md", "docs index must link the first public release runbook");
expectText(docsIndex, "first_public_stage_plan.md", "docs index must link the first public stage plan");
expectText(docsIndex, "release_notes_template.md", "docs index must link release notes template");
expectText(docsIndex, "packaging.md", "docs index must link packaging notes");
expectText(docsIndex, "open_source_release_audit.md", "docs index must link release audit");
expectText(docsIndex, "bichon_demo_resource_audit.md", "docs index must link Bichon demo resource audit");

const releaseAudit = await readText("docs/open_source_release_audit.md");
expectText(releaseAudit, "verify:quick` 当前覆盖 17 个步骤", "release audit must reflect current quick verification step count");
expectText(releaseAudit, "release:verify` 当前覆盖 20 个步骤", "release audit must reflect current release verification step count");
expectText(releaseAudit, "pet_bichon_demo", "release audit must include public Bichon demo");
expectText(releaseAudit, "release:preflight", "release audit must include first-public-release preflight");
expectText(releaseAudit, "release:check-hygiene", "release audit must include public hygiene check");
expectText(releaseAudit, "release:check-staged", "release audit must include staged public release check");
expectText(releaseAudit, "smoke:public-hygiene", "release audit must include public hygiene smoke");
expectText(releaseAudit, "smoke:staged-release", "release audit must include staged release smoke");
expectText(releaseAudit, "31", "release audit must mention the current full public fixture and README visual count");

const readmeZhCn = await readText("README.zh-CN.md");
expectText(readmeZhCn, "README.md", "Chinese README must link back to English README");
expectText(readmeZhCn, "CONTRIBUTORS.md", "Chinese README must link to team acknowledgements");
expectText(readmeZhCn, "docs/images/creator-pipeline-workflow.svg", "Chinese README must show the creator pipeline workflow diagram");
expectText(readmeZhCn, "docs/images/bichon-demo-idle.png", "Chinese README must show the transparent Bichon idle demo preview");
expectText(readmeZhCn, "PetPresence 是一个开源的桌面宠物制作流程", "Chinese README must describe the project in Chinese");
expectText(readmeZhCn, "npm run smoke:bichon", "Chinese README must document the Bichon demo smoke");
expectText(readmeZhCn, "docs/user_guide_create_private_pet.md", "Chinese README must point to the non-technical user guide");
expectText(readmeZhCn, "npm run release:preflight", "Chinese README must document release preflight");

const firstPublicReleaseRunbook = await readText("docs/first_public_release_runbook.md");
expectText(firstPublicReleaseRunbook, "npm run release:preflight", "first public release runbook must include preflight");
expectText(firstPublicReleaseRunbook, "npm run release:check-hygiene", "first public release runbook must include public hygiene check");
expectText(firstPublicReleaseRunbook, "npm run release:check-staged", "first public release runbook must include staged public release check");
expectText(firstPublicReleaseRunbook, "npm run smoke:staged-release", "first public release runbook must include staged release smoke");
expectText(firstPublicReleaseRunbook, "npm run smoke:public-hygiene", "first public release runbook must include public hygiene smoke");
expectText(firstPublicReleaseRunbook, "npm run release:verify", "first public release runbook must include release verification");
expectText(firstPublicReleaseRunbook, "npm run release:smoke-clean-export", "first public release runbook must include clean export smoke");
expectText(firstPublicReleaseRunbook, "npm run release:stage-plan", "first public release runbook must include stage planning");
expectText(firstPublicReleaseRunbook, "private legacy workspaces", "first public release runbook must warn about private legacy pet media");
expectText(firstPublicReleaseRunbook, "pet_bichon_demo", "first public release runbook must include public Bichon demo fixture");
expectText(firstPublicReleaseRunbook, "9 个公开 fixture 文件", "first public release runbook must list the full pet_demo fixture shape");
expectText(firstPublicReleaseRunbook, "data/pets/pet_demo/creator_brief.md", "first public release runbook must include pet_demo creator brief");
expectText(firstPublicReleaseRunbook, "v0.1.0", "first public release runbook must include first tag guidance");

const demoCreatorBrief = await readText("data/pets/pet_demo/creator_brief.md");
expectText(demoCreatorBrief, "upload_consent", "pet_demo creator brief must document upload consent");
expectText(demoCreatorBrief, "Synthetic WebM fixture", "pet_demo creator brief must describe synthetic media");
expectText(demoCreatorBrief, "Acceptance Checks", "pet_demo creator brief must include acceptance checks");

const bichonManifest = await readText("data/pets/pet_bichon_demo/action_assets.json");
for (const action of ["idle", "eat", "sleep", "alert", "play", "out_of_view"]) {
  expectText(bichonManifest, `assets/pets/pet_bichon_demo/${action}/${action}.webm`, `pet_bichon_demo manifest must include ${action}`);
}
const bichonCreatorBrief = await readText("data/pets/pet_bichon_demo/creator_brief.md");
expectText(bichonCreatorBrief, "excludes original MP4 clips", "Bichon creator brief must exclude source MP4 clips");
expectText(bichonCreatorBrief, "extracted frames", "Bichon creator brief must exclude extracted frames");
expectText(bichonCreatorBrief, "event JSONL", "Bichon creator brief must exclude event logs");
expectText(bichonCreatorBrief, "generated reports", "Bichon creator brief must exclude generated reports");

const firstPublicStagePlan = await readText("docs/first_public_stage_plan.md");
expectText(firstPublicStagePlan, "non-destructive review aid", "first public stage plan must state it is non-destructive");
expectText(firstPublicStagePlan, "Do Not Stage", "first public stage plan must include do-not-stage section");
expectText(firstPublicStagePlan, "Keep Deleted", "first public stage plan must include keep-deleted section");
await expectCurrentStagePlanSummary(firstPublicStagePlan);

const userGuide = await readText("docs/user_guide_create_private_pet.md");
expectText(userGuide, "docs/quickstart.md", "user guide must point trial users to quickstart");
expectText(userGuide, "复制给 Agent 的启动提示词", "user guide must include a copy-paste Agent starter prompt");
expectText(userGuide, "creator_brief.md", "user guide must ask Agent to create and confirm creator brief");
expectText(userGuide, "是否允许上传宠物素材到视频模型", "user guide must include external upload consent");
expectText(userGuide, "npm run desktop -- --pet-id <pet_id>", "user guide must include desktop preview acceptance");
expectText(userGuide, "不要提交到公开仓库", "user guide must preserve private media boundary");

const providerAdapters = await readText("docs/provider-adapters.md");
expectText(providerAdapters, "scripts/providers/provider-template.ts", "provider docs must point to provider template");
expectText(providerAdapters, "explicit user confirmation", "provider docs must require upload confirmation");

const creatorPipeline = await readText("docs/open_source_creator_pipeline.md");
expectText(creatorPipeline, "9 个文件", "creator pipeline docs must describe the full public demo fixture shape");
expectText(creatorPipeline, "data/pets/pet_demo/creator_brief.md", "creator pipeline docs must include public demo creator brief");
expectText(creatorPipeline, "执行 `pet:create-brief`", "creator pipeline docs must include creator brief in Agent flow");
expectText(creatorPipeline, "provider:import", "creator pipeline docs must include provider import in Agent flow");

const mediaAndDataPolicy = await readText("docs/media_and_data_policy.md");
expectText(mediaAndDataPolicy, "9 files", "media and data policy must describe the full public demo fixture shape");
expectText(mediaAndDataPolicy, "data/pets/pet_demo/creator_brief.md", "media and data policy must include public demo creator brief");
expectText(mediaAndDataPolicy, "whole creator pipeline shape", "media and data policy must explain fixture purpose");

const providerCookbook = await readText("docs/provider_adapter_cookbook.md");
expectText(providerCookbook, "scripts/providers/provider-template.ts", "provider cookbook must point to provider template");
expectText(providerCookbook, "--confirm-upload", "provider cookbook must require explicit upload confirmation");
expectText(providerCookbook, "provider:validate-result", "provider cookbook must require contract validation");
expectText(providerCookbook, "不要把真实 API key", "provider cookbook must warn against committing real API keys");

const troubleshooting = await readText("docs/troubleshooting.md");
expectText(troubleshooting, "npm run pet:doctor", "troubleshooting must start with doctor diagnostics");
expectText(troubleshooting, "creator_brief", "troubleshooting must cover doctor creator brief warnings");
expectText(troubleshooting, "prompts", "troubleshooting must cover doctor prompt warnings");
expectText(troubleshooting, "pet:doctor -- --pet-id <pet_id> --json", "troubleshooting must mention doctor JSON output");
expectText(troubleshooting, "npm run pet:validate -- --pet-id <pet_id> --json", "troubleshooting must mention validate JSON output");
expectText(troubleshooting, "npm run provider:validate-result", "troubleshooting must cover provider validation");
expectText(troubleshooting, "npm run smoke:creator-alpha", "troubleshooting must cover alpha conversion smoke");
expectText(troubleshooting, "npm --prefix apps/desktop run smoke", "troubleshooting must cover desktop smoke");
expectText(troubleshooting, "npm run release:stage-plan", "troubleshooting must cover release staging diagnostics");
expectText(troubleshooting, "不要贴", "troubleshooting must warn against posting private data");

const quickstart = await readText("docs/quickstart.md");
expectText(quickstart, "npm run pet:doctor", "quickstart must check the environment");
expectText(quickstart, "The per-pet doctor should report", "quickstart must describe per-pet doctor planning checks");
expectText(quickstart, "npm run pet:doctor -- --pet-id pet_quickstart --json", "quickstart must mention doctor JSON output");
expectText(quickstart, "npm run pet:validate -- --pet-id pet_demo", "quickstart must validate pet_demo");
expectText(quickstart, "npm run pet:validate -- --pet-id pet_quickstart --json", "quickstart must mention validate JSON output");
expectText(quickstart, "npm run smoke:agent-pipeline", "quickstart must run the Agent pipeline smoke");
expectText(quickstart, "npm run smoke:quickstart", "quickstart must mention the automated quickstart smoke");
expectText(quickstart, "npm run smoke:bichon", "quickstart must mention the Bichon demo smoke");
expectText(quickstart, "npm run demo:bichon", "quickstart must mention the Bichon demo launch");
expectText(quickstart, "npm run pet:init -- --pet-id pet_quickstart", "quickstart must create a temporary pet workspace");
expectText(quickstart, "npm run pet:create-brief -- --pet-id pet_quickstart", "quickstart must create a temporary creator brief");
expectText(quickstart, "npm run pet:add-action -- --pet-id pet_quickstart", "quickstart must register a sample action");
expectText(quickstart, "Remove-Item -Recurse -Force data\\pets\\pet_quickstart", "quickstart must include cleanup");

const prTemplate = await readText(".github/PULL_REQUEST_TEMPLATE.md");
expectText(prTemplate, "npm run verify:quick", "PR template must request verify:quick");
expectText(prTemplate, "Privacy And Media", "PR template must include privacy and media checks");

const bugTemplate = await readText(".github/ISSUE_TEMPLATE/bug_report.yml");
expectText(bugTemplate, "pet:doctor", "bug report template must request validation context");
expectText(bugTemplate, "API keys", "bug report template must warn against secrets");

const providerIssueTemplate = await readText(".github/ISSUE_TEMPLATE/provider_adapter.yml");
expectText(providerIssueTemplate, "provider:validate-result", "provider issue template must request contract validation");
expectText(providerIssueTemplate, "explicit confirmation", "provider issue template must require upload confirmation");

const maintainerTriage = await readText("docs/maintainer_triage.md");
expectText(maintainerTriage, "provider:validate-result", "maintainer triage must cover provider validation");
expectText(maintainerTriage, "release:audit-assets", "maintainer triage must cover public asset audit");
expectText(maintainerTriage, "release:check-hygiene", "maintainer triage must cover public hygiene checks");
expectText(maintainerTriage, "release:check-staged", "maintainer triage must cover staged public release check");
expectText(maintainerTriage, "smoke:public-hygiene", "maintainer triage must cover public hygiene smoke");
expectText(maintainerTriage, "smoke:staged-release", "maintainer triage must cover staged release smoke");
expectText(maintainerTriage, "If rights or privacy are unclear", "maintainer triage must preserve conservative media stance");

const packaging = await readText("docs/packaging.md");
expectText(packaging, "not a packaged installer release", "packaging docs must state installer boundary");
expectText(packaging, "Packaging installers are future work", "packaging docs must preserve release wording");

const releaseNotesTemplate = await readText("docs/release_notes_template.md");
expectText(releaseNotesTemplate, "9 synthetic/reproducible files", "release notes template must describe the full public demo fixture shape");
expectText(releaseNotesTemplate, "creator brief", "release notes template must mention creator brief");
expectText(releaseNotesTemplate, "npm run release:preflight", "release notes template must mention first-public-release preflight");
expectText(releaseNotesTemplate, "npm run release:check-hygiene", "release notes template must mention public hygiene check");
expectText(releaseNotesTemplate, "npm run release:check-staged", "release notes template must mention staged public release check");
expectText(releaseNotesTemplate, "npm run smoke:public-hygiene", "release notes template must mention public hygiene smoke");
expectText(releaseNotesTemplate, "npm run smoke:staged-release", "release notes template must mention staged release smoke");
expectText(releaseNotesTemplate, "pet_bichon_demo", "release notes template must mention the public Bichon demo");

const ci = await readText(".github/workflows/ci.yml");
expectText(ci, "windows-latest", "CI must run on windows-latest for the current desktop target");
expectText(ci, "npm ci", "CI must install root dependencies with npm ci");
expectText(ci, "npm --prefix apps/desktop ci", "CI must install desktop dependencies");
expectText(ci, "npm run verify:quick", "CI must run verify:quick");

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`ERROR ${error}`);
  }
  process.exit(1);
}

console.log("release readiness check passed");

async function expectFile(relativePath: string): Promise<void> {
  try {
    const fileStat = await stat(path.join(repoRoot, relativePath));
    if (!fileStat.isFile()) {
      errors.push(`${relativePath} must be a file`);
    }
  } catch {
    errors.push(`${relativePath} is required`);
  }
}

async function readText(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readText(relativePath)) as T;
}

function expectTruthy(value: unknown, message: string): void {
  if (!value) {
    errors.push(message);
  }
}

function expectEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    errors.push(message);
  }
}

function expectIncludes(values: string[], expected: string, message: string): void {
  if (!values.includes(expected)) {
    errors.push(message);
  }
}

function expectText(text: string, expected: string, message: string): void {
  if (!text.includes(expected)) {
    errors.push(message);
  }
}

async function expectCurrentStagePlanSummary(markdown: string): Promise<void> {
  const markdownSummary = readStagePlanMarkdownSummary(markdown);
  if ((markdownSummary["manual-review"] ?? 1) !== 0) {
    errors.push("first public stage plan must not have manual review items before release");
  }
  if (!(await existsPath(path.join(repoRoot, ".git")))) {
    return;
  }
  const generatedSummary = await readCurrentStagePlanSummary();
  for (const key of ["stage", "keep-deleted", "do-not-stage", "manual-review"] as const) {
    if (markdownSummary[key] !== generatedSummary[key]) {
      errors.push(
        `docs/first_public_stage_plan.md is stale for ${key}: expected ${generatedSummary[key]}, found ${markdownSummary[key]}`,
      );
    }
  }
}

async function readCurrentStagePlanSummary(): Promise<Record<"stage" | "keep-deleted" | "do-not-stage" | "manual-review", number>> {
  const { stdout } = await execFileAsync(
    process.execPath,
    [path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs"), path.join(repoRoot, "scripts/release/plan-first-public-stage.ts"), "--json"],
    {
      cwd: repoRoot,
      maxBuffer: 1024 * 1024 * 32,
      windowsHide: true,
    },
  );
  const parsed = JSON.parse(stdout) as {
    summary?: Partial<Record<"stage" | "keep-deleted" | "do-not-stage" | "manual-review", number>>;
  };
  return {
    stage: parsed.summary?.stage ?? -1,
    "keep-deleted": parsed.summary?.["keep-deleted"] ?? -1,
    "do-not-stage": parsed.summary?.["do-not-stage"] ?? -1,
    "manual-review": parsed.summary?.["manual-review"] ?? -1,
  };
}

function readStagePlanMarkdownSummary(
  markdown: string,
): Partial<Record<"stage" | "keep-deleted" | "do-not-stage" | "manual-review", number>> {
  const labels = {
    stage: "Stage",
    "keep-deleted": "Keep deleted",
    "do-not-stage": "Do not stage",
    "manual-review": "Manual review",
  } as const;
  const summary: Partial<Record<keyof typeof labels, number>> = {};
  for (const [key, label] of Object.entries(labels) as [keyof typeof labels, string][]) {
    const match = markdown.match(new RegExp(`^- ${label}: (\\d+)`, "m"));
    summary[key] = match ? Number(match[1]) : -1;
  }
  return summary;
}

async function existsPath(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}
