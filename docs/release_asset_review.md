# Release Asset Review

Updated: 2026-07-05

This file records the public asset boundary for the first PetPresence open-source release.

## Current Decision

The public release keeps exactly two fixture families and approved README visuals:

- synthetic `pet_demo`;
- cleaned ready-to-run `pet_bichon_demo`.
- `docs/images/bichon-xiaobai.jpg` as the public Bichon demo photo;
- `docs/images/creator-pipeline-workflow.svg` as the creator pipeline workflow diagram;
- lightweight transparent animated WebP previews generated from the approved `pet_bichon_demo` WebM runtime assets.

The release does not include source videos, raw private workspaces, extracted frames, event logs, generated reports, alpha previews, contact sheets, checker images, local model outputs, `.env` files, or API keys.

## Strict Gate

Run:

```powershell
npm run release:audit-assets -- --fail-on-unresolved
```

The command must report:

- no unresolved files;
- no files rejected by release decisions;
- only approved `pet_demo` and `pet_bichon_demo` fixture files under `assets/` and `data/`;
- only approved README/documentation images under `docs/images/`.

## Approved Fixtures

Synthetic demo fixture:

```text
assets/pets/pet_demo/idle/idle.webm
assets/pets/pet_demo/wave_paw/wave_paw.webm
data/pets/pet_demo/action_assets.json
data/pets/pet_demo/action_plan.md
data/pets/pet_demo/agent.md
data/pets/pet_demo/creator_brief.md
data/pets/pet_demo/profile.json
data/pets/pet_demo/prompts/idle.txt
data/pets/pet_demo/prompts/wave_paw.txt
```

Ready-to-run Bichon demo fixture:

```text
assets/pets/pet_bichon_demo/alert/alert.webm
assets/pets/pet_bichon_demo/eat/eat.webm
assets/pets/pet_bichon_demo/idle/idle.webm
assets/pets/pet_bichon_demo/out_of_view/out_of_view.webm
assets/pets/pet_bichon_demo/play/play.webm
assets/pets/pet_bichon_demo/sleep/sleep.webm
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

README visuals:

```text
docs/images/bichon-xiaobai.jpg
docs/images/creator-pipeline-workflow.svg
docs/images/bichon-demo-idle.webp
docs/images/bichon-demo-play.webp
docs/images/bichon-demo-sleep.webp
```

## Keep Out Of The Public Release

Do not commit:

- private pet photos or videos;
- source MP4 clips unless explicitly approved as public fixtures;
- paid-model outputs unless the provider terms and user consent allow publication;
- extracted frames;
- event logs;
- generated reports;
- local `outputs/`;
- `.env` files or credentials;
- preview artifacts from alpha conversion.

## Follow-Up

If a future release wants to publish more demo media, add a new explicit `keep` decision to `docs/release_asset_decisions.json`, document the rights review here, and re-run the strict asset audit.
