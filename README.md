# PetPresence

PetPresence is an open-source creator pipeline for making your own private desktop pet.

The project started as a hackathon demo about a real-pet-state-driven companion agent. The open-source direction is now simpler and more useful for individuals: give the project your pet photos, short action videos, and personality notes, then use the included Agent-friendly workflow to turn them into a transparent Electron desktop companion.

The realtime camera, multimodal recognition, event stream, daily report, and QA modules are kept as experimental extensions. They are not required for the default open-source experience.

The first public release has two release surfaces:

1. **Creator Pipeline**: the reusable Agent-assisted workflow for making a private desktop pet from your own media or generated clips.
2. **Xiaobai / Bichon Demo**: a cleaned ready-to-run desktop pet demo, `pet_bichon_demo`, with six WebM actions and no private event history.

## Quickstart

If you want the shortest path, start here:

```text
docs/quickstart.md
```

It runs `pet_demo`, checks the Agent pipeline smoke, and creates a temporary local pet without calling paid APIs or uploading media.

## What You Can Build

With PetPresence, you can create a local desktop pet that:

- plays your own pet's `idle`, `sleep`, `eat`, `play`, `alert`, or custom action animations;
- uses transparent-background WebM assets for a quiet desktop companion feel;
- reads a per-pet `action_assets.json` manifest;
- can be driven by dynamically generated right-click menu actions, demo events, or future custom rules;
- can be prepared by a coding Agent following the included recipe.

The first target platform is Windows 11.

## Repository Map

```text
apps/desktop/                  Electron desktop pet runtime
assets/pets/<pet_id>/          per-pet action video assets
data/pets/<pet_id>/            per-pet profile and action manifest
docs/agent-recipes/            Agent-facing workflows
scripts/creator/pet-cli.ts     init/add-action/validate/print-plan CLI
scripts/assets/                video-to-transparent-WebM tooling
services/event-server/         experimental local event server
services/observer/             experimental multimodal observer
packages/protocol/             shared PetActionEvent schema
packages/report/               experimental local daily report generation
```

## Install

Prerequisites:

- Node.js >= 22
- Windows 11 for the currently tested desktop runtime
- PowerShell for asset processing scripts
- Python and ffmpeg only when converting MP4 clips to transparent WebM

Install root dependencies:

```powershell
npm install
```

Install Electron dependencies:

```powershell
npm --prefix apps/desktop install
```

Check the local environment:

```powershell
npm run pet:doctor
```

## Run The Example Pets

The repository includes two public sample pets:

- `pet_demo`: a tiny synthetic fixture for the creator pipeline and CI-safe tests.
- `pet_bichon_demo`: a cleaned Xiaobai/Bichon desktop pet demo with six runtime WebM actions.

### Synthetic Pipeline Fixture

Validate `pet_demo`:

Validate its manifest:

```powershell
npm run pet:validate -- --pet-id pet_demo
```

Start the desktop pet:

```powershell
npm run desktop -- --pet-id pet_demo
```

You can also run the desktop smoke check:

```powershell
npm --prefix apps/desktop run smoke
```

The original hackathon pet, private legacy pet workspace, is treated as local legacy material and is excluded from the public release surface.
The public `pet_demo` fixture is synthetic and can be regenerated with:

```powershell
npm run release:generate-demo-fixture
```

### Xiaobai / Bichon Demo

Validate the cleaned public demo without opening the desktop window:

```powershell
npm run smoke:bichon
```

Launch it in development mode:

```powershell
npm run demo:bichon
```

`pet_bichon_demo` includes:

- `idle`
- `eat`
- `sleep`
- `alert`
- `play`
- `out_of_view`

It intentionally excludes the original private legacy pet workspace private/local material: event JSONL, extracted frames, generated reports, original MP4 clips, alpha previews, contact sheets, checker images, and local `outputs/`.

## Create Your Own Pet

### 1. Create The Pet Workspace

Use a stable ASCII `pet_id`.

```powershell
npm run pet:init -- --pet-id pet_huahua --name Huahua --species cat --description "A calm orange cat"
```

