# PetPresence Quickstart

This quickstart is the shortest path to check that PetPresence works on your machine.

Target: run the synthetic public desktop pet `pet_demo`, run the cleaned Xiaobai/Bichon demo `pet_bichon_demo`, then create and validate one temporary pet workspace. This does not call paid APIs, upload media, or require realtime camera monitoring.

## 0. Prerequisites

- Node.js >= 22
- Windows 11 for the currently tested desktop runtime
- PowerShell

Python and extra background-removal dependencies are only needed when converting MP4 clips to transparent WebM. This quickstart avoids that slow path.

## 1. Install

From the repository root:

```powershell
npm install
npm --prefix apps/desktop install
```

## 2. Check The Environment

```powershell
npm run pet:doctor
```

Fix `ERROR` items before continuing. `WARN` items can be reviewed later.

## 3. Run The Public Demo Pet

Validate the fixture:

```powershell
npm run pet:validate -- --pet-id pet_demo
```

Run the desktop config smoke:

```powershell
npm --prefix apps/desktop run smoke
```

Start the desktop pet:

```powershell
npm run desktop -- --pet-id pet_demo
```

Use the right-click menu or the `...` button to switch actions.

## 4. Run The Xiaobai / Bichon Demo

The cleaned public Bichon demo has six actions and is separate from the original private private legacy pet workspace legacy folder.

Validate it without opening the desktop window:

```powershell
npm run smoke:bichon
```

Launch it:

```powershell
npm run demo:bichon
```

Use the right-click menu or the `...` button to switch between `idle`, `eat`, `sleep`, `alert`, `play`, and `out_of_view`.

## 5. Smoke-Test The Agent Pipeline

This creates a temporary synthetic pet, scaffolds prompts, exercises the provider contract, registers an action, validates the pet, runs desktop config smoke, and cleans up.

```powershell
npm run smoke:agent-pipeline
```

It does not upload media or call a paid API.

Maintainers and Agents can replay the core no-API quickstart path automatically:

```powershell
npm run smoke:quickstart
```

This validates `pet_demo`, creates a temporary `pet_quickstart_smoke_*` workspace, scaffolds action prompts, registers the synthetic demo WebM, runs desktop config smoke, and cleans up.

## 6. Create A Minimal Private Pet Workspace

Use an ASCII `pet_id`:

```powershell
npm run pet:init -- --pet-id pet_quickstart --name Quickstart --species cat --description "Temporary quickstart pet" --force
npm run pet:create-brief -- --pet-id pet_quickstart --actions idle,wave_paw --media assets\pets\pet_demo\idle\idle.webm --video-api "not configured" --upload-consent "no upload needed for quickstart" --force
npm run pet:scaffold-actions -- --pet-id pet_quickstart --actions idle,wave_paw
npm run pet:doctor -- --pet-id pet_quickstart
```

The per-pet doctor should report the generated `creator_brief.md`, `action_plan.md`, and `prompts/*.txt` files. If those show as `WARN`, run `pet:create-brief` or `pet:scaffold-actions` again before using a provider.

Agents can use structured diagnostics:

```powershell
npm run pet:doctor -- --pet-id pet_quickstart --json
```

At this point you have:

```text
data/pets/pet_quickstart/profile.json
data/pets/pet_quickstart/agent.md
data/pets/pet_quickstart/action_assets.json
data/pets/pet_quickstart/creator_brief.md
data/pets/pet_quickstart/action_plan.md
data/pets/pet_quickstart/prompts/
assets/pets/pet_quickstart/
```

No action media has been registered yet. To try the manifest flow without private media, reuse the synthetic demo WebM:

```powershell
npm run pet:add-action -- --pet-id pet_quickstart --action idle --input assets\pets\pet_demo\idle\idle.webm --skip-alpha --loop true --message "Quickstart idle"
npm run pet:validate -- --pet-id pet_quickstart
npm run pet:validate -- --pet-id pet_quickstart --json
npm --prefix apps/desktop run smoke -- --pet-id pet_quickstart
```

The JSON validation output is intended for Agents and automation. Continue to the desktop smoke only when `summary.ok` is `true`.

Preview:

```powershell
npm run desktop -- --pet-id pet_quickstart
```

## 7. Clean Up The Temporary Pet

The quickstart pet is local test data. Remove it before public release or before running release asset audits for publication:

```powershell
Remove-Item -Recurse -Force data\pets\pet_quickstart, assets\pets\pet_quickstart
```

Do not delete `pet_demo` or `pet_bichon_demo`.

## 8. Next Steps

- To make a real private pet: `docs/user_guide_create_private_pet.md`
- To let an Agent run the workflow: `docs/agent-recipes/create-your-pet.md`
- To use generated MP4s or provider APIs: `docs/provider-adapters.md` and `docs/provider_adapter_cookbook.md`
- To troubleshoot: `docs/troubleshooting.md`
- To prepare a public release: `docs/first_public_release_runbook.md`

## 9. Quick Checks Summary

For everyday development:

```powershell
npm run verify:quick
npm run smoke:quickstart
npm run smoke:bichon
```

Before release:

```powershell
npm run release:verify
npm run release:audit-assets -- --fail-on-unresolved
```
