# Changelog

All notable changes to PetPresence will be documented in this file.

This project uses a simple release-history format inspired by Keep a Changelog. The first public release is focused on the open-source creator pipeline, not the original realtime monitoring hackathon story.

## [0.1.0] - Unreleased

### Added

- Creator CLI for private desktop pet workflows:
  - `pet:init`
  - `pet:add-action`
  - `pet:validate`
  - `pet:print-plan`
  - `pet:doctor`
  - `pet:create-brief`
  - `pet:scaffold-actions`
- Electron desktop pet runtime that reads `data/pets/<pet_id>/action_assets.json`.
- Synthetic public demo pet fixture, `pet_demo`.
- Cleaned ready-to-run Xiaobai/Bichon demo fixture, `pet_bichon_demo`, with six runtime WebM actions and no private event history, frames, reports, original MP4 clips, or preview artifacts.
- Bichon demo commands:
  - `demo:bichon`
  - `smoke:bichon`
- MP4-to-transparent-WebM alpha conversion path and smoke verification.
- Agent recipe for creating a private desktop pet end to end.
- Creator brief generation for recording user choices, media availability, video API status, upload consent, privacy boundaries, and acceptance checks before provider use.
- Local synthetic video provider adapter example, local MP4 import adapter, real-provider scaffold template, provider adapter cookbook, provider contract validator, and provider smoke tests.
- Lightweight Agent pipeline smoke covering init, doctor, creator brief, scaffold, provider contract, action registration, validation, and desktop config.
- Quickstart smoke that replays the no-API onboarding path with `pet_demo` and a temporary local pet workspace.
- Public asset audit tooling with release decisions.
- Quick CI verification gate and full local release verification gate.
- First-public-release preflight command that refreshes the stage plan, runs full release verification, runs clean export smoke, re-runs strict asset audit, checks staged release contents, and checks `git diff --check`.
- Release readiness, public config, public hygiene, dependency audit, and asset audit checks.
- Staged public release check, `release:check-staged`, for catching private media, generated outputs, local env files, key files, and likely API secrets already added to the Git index before commit.
- Public hygiene smoke that proves `.env`, API key, generated output, private/legacy media, frames, events, reports, and preview artifact guards fail on dangerous files and pass after cleanup.
- Staged release smoke, `smoke:staged-release`, that proves staged `.env`, likely API secrets, private legacy media, and generated outputs are rejected before commit.
- Privacy, media policy, packaging boundary, release checklist, and release notes template docs.

### Changed

- Open-source positioning now centers on the creator pipeline for private desktop pets.
- Realtime observer, event-server, reports, QA, and shelter demo are treated as experimental or legacy modules.
- Public fixture surface is limited to synthetic `pet_demo` plus the cleaned `pet_bichon_demo` runtime fixture.
- Local/private hackathon materials such as private pet workspaces, shelter/adoption media, presentation artifacts, original MP4 clips, generated frames, event logs, preview artifacts, and reports are excluded from the public release surface.

### Security

- `.env.example` uses placeholders only and defaults to `pet_demo`.
- `release:check-hygiene` blocks commit-visible `.env`, API keys, generated outputs, private/legacy media, frames, events, reports, key files, and preview artifacts.
- `release:check-staged` blocks dangerous staged additions before a release commit.
- `smoke:public-hygiene` verifies the hygiene guard with negative fixtures.
- `smoke:staged-release` verifies the staged-content guard with a temporary Git repository.
- Root and desktop dependency audits are included in the full release gate.
- Current root and desktop dependency audits pass at `--audit-level=moderate`.

### Known Limitations

- Windows is the main verified desktop target.
- Packaged installers are future work.
- Commercial video generation provider integrations are not bundled; the release includes a neutral provider template, cookbook, local synthetic example, and local MP4 import bridge.
- MP4 alpha conversion quality depends on source video quality.
- No medical, psychological, health, or safety diagnosis features are included.
