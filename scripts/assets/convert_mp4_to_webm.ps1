param(
  [string]$PetId = "pet_demo",

  [Parameter(Mandatory = $true)]
  [ValidateSet("idle", "eat", "sleep", "play", "alert", "out_of_view")]
  [string]$Action,

  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [int]$Fps = 24,
  [int]$Size = 512,
  [string]$ChromaKeyColor = "",
  [double]$Similarity = 0.12,
  [double]$Blend = 0.04
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$inputFile = Resolve-Path $InputPath
$actionDir = Join-Path $repoRoot "assets\pets\$PetId\$Action"
$outputFile = Join-Path $actionDir "$Action.webm"

New-Item -ItemType Directory -Force -Path $actionDir | Out-Null

$ffmpeg = $env:FFMPEG_PATH
if (-not $ffmpeg -or -not (Test-Path $ffmpeg)) {
  $pathCommand = Get-Command ffmpeg -ErrorAction SilentlyContinue
  if ($pathCommand) {
    $ffmpeg = $pathCommand.Source
  }
}
if (-not $ffmpeg -or -not (Test-Path $ffmpeg)) {
  $portable = Join-Path $env:LOCALAPPDATA "PetPresenceTools\ffmpeg\ffmpeg.exe"
  if (Test-Path $portable) {
    $ffmpeg = $portable
  }
}
if (-not $ffmpeg -or -not (Test-Path $ffmpeg)) {
  throw "ffmpeg not found. Run scripts/assets/install_ffmpeg.ps1 first."
}

$scaleFilter = "fps=$Fps,scale=$Size`:$Size`:force_original_aspect_ratio=decrease,pad=$Size`:$Size`:(ow-iw)/2:(oh-ih)/2:color=0x00000000"
if ($ChromaKeyColor) {
  $videoFilter = "chromakey=$ChromaKeyColor`:$Similarity`:$Blend,$scaleFilter,format=yuva420p"
} else {
  $videoFilter = "$scaleFilter,format=yuva420p"
}

& $ffmpeg `
  -y `
  -i $inputFile `
  -vf $videoFilter `
  -an `
  -c:v libvpx-vp9 `
  -pix_fmt yuva420p `
  -auto-alt-ref 0 `
  -b:v 0 `
  -crf 32 `
  $outputFile

Write-Output "Wrote $outputFile"
