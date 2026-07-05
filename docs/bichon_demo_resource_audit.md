# Bichon Demo Public Resource Audit

Updated: 2026-07-05

This audit records the public release boundary for the ready-to-run Bichon desktop pet demo.

## Decision

`pet_bichon_demo` is approved as the public desktop demo fixture for the first open-source release.

The public fixture intentionally contains only:

- six runtime WebM actions;
- `profile.json`;
- `agent.md`;
- `creator_brief.md`;
- `action_plan.md`;
- per-action prompt files;
- `action_assets.json`.

It intentionally excludes source videos, extracted frames, event logs, generated reports, alpha previews, contact sheets, checker images, local model outputs, and any private working-copy material.

## Public Runtime Assets

```text
assets/pets/pet_bichon_demo/alert/alert.webm
assets/pets/pet_bichon_demo/eat/eat.webm
assets/pets/pet_bichon_demo/idle/idle.webm
assets/pets/pet_bichon_demo/out_of_view/out_of_view.webm
assets/pets/pet_bichon_demo/play/play.webm
assets/pets/pet_bichon_demo/sleep/sleep.webm
```

## Public Config And Planning Files

```text
data/pets/pet_bichon_demo/action_assets.json
data/pets/pet_bichon_demo/action_plan.md
data/pets/pet_bichon_demo/agent.md
data/pets/pet_bichon_demo/creator_brief.md
data/pets/pet_bichon_demo/profile.json
data/pets/pet_bichon_demo/prompts/alert.txt
data/pets/pet_bichon_demo/prompts/eat.txt
data/pets/pet_bichon_demo/prompts/idle.txt
data/pets/pet_bichon_demo/prompts/out_of_view.txt
data/pets/pet_bichon_demo/prompts/play.txt
data/pets/pet_bichon_demo/prompts/sleep.txt
```

## Verification

The demo is covered by:

```powershell
npm run smoke:bichon
npm run verify:quick
npm run release:audit-assets -- --fail-on-unresolved
npm run release:check-hygiene
npm run release:check-staged
```

`npm run smoke:bichon` validates the pet manifest and runs the desktop configuration smoke without opening an Electron window.

## Publication Rights

For this public release, the cleaned WebM runtime files and public planning/config files listed above are treated as approved public demo assets. Any future source media, generated model output, or private working-copy material must go through a new media and privacy review before it can be committed.
