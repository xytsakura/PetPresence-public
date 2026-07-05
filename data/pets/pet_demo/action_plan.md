# Demo Pet Action Plan

This file is generated for an Agent-assisted PetPresence workflow.
It does not call a video API, upload media, or register assets. Use it to prepare prompts and source clips.

## Pet

- pet_id: pet_demo
- name: Demo Pet
- species: synthetic
- description: A synthetic public fixture used to verify the open-source creator pipeline.

## Actions

### idle

- purpose: default calm presence
- motion: front-facing, mostly still, subtle breathing, tiny head or body movement
- loop: true
- duration_ms: 4000
- fallback_message: I am here~
- prompt_file: data/pets/pet_demo/prompts/idle.txt

Suggested local synthetic provider command:

```powershell
npm run provider:example -- --pet-id pet_demo --action idle --prompt-file "data/pets/pet_demo/prompts/idle.txt"
```

After a real or synthetic provider writes an MP4, register it with:

```powershell
npm run pet:add-action -- --pet-id pet_demo --action idle --input "outputs/generated/pet_demo/idle.mp4" --convert-alpha --loop true --duration-ms 4000 --message "I am here~"
```

### wave_paw

- purpose: friendly greeting
- motion: raising one paw or making a tiny greeting movement
- loop: false
- duration_ms: 3000
- fallback_message: Hi~
- prompt_file: data/pets/pet_demo/prompts/wave_paw.txt

Suggested local synthetic provider command:

```powershell
npm run provider:example -- --pet-id pet_demo --action wave_paw --prompt-file "data/pets/pet_demo/prompts/wave_paw.txt"
```

After a real or synthetic provider writes an MP4, register it with:

```powershell
npm run pet:add-action -- --pet-id pet_demo --action wave_paw --input "outputs/generated/pet_demo/wave_paw.mp4" --convert-alpha --loop false --duration-ms 3000 --message "Hi~"
```

## Final Checks

```powershell
npm run pet:doctor -- --pet-id pet_demo
npm run pet:validate -- --pet-id pet_demo
npm run desktop -- --pet-id pet_demo
```
