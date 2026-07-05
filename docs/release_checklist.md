# PetPresence Open-Source Release Checklist

Use this checklist before making the repository public or publishing a release.

## 1. Product Scope

- README presents PetPresence as a creator pipeline for private desktop pets.
- `CHANGELOG.md` records the current public release scope and limitations.
- `docs/README.md` points new contributors to the creator-pipeline docs first.
- `docs/quickstart.md` gives new users a short no-API path to run `pet_demo`, smoke-test the Agent pipeline, and create a temporary local pet.
- GitHub issue templates and pull request template collect commands, validation output, privacy checks, and provider-contract context.
- `docs/maintainer_triage.md` explains how to triage creator, provider, alpha-conversion, privacy, and release issues.
- `docs/troubleshooting.md` gives users and Agents a single symptom-based debugging path.
- Historical hackathon planning docs are excluded from the default public release tree unless a separate privacy and media-rights review approves them.
- Realtime camera, observer, event-server, reports, QA, and shelter launcher are marked as experimental.
- New users can follow the default flow without starting event-server or observer.
- Roadmap explains the difference between open-source tooling, Agent-assisted service, and future cloud service.

## 2. Secrets And Environment

- No real API keys are committed.
- `.env` and `.env.*` stay ignored.
- `.env.example` contains placeholders only.
- `npm run release:check-hygiene` passes and does not find commit-visible `.env`, API keys, generated outputs, private/legacy media, frames, events, or reports.
- `npm run smoke:public-hygiene` passes and proves the hygiene guard fails on dangerous files before passing after cleanup.
- Screenshots, reports, logs, and docs do not expose private keys or provider credentials.
- `npm audit --audit-level=moderate` has been reviewed. Low-severity development dependency advisories can be documented separately if they do not affect the local creator pipeline.

## 3. Media Rights

- Every committed pet image/video is either original, generated with publishable rights, or explicitly licensed.
- Private user pet media is not committed.
- Paid-model outputs are not committed unless their provider terms allow open publication.
- `outputs/`, local frames, generated reports, and temporary conversion workdirs are reviewed before release.
- `docs/media_and_data_policy.md` has been reviewed and matches the release contents.
- `docs/release_notes_template.md` has been reviewed for the current tag.
- `docs/packaging.md` matches the current installer/package status.
- `docs/first_public_release_runbook.md` has been reviewed before switching repository visibility or tagging the first release.
- `npm run release:stage-plan -- --write-md` has regenerated `docs/first_public_stage_plan.md` before staging the first public-release commit.
- `docs/open_source_release_audit.md` has been reviewed for current blockers and manual checks.
- `docs/release_asset_review.md` has been updated with the latest `release:audit-assets` result.
- `docs/release_asset_decisions.json` records a final `keep`, `remove`, or `replace` decision for every reviewed file.
- `npm run release:generate-demo-fixture` has been run if `pet_demo` needs to be regenerated.
- `npm run release:plan-cleanup` has been reviewed before removing or replacing files.
- `npm run release:apply-cleanup -- --action=git-rm` has been reviewed in dry-run mode before applying removals.
- Local legacy media can be removed from Git while preserving local files with `npm run release:apply-cleanup -- --action=git-rm --apply --keep-local`.

## 4. Privacy Boundary

- `PRIVACY.md` describes local files and optional external model calls.
- Docs warn users before uploading pet photos/videos to a third-party provider.
- Event JSONL files, extracted frames, and reports are treated as private local data by default.
- `.gitignore` blocks future local generated outputs, and already tracked generated files have been explicitly reviewed.
- Behavior descriptions avoid medical, psychological, health, or safety diagnosis claims.

## 5. Creator Pipeline

- `npm run pet:init` creates a clean pet workspace.
- `npm run pet:doctor` passes in the local environment.
- `npm run pet:create-brief` creates `creator_brief.md` before prompts, provider calls, uploads, or action registration.
- `npm run pet:scaffold-actions` creates `action_plan.md` and prompt files for an Agent workflow.
- `npm run pet:add-action` registers WebM and MP4 assets.
- `npm run provider:import` can normalize an external model MP4 into the provider contract.
- `scripts/providers/provider-template.ts` and `docs/provider_adapter_cookbook.md` explain how to implement a real provider without bundling a commercial API into the default flow.
- `npm run provider:validate-result` validates provider JSON before `pet:add-action`.
- `npm run smoke:agent-pipeline` passes before claiming the Agent-assisted flow is wired end to end.
- `npm run smoke:quickstart` passes before claiming the no-API quickstart can be followed by new users.
- `npm run smoke:creator-alpha` passes before claiming full `pet:add-action --convert-alpha` support.
- `npm run pet:validate` catches missing manifest files and missing media files.
- Custom action names work when they are ASCII and registered in `action_assets.json`.
- Desktop preview works with `npm run desktop -- --pet-id <pet_id>`.

