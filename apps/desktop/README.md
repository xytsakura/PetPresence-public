# PetPresence Desktop

Electron desktop pet runtime for the PetPresence creator pipeline.

It reads `data/pets/<pet_id>/action_assets.json`, loads the registered transparent WebM or MP4 action assets, and exposes those actions through the desktop pet menu. The desktop runtime does not require the experimental event server or observer.

## Run

From the repository root, prefer:

```powershell
npm --prefix apps/desktop install
npm run desktop -- --pet-id pet_demo
```

For a pet created with the creator CLI:

```powershell
npm run desktop -- --pet-id <pet_id>
```

You can also run the lower-level desktop command directly:

```powershell
npm --prefix apps/desktop run dev -- --pet-id <pet_id>
```

If WebSocket is unavailable, use the right-click menu or the `...` button to trigger local actions.

For desktop startup or action playback issues, see:

```text
../../docs/troubleshooting.md
```

## Integration Points

- Default pet: `pet_demo`
- Preferred override: `npm run desktop -- --pet-id <pet_id>`
- Lower-level override: `npm --prefix apps/desktop run dev -- --pet-id <pet_id>`
- WebSocket: `ws://localhost:4317/events/stream?pet_id=<pet_id>`
- Latest/today events: `http://localhost:4317/events/*`
- Mock observer: `http://localhost:3002/observe/mock` experimental

The default public fixture lives in `data/pets/pet_demo/action_assets.json`.