This creates:

```text
data/pets/pet_huahua/profile.json
data/pets/pet_huahua/agent.md
data/pets/pet_huahua/action_assets.json
assets/pets/pet_huahua/
```

You can inspect the workspace and local toolchain at any time:

```powershell
npm run pet:doctor -- --pet-id pet_huahua
```

Per-pet doctor checks include `profile.json`, `action_assets.json`, registered action media, plus creator-pipeline planning files such as `creator_brief.md`, `action_plan.md`, and `prompts/*.txt`. Missing planning files are reported as `WARN` so you can still register existing media, but Agents should resolve them before using providers.

Agents and automation can request structured diagnostics:

```powershell
npm run pet:doctor -- --pet-id pet_huahua --json
```

The JSON report includes `schema_version`, `pet_id`, `summary`, and `checks`.

### 2. Write The Creator Brief

Before generating prompts or calling any provider, capture the user's choices in a local brief:

```powershell
npm run pet:create-brief -- --pet-id pet_huahua --actions idle,sleep,eat,play --media "D:\pets\huahua_idle.mp4,D:\pets\huahua_sleep.mp4" --video-api "not configured" --upload-consent "ask every time before uploading pet media" --force
```

This writes:

```text
data/pets/pet_huahua/creator_brief.md
```

The brief records the pet identity, requested actions, available media, video API status, upload consent, privacy boundary, and acceptance checks. It does not call a video API, upload media, or register assets.

### 3. Plan The First Actions

```powershell
npm run pet:print-plan -- --pet-id pet_huahua
```

Recommended first actions:

- `idle`: front-facing, subtle breathing, stable loop.
- `sleep`: lying down or curled up, stable loop.
- `eat`: lowering head or eating, short action.
- `play`: a small jump, turn, paw movement, or toy interaction.

To generate a reusable action plan and prompt files for an Agent or video provider:

```powershell
npm run pet:scaffold-actions -- --pet-id pet_huahua --actions idle,sleep,eat,play
```

This writes:

```text
data/pets/pet_huahua/action_plan.md
data/pets/pet_huahua/prompts/<action>.txt
```

The scaffold does not call a video API or register assets. It only prepares prompts and next-step commands.

### 4. Register An Existing Transparent WebM

If your action video is already a transparent WebM:

```powershell
npm run pet:add-action -- --pet-id pet_huahua --action idle --input "D:\pets\huahua_idle.webm" --skip-alpha --loop true --message "I am here~"
```

### 5. Register An MP4 Source Clip

If your action video is a normal MP4 and you want PetPresence to convert it immediately:

```powershell
npm run pet:add-action -- --pet-id pet_huahua --action eat --input "D:\pets\huahua_eat.mp4" --message "I am eating~" --convert-alpha
```

This runs `scripts/assets/remove_background_to_alpha_webm.ps1`, generates `assets/pets/<pet_id>/<action>/<action>.webm`, and registers the generated WebM in `action_assets.json`.

If you only want to copy/register the source MP4 first:

```powershell
npm run pet:add-action -- --pet-id pet_huahua --action eat --input "D:\pets\huahua_eat.mp4" --message "I am eating~"
```

The command copies the source into `assets/pets/<pet_id>/<action>/` and prints the recommended alpha-WebM conversion command.

To convert manually:

```powershell
.\scripts\assets\remove_background_to_alpha_webm.ps1 `
  -PetId pet_huahua `
  -Action eat `
  -InputPath "assets\pets\pet_huahua\eat\eat.mp4"