## 6. Experimental Modules

- `/shelter` is described as a legacy hackathon launcher, not the main product.
- `packages/report` is described as an optional local report generator.
- `services/observer` is described as an optional multimodal observer experiment.
- Experimental scripts do not run automatically during the default creator flow.

## 7. Required Verification

Run these before publishing:

```powershell
npm run release:preflight
```

`release:preflight` refreshes the first-public stage plan, runs the full local release gate, runs clean export smoke, re-runs the strict public asset audit, and checks `git diff --check`.

The main local engineering gate is:

```powershell
npm run release:verify
```

`release:verify` runs the required local engineering gate:

```text
release:check-config
release:check-hygiene
release:readiness
typecheck
test:protocol
audit:root
audit:desktop
smoke:provider-example
smoke:provider-import
smoke:public-hygiene
smoke:staged-release
smoke:creator
smoke:creator-scaffold
smoke:agent-pipeline
smoke:quickstart
smoke:creator-alpha
pet:validate -- --pet-id pet_demo
desktop smoke
release:audit-assets -- --fail-on-unresolved
```

The full release gate runs dependency audits for both the root workspace and the Electron desktop workspace. The lighter CI gate is:

```powershell
npm run verify:quick
```

It intentionally skips `smoke:creator-alpha` so GitHub Actions does not need to download Python background-removal dependencies or segmentation models on every push. It still runs the local provider, creator scaffold, Agent pipeline, and quickstart smokes because they are synthetic and do not require API keys.

`release:readiness` is a mechanical checklist guard. It verifies required public files, package metadata, key npm scripts, docs index links, and the GitHub Actions quick gate. It does not replace the manual rights, privacy, or repository-visibility checks in this document.

Run these release-maintenance commands when assets, fixture files, or cleanup decisions change:

```powershell
npm run release:generate-demo-fixture
npm run release:audit-assets
npm run release:plan-cleanup
npm run release:plan-cleanup -- --write-md
npm run release:apply-cleanup -- --action=git-rm --limit=5
npm run release:stage-plan
npm run release:stage-plan -- --write-md
npm run release:check-hygiene
npm run release:check-staged
npm run smoke:public-hygiene
npm run smoke:staged-release
npm run smoke:agent-pipeline
npm run smoke:quickstart
npm run release:smoke-clean-export
```

`release:audit-assets` must be reviewed manually. It lists tracked media, event logs, frames, reports, and generated artifacts that need a keep/replace/remove decision before going public.
The `--fail-on-unresolved` variant is expected to fail until every reviewed file still present in `assets/`, `data/`, or `outputs/` is approved as `keep`.
Files marked `remove` or `replace` also block the gate until they are actually removed or replaced.

`release:smoke-clean-export` creates a temporary no-`.git`, no-`node_modules`, no-private-media export, installs dependencies from scratch, runs `verify:quick`, and removes the temporary directory. It is slower than `verify:quick`, so run it before a public release or when release file inclusion rules change.

Recommended experimental checks:

```powershell
npm run smoke:event-server
npm run smoke:observer
npm run report:html -- --date 2026-05-25
```

Recommended custom-action check:

```powershell
npm run pet:init -- --pet-id pet_custom_smoke --name CustomSmoke --species cat --force
npm run pet:add-action -- --pet-id pet_custom_smoke --action wave_paw --input assets\pets\pet_demo\idle\idle.webm --skip-alpha --message "Wave paw~"
npm run pet:validate -- --pet-id pet_custom_smoke
npm --prefix apps/desktop run smoke -- --pet-id pet_custom_smoke
```

Remove the temporary `pet_custom_smoke` directories after the check.

## 8. GitHub Release

- Decide whether to keep the default branch name as `master` or migrate to `main`.
- Confirm repository visibility is intended before switching from private to public.
- Follow `docs/first_public_release_runbook.md` for commit grouping, final command order, and GitHub visibility/tag steps.
- Tag the first open-source release after the checklist passes.
- Include release notes that state current limitations:
  - Windows-first desktop runtime.
  - MP4 alpha conversion quality depends on source quality.
  - Commercial video generation provider adapters are not bundled by default; the neutral template and cookbook are included.
  - Packaging installers are still future work.
  Use `docs/release_notes_template.md` as the starting point.
