# Video Provider Adapter Notes

PetPresence does not require a specific video generation provider. The open-source core starts after a source clip exists.

This document defines the boundary for future provider adapters so the project can support image-to-video models without making any paid API mandatory.

For a step-by-step guide to implementing a real provider adapter, see:

```text
docs/provider_adapter_cookbook.md
```

## Adapter Responsibility

A provider adapter may:

- read user-provided prompt text and local reference image paths;
- call a video generation API chosen by the user;
- download the generated short video to a local source directory;
- return a local `.mp4` path for `pet:add-action`.

A provider adapter must not:

- commit API keys;
- upload private pet media without explicit user confirmation;
- assume generated video quality is good enough;
- bypass `pet:validate`;
- write directly into `action_assets.json` unless it goes through the creator CLI or the same manifest contract.

## Minimal Contract

The repository includes a local synthetic example adapter. It does not call any external API or upload user media; it only generates a tiny MP4 so Agent workflows can test the provider boundary.

```powershell
npm run provider:example -- --pet-id pet_huahua --action idle --prompt "Create a calm idle animation"
```

The command writes a local MP4 under:

```text
outputs/generated/<pet_id>/<action>.mp4
```

The expected adapter output is:

```json
{
  "ok": true,
  "provider": "example-local-synthetic",
  "pet_id": "pet_huahua",
  "action": "idle",
  "source_video": "outputs/generated/pet_huahua/idle.mp4",
  "prompt": "Create a short 4-second idle animation...",
  "reference_images": [],
  "next_command": "npm run pet:add-action -- ..."
}
```

After the adapter returns a local source video, the Agent should run:

```powershell
npm run pet:add-action -- --pet-id pet_huahua --action idle --input "outputs\generated\pet_huahua\idle.mp4" --convert-alpha --loop true --message "I am here~"
```

## Local Import Adapter

If a user already generated an MP4 with any external model, normalize that file into the same provider contract:

```powershell
npm run provider:import -- --pet-id pet_huahua --action idle --input "D:\pets\huahua_idle_from_model.mp4" --prompt-file "data/pets/pet_huahua/prompts/idle.txt"
```

This command copies the MP4 to:

```text
outputs/generated/<pet_id>/<action>.mp4
```

It then prints the same JSON contract as a real provider adapter. It does not upload media, call an API, or edit `action_assets.json`.

## Contract Validator

Provider adapters should write their JSON result to a file and validate it before running `pet:add-action`:

```powershell
npm run provider:validate-result -- --input outputs/generated/pet_huahua/provider-result.json --pet-id pet_huahua --action idle
```

The validator checks that:

- `ok` is `true`;
- `provider`, `pet_id`, `action`, `source_video`, `prompt`, and `next_command` are present;
- `reference_images` is an array;
- `pet_id` and `action` are safe ASCII IDs;
- `source_video` exists and points to an `.mp4`;
- `next_command` points back to `npm run pet:add-action`.

## Suggested Adapter Flow

1. Confirm the provider name and whether the user accepts its data policy.
2. Confirm which reference images or videos can be uploaded.
3. Generate or edit the action prompt.
4. Call the provider API.
5. Save the returned video under `outputs/generated/<pet_id>/<action>.mp4`.
6. Run `pet:add-action --convert-alpha`.
7. Run `pet:validate`.
8. Launch desktop preview and ask for visual feedback.

## Environment Variables

Provider adapters should read keys from environment variables, for example:

```text
PETPRESENCE_VIDEO_PROVIDER=example-provider
PETPRESENCE_VIDEO_API_KEY=...
PETPRESENCE_VIDEO_API_BASE=https://api.example.com
```

Do not write real keys to `.env.example`, docs, tests, screenshots, or generated reports.

## Example Adapter Smoke

The CI-friendly provider check is:

```powershell
npm run smoke:provider-example
npm run smoke:provider-import
```

These checks run the local synthetic adapter, verify MP4 output, validate the import provider contract, and remove temporary output directories. They intentionally do not call `pet:add-action --convert-alpha`; that path is covered by `npm run smoke:creator-alpha`.

## Implementing A Real Provider

Use `scripts/providers/provider-template.ts` as the scaffold and `scripts/providers/example-video-provider.ts` as the CI-safe smoke baseline. A real adapter should:

- read API credentials from environment variables;
- require explicit user confirmation before uploading reference images or videos;
- print the same JSON contract on success;
- save generated videos under `outputs/generated/<pet_id>/<action>.mp4`;
- pass `npm run provider:validate-result`;
- fail clearly when the provider rejects input, returns no video, or returns a non-MP4 asset;
- leave manifest updates to `pet:add-action`.

## Quality Checklist

Before registering a generated video as a final action, check:

- the pet identity is still recognizable;
- the action is clear and not too chaotic;
- the camera is stable;
- the clip is short, ideally 3 to 6 seconds;
- there is no text, watermark, or unrelated object;
- foreground extraction does not destroy important body parts;
- looping actions such as `idle` and `sleep` feel stable.
