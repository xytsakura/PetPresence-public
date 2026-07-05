# Maintainer Triage Guide

This guide helps maintainers handle public issues and pull requests without losing the project's privacy boundary or creator-pipeline focus.

## Default Labels

Suggested labels:

- `creator-pipeline`: pet creation workflow, CLI, manifests, Agent recipe.
- `desktop-runtime`: Electron runtime, menus, action playback, config loading.
- `provider-adapter`: video generation adapters, provider contracts, local import.
- `alpha-conversion`: MP4 to transparent WebM processing.
- `privacy`: media, API keys, provider upload, generated data.
- `media-review`: questions about whether an asset can be published.
- `experimental`: observer, event-server, reports, QA, shelter launcher.
- `docs`: README, guides, recipes, release notes.
- `release`: readiness, CI, asset audit, clean export, tagging.

## First Response Checklist

For every issue:

1. Identify the area: creator, desktop, provider, alpha conversion, privacy, release, or experimental.
2. Check whether the reporter included commands and validation output.
3. Ask for `npm run pet:doctor` or `npm run pet:validate` output when the issue involves a pet workspace.
4. Ask for `provider:validate-result` output when the issue involves a provider adapter.
5. Remind the reporter not to upload private pet media, `.env`, API keys, provider URLs, frames, event logs, or reports.

## Creator Pipeline Issues

Ask for:

- operating system;
- Node and npm versions;
- `pet_id`;
- action list;
- media type: WebM, MP4, provider output, or self-shot clip;
- output from:

```powershell
npm run pet:doctor -- --pet-id <pet_id>
npm run pet:validate -- --pet-id <pet_id>
```

If the issue is reproducible with `pet_demo`, it is likely a project bug. If it only happens with private media, treat it as a media-quality or conversion-debugging issue until proven otherwise.

## Provider Adapter Issues

Do not ask for real API keys or private provider dashboards.

Ask for:

- provider name;
- sanitized provider JSON contract;
- `provider:validate-result` output;
- whether reference media upload was explicitly confirmed;
- whether the downloaded file is an MP4 under `outputs/generated/<pet_id>/<action>.mp4`.

Real provider adapters should not be added to the default CI gate if they require paid API keys, network calls, or user media upload.

## Alpha Conversion Issues

Ask for:

- source video format and duration;
- whether the pet is low-contrast or white on a light background;
- command used for `pet:add-action` or the PowerShell conversion script;
- preview symptoms: missing body parts, rough edges, flicker, background residue, or huge output file.

Avoid asking the user to upload the source clip publicly. If visual evidence is needed, ask for a cropped, redacted, or synthetic reproduction when possible.

## Privacy And Media Review

Default stance:

```text
If rights or privacy are unclear, do not publish the file.
```

Keep public fixtures small, synthetic or explicitly publishable, and referenced by docs or tests. Use:

```powershell
npm run release:audit-assets
npm run release:audit-assets -- --fail-on-unresolved
npm run release:check-hygiene
npm run release:check-staged
npm run smoke:public-hygiene
npm run smoke:staged-release
```

Do not approve private legacy pet workspace, shelter media, presentation artifacts, frames, events, reports, `outputs/`, or paid-model outputs without explicit release-decision updates.

## Pull Request Review

Before merging a PR, check:

- Does it keep the default path centered on the creator pipeline?
- Does it avoid making realtime observer, reports, or shelter modules required?
- Does it include docs updates when commands or user workflow change?
- Does `npm run verify:quick` pass?
- For release-facing or alpha-conversion work, does `npm run release:verify` pass?
- For assets, does `release:audit-assets -- --fail-on-unresolved` pass?
- Does `release:check-hygiene` pass without commit-visible `.env`, API keys, outputs, private media, frames, events, or reports?
- Does `release:check-staged` pass before committing release-facing changes?
- If hygiene logic changed, does `smoke:public-hygiene` prove dangerous files are still blocked?
- If staged-content logic changed, does `smoke:staged-release` prove dangerous staged files are still blocked?
- Does it avoid committing private media, `.env`, API keys, generated outputs, frames, events, and reports?

## Close Or Redirect

Close or redirect issues that:

- ask for medical, psychological, health, or safety diagnosis;
- require uploading private media without consent;
- request bundled commercial API keys;
- turn experimental realtime monitoring into a default setup requirement;
- are not actionable after the reporter cannot provide sanitized commands or validation output.
