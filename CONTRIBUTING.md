# Contributing

Thanks for helping make PetPresence easier to use.

## Project Direction

The main open-source direction is the creator pipeline:

```text
pet photos / short clips / personality notes
  -> action assets
  -> action_assets.json
  -> Electron desktop pet
```

Realtime observation, event history, reports, and QA are experimental extensions. Contributions to them are welcome, but they should not make the default creator workflow harder to run.

## Development Setup

```powershell
npm install
npm --prefix apps/desktop install
npm run verify:quick
```

`verify:quick` is the CI-friendly gate. It runs public config and hygiene checks, typecheck, protocol tests, provider smokes, public hygiene smoke, creator smokes, `pet_demo` validation, desktop config smoke, and the strict public asset audit.

## Creator Pipeline Checks

Before submitting creator-pipeline changes, run:

```powershell
npm run verify:quick
```

If you add or change CLI behavior, include a short example in `README.md` or `docs/agent-recipes/create-your-pet.md`.

Before publishing or changing alpha conversion behavior, also run:

```powershell
npm run release:verify
npm run release:check-hygiene
npm run smoke:public-hygiene
```

## Issues And Pull Requests

Use the GitHub issue templates when reporting bugs, creator-pipeline help requests, provider adapter problems, or media/privacy review questions. They are designed to collect enough context without asking users to publish private pet media.

Pull requests should follow `.github/PULL_REQUEST_TEMPLATE.md` and include:

- a short summary;
- affected scope;
- verification commands;
- privacy/media confirmation;
- reviewer notes for risky areas.

Maintainer triage guidance lives in:

```text
docs/maintainer_triage.md
```

## Media And Assets

Only commit media that you have the right to publish. Do not commit private pet videos, generated paid-model outputs, or third-party assets without permission.

The public sample fixtures are `pet_demo` and `pet_bichon_demo`. Original hackathon working materials and old shelter launcher assets are local legacy data and should not be added back to a public release unless their publication rights are explicitly confirmed.

Do not commit `.env` files or real provider API keys. Keep provider adapter examples local-first and use placeholders in documentation.

## Style

- Keep the default path local-first.
- Prefer explicit validation over silent fallback.
- Keep pet behavior descriptions grounded in observable behavior.
- Do not add health, psychology, or medical diagnosis claims.
