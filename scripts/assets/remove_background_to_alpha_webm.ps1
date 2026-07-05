param(
  [string]$PetId = "pet_demo",

  [Parameter(Mandatory = $true)]
  [string]$Action,

  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [int]$Fps = 24,
  [int]$Height = 512,
  [int]$Crf = 30,
  [string]$Model = "isnet-general-use",
  [int]$AlphaCutoff = 10,
  [double]$AlphaPower = 0.72,
  [double]$AlphaScale = 4.8,
  [int]$TemporalMedian = 5,
  [int]$SolidAlphaThreshold = 18,
  [double]$AlphaBlur = 0.65,
  [int]$ColorMaskThreshold = 12,
  [string]$Python = "",
  [switch]$KeepWorkDir
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$inputFile = Resolve-Path $InputPath
if ($PetId -notmatch '^[A-Za-z0-9_-]+$') {
  throw "PetId may only contain letters, numbers, underscores, and hyphens."
}
if ($Action -notmatch '^[A-Za-z0-9_-]+$') {
  throw "Action may only contain letters, numbers, underscores, and hyphens."
}
$actionDir = Join-Path $repoRoot "assets\pets\$PetId\$Action"
$sourceCopy = Join-Path $actionDir "$Action.mp4"
$outputFile = Join-Path $actionDir "$Action.webm"
$previewFile = Join-Path $actionDir "$Action.alpha_preview.jpg"
$toolRoot = Join-Path $env:LOCALAPPDATA "PetPresenceTools"
$pythonTargetBase = Join-Path $toolRoot "python-rembg"
$modelRoot = Join-Path $toolRoot "rembg-models"
$workDir = Join-Path $env:TEMP ("petpresence-alpha-" + $Action + "-" + [guid]::NewGuid().ToString("N"))
$rawDir = Join-Path $workDir "raw"
$rgbaDir = Join-Path $workDir "rgba"
$finalDir = Join-Path $workDir "final"

function Resolve-Python {
  param([string]$ExplicitPython)

  if ($ExplicitPython -and (Test-Path -LiteralPath $ExplicitPython)) {
    return (Resolve-Path -LiteralPath $ExplicitPython).Path
  }

  if ($env:PETPRESENCE_PYTHON -and (Test-Path -LiteralPath $env:PETPRESENCE_PYTHON)) {
    return (Resolve-Path -LiteralPath $env:PETPRESENCE_PYTHON).Path
  }

  $pyCommand = Get-Command py -ErrorAction SilentlyContinue
  if ($pyCommand) {
    foreach ($versionArg in @("-3.12", "-3.13", "-3")) {
      $candidate = & $pyCommand.Source $versionArg -c "import sys; print(sys.executable)" 2>$null
      if ($LASTEXITCODE -eq 0 -and $candidate -and (Test-Path -LiteralPath $candidate)) {
        return (Resolve-Path -LiteralPath $candidate).Path
      }
    }
  }

  $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
  if ($pythonCommand) {
    return $pythonCommand.Source
  }

  throw "Python not found. Pass -Python <python.exe> or set PETPRESENCE_PYTHON."
}

function Resolve-Ffmpeg {
  $candidates = @()
  if ($env:FFMPEG_PATH) {
    $candidates += $env:FFMPEG_PATH
  }
  $pathCommand = Get-Command ffmpeg -ErrorAction SilentlyContinue
  if ($pathCommand) {
    $candidates += $pathCommand.Source
  }
  $candidates += (Join-Path $repoRoot "node_modules\ffmpeg-static\ffmpeg.exe")
  $candidates += (Join-Path $env:LOCALAPPDATA "PetPresenceTools\ffmpeg\ffmpeg.exe")
  $candidates += (Join-Path $env:TEMP "petpresence-video-tools\node_modules\ffmpeg-static\ffmpeg.exe")

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  throw "ffmpeg not found. Run scripts/assets/install_ffmpeg.ps1, npm install, or set FFMPEG_PATH."
}

function Test-PythonModule {
  param(
    [string]$PythonExe,
    [string]$TargetPath,
    [string]$Module
  )

  $env:PETPRESENCE_PYTHON_TARGET = $TargetPath
  $code = @"
import importlib.util, os, sys
target = os.environ.get("PETPRESENCE_PYTHON_TARGET")
if target:
    sys.path.insert(0, target)
raise SystemExit(0 if importlib.util.find_spec("$Module") else 1)
"@
  $code | & $PythonExe -
  return $LASTEXITCODE -eq 0
}

function Ensure-BackgroundRemovalDeps {
  param(
    [string]$PythonExe,
    [string]$TargetPath
  )

  New-Item -ItemType Directory -Force -Path $TargetPath | Out-Null
  if ((Test-PythonModule -PythonExe $PythonExe -TargetPath $TargetPath -Module "rembg") -and
      (Test-PythonModule -PythonExe $PythonExe -TargetPath $TargetPath -Module "onnxruntime") -and
      (Test-PythonModule -PythonExe $PythonExe -TargetPath $TargetPath -Module "scipy")) {
    return
  }

  & $PythonExe -m pip install --target $TargetPath --upgrade rembg onnxruntime scipy
}

$pythonExe = Resolve-Python -ExplicitPython $Python
$pythonVersionTag = (& $pythonExe -c "import sys; print(f'py{sys.version_info.major}{sys.version_info.minor}')").Trim()
if ($LASTEXITCODE -ne 0 -or -not $pythonVersionTag) {
  throw "Unable to determine Python version for $pythonExe."
}
$pythonTarget = "$pythonTargetBase-$pythonVersionTag"
$ffmpeg = Resolve-Ffmpeg

New-Item -ItemType Directory -Force -Path $actionDir, $rawDir, $rgbaDir, $finalDir, $modelRoot | Out-Null
if ((Resolve-Path -LiteralPath $inputFile).Path -ne (Join-Path (Resolve-Path -LiteralPath $actionDir).Path "$Action.mp4")) {
  Copy-Item -Force -LiteralPath $inputFile -Destination $sourceCopy
}
Ensure-BackgroundRemovalDeps -PythonExe $pythonExe -TargetPath $pythonTarget

& $ffmpeg `
  -y `
  -hide_banner `
  -loglevel error `
  -i $sourceCopy `
  -vf "scale=-2:$Height,fps=$Fps" `
  (Join-Path $rawDir "frame_%03d.png")
if ($LASTEXITCODE -ne 0) {
  throw "ffmpeg frame extraction failed for $sourceCopy."
}

$env:PYTHONPATH = $pythonTarget
$env:U2NET_HOME = $modelRoot
$env:PETPRESENCE_ALPHA_WORKDIR = $workDir
$env:PETPRESENCE_ALPHA_MODEL = $Model
$env:PETPRESENCE_ALPHA_PREVIEW = $previewFile
$env:PETPRESENCE_ALPHA_CUTOFF = [string]$AlphaCutoff
$env:PETPRESENCE_ALPHA_POWER = [string]$AlphaPower
$env:PETPRESENCE_ALPHA_SCALE = [string]$AlphaScale
$env:PETPRESENCE_ALPHA_TEMPORAL_MEDIAN = [string]$TemporalMedian
$env:PETPRESENCE_ALPHA_SOLID_THRESHOLD = [string]$SolidAlphaThreshold
$env:PETPRESENCE_ALPHA_BLUR = [string]$AlphaBlur
$env:PETPRESENCE_ALPHA_COLOR_THRESHOLD = [string]$ColorMaskThreshold

$removeScript = @'
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
from rembg import remove, new_session
import os
import time
import numpy as np
from scipy import ndimage

work_dir = Path(os.environ["PETPRESENCE_ALPHA_WORKDIR"])
model = os.environ["PETPRESENCE_ALPHA_MODEL"]
preview_path = Path(os.environ["PETPRESENCE_ALPHA_PREVIEW"])
alpha_cutoff = int(os.environ["PETPRESENCE_ALPHA_CUTOFF"])
alpha_power = float(os.environ["PETPRESENCE_ALPHA_POWER"])
alpha_scale = float(os.environ["PETPRESENCE_ALPHA_SCALE"])
temporal_median = max(1, int(os.environ["PETPRESENCE_ALPHA_TEMPORAL_MEDIAN"]))
solid_threshold = max(0, int(os.environ["PETPRESENCE_ALPHA_SOLID_THRESHOLD"]))
alpha_blur = max(0.0, float(os.environ["PETPRESENCE_ALPHA_BLUR"]))
color_threshold = max(0, int(os.environ["PETPRESENCE_ALPHA_COLOR_THRESHOLD"]))
raw_dir = work_dir / "raw"
rgba_dir = work_dir / "rgba"
final_dir = work_dir / "final"
frames = sorted(raw_dir.glob("frame_*.png"))
if not frames:
    raise SystemExit("no frames found")

session = new_session(model)
start = time.time()
alpha_masks = []
for index, frame in enumerate(frames, 1):
    image = Image.open(frame).convert("RGB")
    output = remove(
        image,
        session=session,
        alpha_matting=True,
        alpha_matting_foreground_threshold=240,
        alpha_matting_background_threshold=10,
        alpha_matting_erode_size=4,
    ).convert("RGBA")
    red, green, blue, alpha = output.split()
    alpha = alpha.point(
        lambda value: 0
        if value < alpha_cutoff
        else min(255, int((value ** alpha_power) * alpha_scale))
    )
    output = Image.merge("RGBA", (red, green, blue, alpha))
    output.save(rgba_dir / frame.name)
    alpha_array = np.array(alpha, dtype=np.uint8)

    if color_threshold > 0:
        rgb = np.asarray(image).astype(np.int16)
        patches = [rgb[:30, :30], rgb[:30, -30:], rgb[-30:, :30], rgb[-30:, -30:]]
        background = np.median(
            np.concatenate([patch.reshape(-1, 3) for patch in patches], axis=0),
            axis=0,
        )
        color_distance = np.sqrt(((rgb - background) ** 2).sum(axis=2))
        combined = (color_distance > color_threshold) | (alpha_array > alpha_cutoff)
        combined = ndimage.binary_closing(combined, structure=np.ones((7, 7)), iterations=2)
        combined = ndimage.binary_fill_holes(combined)
        labels, count = ndimage.label(combined)
        if count:
            sizes = ndimage.sum(combined, labels, range(1, count + 1))
            keep = 1 + int(np.argmax(sizes))
            combined = labels == keep
        combined = ndimage.binary_opening(combined, structure=np.ones((3, 3)), iterations=1)
        alpha_array = np.where(combined, 255, 0).astype(np.uint8)

    alpha_masks.append(alpha_array)
    if index == 1 or index % 20 == 0 or index == len(frames):
        print(f"processed {index}/{len(frames)} frames")

alpha_stack = np.stack(alpha_masks, axis=0)
half_window = temporal_median // 2
for index, frame in enumerate(frames, 1):
    start_index = max(0, index - 1 - half_window)
    end_index = min(len(frames), index + half_window)
    alpha_array = np.median(alpha_stack[start_index:end_index], axis=0).astype(np.uint8)
    if solid_threshold > 0:
        alpha_array = np.where(alpha_array >= solid_threshold, 255, 0).astype(np.uint8)
    alpha = Image.fromarray(alpha_array, "L")
    if alpha_blur > 0:
        alpha = alpha.filter(ImageFilter.GaussianBlur(radius=alpha_blur))
    image = Image.open(frame).convert("RGBA")
    image.putalpha(alpha)
    image.save(final_dir / frame.name)

sample = Image.open(final_dir / frames[min(len(frames) // 3, len(frames) - 1)].name).convert("RGBA")
checker = Image.new("RGBA", sample.size, (230, 230, 230, 255))
draw = ImageDraw.Draw(checker)
size = 24
for y in range(0, sample.height, size):
    for x in range(0, sample.width, size):
        if (x // size + y // size) % 2:
            draw.rectangle([x, y, x + size - 1, y + size - 1], fill=(150, 150, 150, 255))
checker.alpha_composite(sample)
checker.convert("RGB").save(preview_path, quality=95)
print(f"done in {time.time() - start:.1f}s")
'@

$removeScript | & $pythonExe -
if ($LASTEXITCODE -ne 0) {
  throw "background removal failed for $sourceCopy."
}

& $ffmpeg `
  -y `
  -hide_banner `
  -loglevel error `
  -framerate $Fps `
  -i (Join-Path $finalDir "frame_%03d.png") `
  -an `
  -c:v libvpx-vp9 `
  -pix_fmt yuva420p `
  -auto-alt-ref 0 `
  -b:v 0 `
  -crf $Crf `
  -metadata:s:v:0 alpha_mode=1 `
  $outputFile
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $outputFile)) {
  throw "ffmpeg alpha WebM encode failed for $outputFile."
}

$env:PETPRESENCE_ALPHA_OUTPUT = $outputFile
$env:PETPRESENCE_ALPHA_FFMPEG = $ffmpeg
$verifyScript = @'
from pathlib import Path
from PIL import Image
import os
import subprocess
import tempfile

ffmpeg = os.environ["PETPRESENCE_ALPHA_FFMPEG"]
output = Path(os.environ["PETPRESENCE_ALPHA_OUTPUT"])
tmp = Path(tempfile.mkdtemp(prefix="petpresence-alpha-check-"))
png = tmp / "frame.png"
subprocess.run(
    [ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-c:v", "libvpx-vp9", "-ss", "1", "-i", str(output), "-frames:v", "1", str(png)],
    check=True,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
image = Image.open(png).convert("RGBA")
alpha = image.getchannel("A")
amin, amax = alpha.getextrema()
if amin == 255 and amax == 255:
    raise SystemExit("alpha verification failed: decoded frame is fully opaque")
print(f"alpha verification passed: alpha range {amin}..{amax}")
'@

$verifyScript | & $pythonExe -

if (-not $KeepWorkDir) {
  Remove-Item -LiteralPath $workDir -Recurse -Force
}

Write-Output "Source copied: $sourceCopy"
Write-Output "Alpha WebM: $outputFile"
Write-Output "Preview: $previewFile"
if ($KeepWorkDir) {
  Write-Output "Work dir kept: $workDir"
}
