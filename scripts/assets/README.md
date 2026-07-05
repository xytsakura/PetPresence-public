# PetPresence Asset Scripts

## MP4 to Alpha WebM

Use `remove_background_to_alpha_webm.ps1` when a short action video has a plain or simple background and should become a transparent desktop-pet animation.

This is the recommended creator-pipeline path. `convert_mp4_to_webm.ps1` is a simpler legacy/chromakey helper and should only be used when you intentionally want that lighter conversion path.

Example:

```powershell
.\scripts\assets\remove_background_to_alpha_webm.ps1 `
  -PetId pet_huahua `
  -Action eat `
  -InputPath "D:\path\to\pet-eating.mp4"
```

What it does:

1. Copies the input to `assets/pets/<pet_id>/<action>/<action>.mp4`.
2. Extracts frames at 24 fps and scales height to 512 px.
3. Uses `rembg` with `isnet-general-use` to segment the foreground frame by frame.
4. Stabilizes the alpha mask with temporal median filtering, fills the largest subject region, and uses a plain-background color mask to recover low-contrast white fur/body areas.
5. Encodes `assets/pets/<pet_id>/<action>/<action>.webm` as VP9 alpha WebM.
6. Writes a checkerboard preview image next to the output.
7. Decodes one frame with `libvpx-vp9` and fails if alpha is fully opaque.

Notes:

- First run downloads Python packages and the `isnet-general-use` model under `%LOCALAPPDATA%\PetPresenceTools`.
- This is better than white chromakey for white pets, because chromakey damages white fur and bowl edges.
- The script strengthens and stabilizes the model's alpha matte by default (`-AlphaCutoff 10 -AlphaPower 0.72 -AlphaScale 4.8 -TemporalMedian 5 -SolidAlphaThreshold 18 -AlphaBlur 0.65`) so white fur/body areas do not look too ghost-like on the desktop.
- `-ColorMaskThreshold 12` assumes a clean plain background and helps recover low-contrast white-pet body regions that the model may miss. Set `-ColorMaskThreshold 0` for cluttered or non-plain backgrounds.
- If the result still flickers, inspect `<action>.alpha_preview.jpg` first, then tune `-TemporalMedian`, `-SolidAlphaThreshold`, and `-ColorMaskThreshold` for that action.