```

The expected desktop-ready output is:

```text
assets/pets/pet_huahua/eat/eat.webm
```

After manual conversion, run `pet:add-action` again with `--skip-alpha` and the `.webm` file, or update `action_assets.json` to point to the generated WebM.

### 6. Validate

```powershell
npm run pet:validate -- --pet-id pet_huahua
```

Fix every `ERROR` before previewing. `WARN` messages are allowed but should be reviewed.
For Agent or script parsing, use the JSON form:

```powershell
npm run pet:validate -- --pet-id pet_huahua --json
```

The JSON report includes `schema_version`, `pet_id`, `summary`, `errors`, and `warnings`. Continue only when `summary.ok` is `true`.

### 7. Preview

```powershell
npm run desktop -- --pet-id pet_huahua
```

Use the desktop pet menu to switch actions and review whether the size, transparency, motion, and message style feel right.

## Agent-Assisted Workflow

PetPresence is designed to be operated by an Agent.

Give your Agent this file first:

```text
docs/user_guide_create_private_pet.md
docs/agent-recipes/create-your-pet.md
```

If you are not a developer, start with `docs/user_guide_create_private_pet.md`. It contains a copy-paste starter prompt for your coding Agent, a media preparation checklist, privacy/API decisions, and acceptance checks.

The Agent should:

1. run `pet:doctor` to check the local environment;
2. ask for the pet name, species, action list, and available source videos;
3. run `pet:init`;
4. run `pet:create-brief` to record user choices, media availability, API status, upload consent, and acceptance checks;
5. run `pet:scaffold-actions` to create `action_plan.md` and prompt files;
6. prepare, request, or generate short action clips;
7. run `pet:add-action`;
8. convert MP4 clips to alpha WebM when needed;
9. run `pet:validate`;
10. run `pet:doctor -- --pet-id <pet_id>` before preview;
11. launch a desktop preview;
12. iterate based on your visual feedback.

To smoke-test this Agent-style flow without uploading media or calling a paid API:

```powershell
npm run smoke:agent-pipeline
```

This runs a temporary local workflow from pet initialization through creator brief generation, scaffold prompts, provider contract validation, action registration, pet validation, and desktop config smoke. It uses `--skip-alpha` so the quick test stays lightweight; full alpha conversion remains covered by `npm run smoke:creator-alpha`.

To verify that the no-API quickstart path still works end to end:

```powershell
npm run smoke:quickstart
```

This replays the core `docs/quickstart.md` path with `pet_demo`, a temporary `pet_quickstart_smoke_*` workspace, sample action registration, validation, desktop config smoke, and cleanup.

The detailed product design lives in:

```text
docs/open_source_creator_pipeline.md
```

The open-source roadmap and commercial direction notes live in:

```text
docs/open_source_roadmap.md
```

Media and generated-data publishing rules live in:

```text
docs/media_and_data_policy.md
```

The documentation index lives in:

```text
docs/README.md
```

Troubleshooting lives in:

```text
docs/troubleshooting.md
```

Version history lives in:

```text
CHANGELOG.md
```

Contribution and maintainer guidance lives in:

```text
CONTRIBUTING.md
docs/maintainer_triage.md
```

Before making a public release, review tracked assets with:

```powershell
npm run release:audit-assets
```

The strict release gate requires every reviewed file still present in `assets/`, `data/`, or `outputs/` to be approved as `keep`:

```powershell
npm run release:audit-assets -- --fail-on-unresolved
```

Release keep/remove/replace decisions are recorded in:

```text
docs/release_asset_decisions.json
```

To preview the actual cleanup actions implied by those decisions:

```powershell
npm run release:plan-cleanup
```

To refresh the Markdown cleanup report:

```powershell
npm run release:plan-cleanup -- --write-md
```

The generated report lives at:

```text
docs/release_cleanup_plan.md
```

Cleanup execution is dry-run by default:

```powershell
npm run release:apply-cleanup -- --action=git-rm --limit=5
```

Only add `--apply` after reviewing the preview.

## Video Generation Models

Video generation APIs are optional.

PetPresence does not require a specific provider. You can use:

- clips you shot yourself;
- clips cut from existing pet videos;
- any external image-to-video or video generation model;
- future provider adapters.

The repository's core responsibility is the local pipeline after a source clip exists: foreground extraction, transparent WebM output, action manifest registration, validation, and desktop playback.

Future provider adapters should follow:

```text
docs/provider-adapters.md
docs/provider_adapter_cookbook.md
```

To test the provider boundary without a paid API:

```powershell
npm run provider:example -- --pet-id pet_huahua --action idle --prompt "Create a calm idle animation"
```

This local synthetic adapter writes a test MP4 under `outputs/generated/<pet_id>/<action>.mp4` and prints the next `pet:add-action` command. It does not upload pet media or call a real model.

If you already have an MP4 from any external video model, normalize it to the same provider contract:

```powershell
npm run provider:import -- --pet-id pet_huahua --action idle --input "D:\pets\huahua_idle_from_model.mp4" --prompt-file "data/pets/pet_huahua/prompts/idle.txt"
```

To validate a provider adapter JSON result:

```powershell
npm run provider:validate-result -- --input outputs/generated/pet_huahua/provider-result.json --pet-id pet_huahua --action idle
```

## Experimental Modules

The original hackathon system also contains:

- local HTTP/WebSocket event server;
- mock and AI observer;
- video frame extraction;
- `PetActionEvent` protocol;
- JSONL event history;
- daily report and today-QA experiments;
- cloud-adoption shelter demo page.

These are useful references, but they are not required for the default creator pipeline.
Historical hackathon planning notes are kept out of the public release tree by default; publish them separately only after a dedicated privacy and media review.

Typical experimental commands:

```powershell
npm run dev:event-server
npm run dev:observer
npm run smoke:event-server
npm run smoke:observer
npm run test:protocol
```

The legacy `/shelter` page is an experimental hackathon launcher. It is not the default creator workflow.

## Validation

Run the quick checks used by CI:

```powershell
npm run verify:quick
```

Run the full local release gate before publishing:

```powershell
npm run release:verify
```

Run the full first-public-release preflight before changing repository visibility or tagging:

```powershell
npm run release:preflight
```

`verify:quick` runs public config and hygiene checks, typecheck, protocol tests, provider smokes, the public hygiene smoke, creator smoke, action scaffold smoke, Agent pipeline smoke, quickstart smoke, `pet_demo` validation, `pet_bichon_demo` smoke, desktop config smoke, and the strict public asset audit.

`release:verify` also runs dependency audits and `smoke:creator-alpha`, which generates a tiny synthetic MP4, runs the real `pet:add-action --convert-alpha` path, validates the generated alpha WebM, runs the desktop config smoke, and deletes its temporary pet afterward. The first run may install Python background-removal dependencies under `%LOCALAPPDATA%\PetPresenceTools`.

The public hygiene checks guard against accidentally releasing `.env`, API keys, `outputs/`, private/legacy media, frames, events, reports, or preview artifacts. The dedicated smoke proves those checks fail on dangerous files and pass after cleanup.

Before committing release changes, inspect the Git index:

```powershell
npm run release:check-staged
```

This staged-content check rejects staged `.env` files, likely API secrets, generated outputs, private/legacy media, frames, events, reports, key files, and preview artifacts. It is read-only and does not stage or unstage files.

Before making the repository public, follow:

```text
docs/release_checklist.md
docs/first_public_release_runbook.md
```

Release-note and packaging boundaries live in:

```text
docs/release_notes_template.md
docs/packaging.md
```

## Privacy And Safety

- PetPresence is local-first by default.
- Do not commit private pet videos, API keys, or generated paid-model outputs unless you have the rights to publish them.
- If you use an external video generation or multimodal model, review that provider's data policy.
- Treat `outputs/`, extracted frames, event JSONL files, and generated reports as private local data unless intentionally prepared as public fixtures.
- PetPresence should describe observable behavior and user-provided personality only. It should not claim medical, psychological, or health diagnoses.

## Current Limitations

- The polished desktop runtime is currently tested mainly on Windows.
- MP4-to-alpha-WebM processing quality depends heavily on source video quality.
- White or low-contrast pets on light backgrounds may need parameter tuning.
- The desktop menu reads registered actions from `action_assets.json`, but custom action behavior still depends on the video asset and loop/duration settings you provide.
- Packaging installers is still a follow-up task.
