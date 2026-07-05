# Action Plan: pet_bichon_demo

This public demo is designed to show the desktop runtime immediately after install. It is not a realtime pet-monitoring setup and does not require camera access, multimodal recognition, paid APIs, or private source media.

## Action Set

| action | role | loop |
| --- | --- | --- |
| `idle` | calm default desktop presence | yes |
| `eat` | short eating/snack animation | no |
| `sleep` | resting animation | no |
| `alert` | gentle attention request | no |
| `play` | playful movement | no |
| `out_of_view` | temporarily away from view | no |

## Runtime Checks

```powershell
npm run pet:validate -- --pet-id pet_bichon_demo
npm --prefix apps/desktop run smoke -- --pet-id pet_bichon_demo
npm run demo:bichon
```

## Publication Boundary

Only the WebM runtime assets and creator-planning text files are public. Historical private materials remain excluded by release hygiene guards.
