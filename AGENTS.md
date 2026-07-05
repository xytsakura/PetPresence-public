# Agent Collaboration Notes

PetPresence is an open-source creator pipeline for private desktop pets.

The default workflow is:

```text
pet photos, videos, or generated clips
  -> Agent plans actions and writes a creator brief
  -> Creator CLI creates a pet profile and action manifest
  -> optional provider adapter produces or imports action videos
  -> optional alpha conversion turns MP4 clips into transparent WebM
  -> Electron desktop runtime loads action_assets.json
```

## Release Surface

- Keep `pet_demo` and `pet_bichon_demo` as the public fixtures.
- Treat realtime camera monitoring, multimodal observer services, event server, reports, QA, and shelter/adoption pages as experimental or legacy unless the README says otherwise.
- Do not commit private pet media, API keys, provider outputs, extracted frames, event logs, generated reports, local `outputs/`, or `.env` files.
- Do not reintroduce raw private legacy pet workspace, shelter media, presentation artifacts, original MP4 clips, alpha previews, contact sheets, or checker images without a new release privacy review.

## Useful Commands

```powershell
npm run pet:doctor
npm run pet:validate -- --pet-id pet_demo
npm run smoke:bichon
npm run smoke:agent-pipeline
npm run verify:quick
npm run release:verify
npm run release:preflight
```

For Windows PowerShell execution policy issues, use `npm.cmd run <script>` or `cmd.exe /c npm run <script>`.
