# PetPresence Docs

PetPresence is now organized around the open-source creator pipeline: make a private desktop pet from user-provided pet media, generated action clips, and local transparent WebM assets.

## Start Here

- `../README.md`: project overview, install commands, and the default creator flow.
- `../CHANGELOG.md`: version history and first public release summary.
- `quickstart.md`: shortest no-API path to run `pet_demo`, run the cleaned `pet_bichon_demo`, smoke-test the Agent pipeline, and create a temporary local pet.
- `open_source_creator_pipeline.md`: product boundary and MVP design for the open-source pipeline.
- `user_guide_create_private_pet.md`: non-technical user guide with the Agent starter prompt, media preparation checklist, privacy/API choices, and acceptance checks.
- `agent-recipes/create-your-pet.md`: step-by-step recipe for a coding Agent to create a user's private desktop pet.
- `provider-adapters.md`: boundary for future video-generation API adapters.
- `provider_adapter_cookbook.md`: implementation cookbook for real video-generation provider adapters.
- `troubleshooting.md`: symptom-based troubleshooting for install, provider, alpha conversion, validation, desktop preview, release gates, and staging.

## Release And Safety

- `media_and_data_policy.md`: what media and generated data can be committed.
- `maintainer_triage.md`: issue and PR triage guide for creator, provider, alpha-conversion, privacy, and release work.
- `release_asset_review.md`: public asset review notes.
- `release_asset_decisions.json`: keep/remove/replace decisions used by release tooling.
- `release_checklist.md`: commands and manual checks before publishing.
- `first_public_release_runbook.md`: exact first-public-release operation order, commit grouping, and manual GitHub steps.
- `first_public_stage_plan.md`: generated, non-destructive staging review for the current first-public-release working tree.
- `open_source_release_audit.md`: current release-readiness audit record and manual release blockers.
- `bichon_demo_resource_audit.md`: audit record for the original Xiaobai resources and the cleaned public Bichon demo boundary.
- `release_cleanup_plan.md`: generated cleanup report.
- `release_notes_template.md`: reusable GitHub release notes template.
- `packaging.md`: current packaging boundary and future installer direction.

Useful release commands:

```powershell
npm run verify:quick
npm run release:verify
npm run release:preflight
npm run release:readiness
npm run release:check-hygiene
npm run release:check-staged
npm run smoke:public-hygiene
npm run smoke:staged-release
npm run smoke:agent-pipeline
npm run smoke:quickstart
npm run smoke:bichon
```

## Legacy Hackathon Material

Historical hackathon planning notes, realtime observer demos, report ideas, shelter-demo notes, and private legacy pet workspace-era engineering plans are not included in the default public release tree.

They can be published later only after a dedicated privacy, media-rights, and product-boundary review. New contributors should treat realtime camera streams, multimodal observer, event-server, reports, QA, and shelter pages as experimental or legacy modules unless the current README says otherwise.
