# Creator Brief: pet_bichon_demo

## Scope

- pet_id: `pet_bichon_demo`
- name: Xiaobai
- species: dog
- demo purpose: public ready-to-run desktop pet demo
- source boundary: cleaned runtime assets copied from the local hackathon Xiaobai action set

## Actions

- `idle`
- `eat`
- `sleep`
- `alert`
- `play`
- `out_of_view`

## Media And Privacy

- Public release includes only runtime-ready transparent WebM files.
- Public release excludes original MP4 clips, extracted frames, event JSONL, generated reports, alpha previews, contact sheets, checker images, and local outputs.
- No external video API call is needed to run this demo.
- No user media upload is needed to run this demo.

## Acceptance Checks

- `npm run pet:doctor -- --pet-id pet_bichon_demo` has no `ERROR`.
- `npm run pet:validate -- --pet-id pet_bichon_demo` passes.
- `npm --prefix apps/desktop run smoke -- --pet-id pet_bichon_demo` passes.
- `npm run demo:bichon` launches the desktop demo in development mode.
