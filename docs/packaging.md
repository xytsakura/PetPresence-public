# Packaging Notes

PetPresence currently supports a development-mode desktop preview, not a packaged installer release.

The supported public workflow is:

```powershell
npm install
npm --prefix apps/desktop install
npm run desktop -- --pet-id pet_demo
```

For a custom pet created with the Creator CLI:

```powershell
npm run desktop -- --pet-id <pet_id>
```

## Current Boundary

The first open-source release should not promise a one-click installer.

Current status:

- Windows desktop runtime works in Electron development mode.
- Pet assets are loaded from the repository workspace.
- User-created media stays local in `assets/pets/<pet_id>/` and `data/pets/<pet_id>/`.
- The desktop app can be smoke-tested with `npm --prefix apps/desktop run smoke`.

Not yet supported:

- signed Windows installers;
- automatic app updates;
- cross-platform packaged builds;
- a GUI packaging wizard;
- bundling private pet media into a distributable installer.

## Future Packaging Direction

A future packaging workflow should answer these questions before implementation:

1. Should the installer include one selected pet, or should it load pets from a user data directory?
2. Where should private pet media live outside the Git workspace?
3. How should provider API keys and `.env` values be excluded from packaged output?
4. Should builds use `electron-builder`, `electron-forge`, or a lighter custom script?
5. How will Windows signing, update channels, and release artifacts be handled?

Recommended staged path:

1. Add a local `dist` build for the desktop runtime only.
2. Add an explicit pet export/import format.
3. Add an unsigned Windows package for local testing.
4. Add signing and update flow only after the creator pipeline is stable.

Until then, release notes should say: "Packaging installers are future work."
