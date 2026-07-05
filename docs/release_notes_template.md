# PetPresence Release Notes Template

Use this template for the first public open-source release and later tagged releases.

## Title

```text
PetPresence v0.1.0 - Agent-assisted private desktop pet creator pipeline
```

## Summary

PetPresence is an open-source creator pipeline for making a private desktop pet from user-provided pet media, generated action clips, and local transparent WebM assets.

This release focuses on the local Windows-first workflow:

- create a pet workspace with the Creator CLI;
- register WebM, MP4, or GIF action assets;
- optionally convert MP4 clips to transparent WebM;
- validate the pet manifest;
- preview the pet in the Electron desktop runtime;
- use an Agent recipe to run the workflow end to end.

## What Is Included

- Synthetic public demo pet: `pet_demo`.
- The `pet_demo` fixture includes 9 synthetic/reproducible files covering creator brief, action plan, prompts, manifest, and WebM runtime assets.
- Cleaned ready-to-run Xiaobai/Bichon demo pet: `pet_bichon_demo`.
- The `pet_bichon_demo` fixture includes 6 runtime WebM actions plus public profile, Agent notes, creator brief, action plan, prompts, and manifest. It excludes original MP4 clips, extracted frames, event logs, generated reports, and preview artifacts.
- Creator commands:
  - `npm run pet:init`
  - `npm run pet:add-action`
  - `npm run pet:validate`
  - `npm run pet:print-plan`
  - `npm run pet:doctor`
  - `npm run pet:create-brief`
  - `npm run pet:scaffold-actions`
- Local synthetic provider adapter example:
  - `npm run provider:example`
  - `npm run provider:template`
  - `npm run provider:import`
  - `npm run provider:validate-result`
- Provider adapter documentation:
  - `docs/provider-adapters.md`
  - `docs/provider_adapter_cookbook.md`
- Desktop runtime:
  - `npm run desktop -- --pet-id pet_demo`
  - `npm run smoke:bichon`
  - `npm run demo:bichon`
- Verification gates:
  - `npm run verify:quick`
  - `npm run release:verify`
  - `npm run release:check-hygiene`
  - `npm run smoke:public-hygiene`
  - `npm run smoke:agent-pipeline`
  - `npm run smoke:quickstart`

## What Is Not Included Yet

- Packaged installers.
- A graphical creator wizard.
- Bundled commercial video-generation provider integrations.
- Realtime camera monitoring as the default workflow.
- Cloud accounts, payments, or hosted generation services.
- Medical, psychological, health, or safety diagnosis features.

## Privacy And Media Rights

- `pet_demo` and `pet_bichon_demo` are the only intended public pet fixtures.
- Do not commit private pet photos, videos, generated paid-model outputs, extracted frames, event logs, or reports.
- If you use an external video generation provider, review that provider's data policy before uploading pet media.
- Real provider adapters should require explicit upload confirmation before sending reference images or videos to a third-party service.

## Verification Before Tagging

Run:

```powershell
npm run verify:quick
npm run release:verify
npm run release:preflight
npm run release:check-hygiene
npm run release:check-staged
npm run smoke:public-hygiene
npm run smoke:staged-release
npm run release:audit-assets -- --fail-on-unresolved
npm run release:smoke-clean-export
npm run audit:root
npm run audit:desktop
```

Review:

- repository visibility;
- `CHANGELOG.md`;
- media publication rights;
- release asset decisions;
- known dependency advisories;
- current limitations in `README.md`.

## Known Limitations

- The polished desktop runtime is currently tested mainly on Windows.
- MP4-to-alpha-WebM quality depends on source video quality.
- White or low-contrast pets on light backgrounds may need parameter tuning.
- Packaging installers are future work.
- Commercial video generation provider integrations are not bundled; the release includes a neutral adapter template and cookbook.
- Experimental observer, event-server, reports, QA, and shelter launcher modules are not required for the default creator pipeline.
