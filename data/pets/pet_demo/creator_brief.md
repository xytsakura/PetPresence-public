# Demo Pet Creator Brief

This brief is the user-confirmed starting point for an Agent-assisted PetPresence workflow.
It does not call a video API, upload media, or register assets. Review it before generating prompts or using external providers.

## Pet Identity

- pet_id: pet_demo
- name: Demo Pet
- species: synthetic
- personality: A synthetic public fixture used to verify the open-source creator pipeline.
- local_only_default: true

## Requested Actions

- idle
- wave_paw

## Available Media

- Synthetic WebM fixture generated locally by `npm run release:generate-demo-fixture`.
- No real private pet photo, video, event log, frame, or report is used.

## Video Generation

- video_api_status: not configured; public fixture is generated locally
- upload_consent: no upload needed for this synthetic public fixture
- provider_boundary: Do not upload reference images or videos unless the user explicitly confirms that provider and upload.
- api_key_boundary: Do not write real API keys into repository files, docs, screenshots, or issues.

## Privacy Boundary

- Treat `assets/pets/<pet_id>/` as private user media unless the user confirms publication rights.
- Treat `outputs/`, extracted frames, event logs, and generated reports as private local data.
- Do not commit paid-model outputs unless the provider terms and user permission allow publication.
- Do not make medical, psychological, health, or safety diagnosis claims.

## Acceptance Checks

- `npm run pet:doctor -- --pet-id pet_demo` has no `ERROR`.
- `npm run pet:validate -- --pet-id pet_demo` passes.
- `npm --prefix apps/desktop run smoke -- --pet-id pet_demo` passes.
- `npm run desktop -- --pet-id pet_demo` opens a preview the user can inspect.
- The user can identify which files are private and should not be committed.

## Recommended Next Commands

```powershell
npm run pet:scaffold-actions -- --pet-id pet_demo --actions idle,wave_paw
npm run pet:doctor -- --pet-id pet_demo
```
