# Summary

Describe what changed and why.

## Scope

- [ ] Creator pipeline
- [ ] Desktop runtime
- [ ] Provider adapter or provider docs
- [ ] Media/privacy/release tooling
- [ ] Experimental observer/event/report module
- [ ] Documentation only

## Verification

Run the relevant checks and paste the result summary:

```powershell
npm run verify:quick
```

For release-facing, alpha-conversion, dependency, or public-asset changes, also run:

```powershell
npm run release:verify
npm run release:audit-assets -- --fail-on-unresolved
```

## Privacy And Media

- [ ] I did not commit private pet media, paid-model outputs, event logs, extracted frames, generated reports, `.env` files, or real API keys.
- [ ] Any committed media is synthetic, original, explicitly licensed, or otherwise approved for publication.
- [ ] Provider changes require explicit user confirmation before uploading reference images or videos.

## Notes For Reviewers

Call out risky areas, limitations, or follow-up work.
