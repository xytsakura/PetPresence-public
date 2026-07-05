param(
  [string]$VideoPath = "",
  [string]$BaseUrl = "http://127.0.0.1:4317",
  [int]$DelayMs = 10000,
  [string]$PetId = "pet_demo",
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ShelterUrl = "$($BaseUrl.TrimEnd('/'))/shelter"

function New-DemoEvent {
  param(
    [Parameter(Mandatory = $true)][string]$Action,
    [Parameter(Mandatory = $true)][string]$OwnerMessage,
    [Parameter(Mandatory = $true)][string]$VisualSummary
  )

  return [ordered]@{
    schema_version = "1.0"
    event_id = "evt_demo_button_{0}_{1}" -f ([DateTimeOffset]::Now.ToUnixTimeMilliseconds()), $Action
    pet_id = $PetId
    timestamp = [DateTimeOffset]::Now.ToString("yyyy-MM-ddTHH:mm:ss.fffzzz")
    trigger_type = "demo"
    routed_action = $Action
    confidence = 0.99
    visual_summary = $VisualSummary
    owner_message = $OwnerMessage
    alert_level = "normal"
    evidence_frames = @()
    needs_owner_attention = $false
  }
}

function Send-DemoEvent {
  param(
    [Parameter(Mandatory = $true)][hashtable]$Event
  )

  $json = $Event | ConvertTo-Json -Depth 8
  Invoke-RestMethod `
    -Uri "$($BaseUrl.TrimEnd('/'))/events" `
    -Method Post `
    -ContentType "application/json; charset=utf-8" `
    -Body $json `
    -TimeoutSec 5 | Out-Null
}

function Test-EventServer {
  Invoke-RestMethod -Uri "$($BaseUrl.TrimEnd('/'))/health" -TimeoutSec 3 | Out-Null
}

if ($DryRun) {
  [ordered]@{
    ok = $true
    dry_run = $true
    shelter_url = $ShelterUrl
    base_url = $BaseUrl
    delay_ms = $DelayMs
    button = "Start Shelter Demo"
  } | ConvertTo-Json -Depth 4
  exit 0
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text = "PetPresence Demo"
$form.Size = New-Object System.Drawing.Size(360, 180)
$form.StartPosition = "CenterScreen"
$form.Topmost = $true
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedDialog
$form.MaximizeBox = $false

$button = New-Object System.Windows.Forms.Button
$button.Text = "Start Shelter Demo"
$button.Font = New-Object System.Drawing.Font("Microsoft YaHei UI", 14, [System.Drawing.FontStyle]::Bold)
$button.Size = New-Object System.Drawing.Size(260, 56)
$button.Location = New-Object System.Drawing.Point(48, 28)
$form.Controls.Add($button)

$status = New-Object System.Windows.Forms.Label
$status.Text = "Start event-server and desktop pet, then click the button."
$status.Font = New-Object System.Drawing.Font("Microsoft YaHei UI", 9)
$status.AutoSize = $false
$status.Size = New-Object System.Drawing.Size(310, 42)
$status.Location = New-Object System.Drawing.Point(24, 96)
$status.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
$form.Controls.Add($status)

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = $DelayMs

$timer.Add_Tick({
  $timer.Stop()
  try {
    $sleepEvent = New-DemoEvent `
      -Action "sleep" `
      -OwnerMessage "Sleeping now~" `
      -VisualSummary "Demo: after opening the shelter cloud adoption page, the desktop pet switches to sleep."
    Send-DemoEvent -Event $sleepEvent
    $status.Text = "Sleep event sent. Desktop pet should be sleeping."
    $button.Enabled = $true
  } catch {
    $status.Text = "Failed to send sleep: $($_.Exception.Message)"
    $button.Enabled = $true
  }
})

$button.Add_Click({
  $button.Enabled = $false
  try {
    Test-EventServer
    Start-Process -FilePath $ShelterUrl

    $idleEvent = New-DemoEvent `
      -Action "idle" `
      -OwnerMessage "I am here~" `
      -VisualSummary "Demo start: shelter cloud adoption page opens, desktop pet first returns to the initial companion state."
    Send-DemoEvent -Event $idleEvent

    $status.Text = "Shelter page opened. Switching pet to sleep in about $([Math]::Round($DelayMs / 1000, 1))s."
    $timer.Start()
  } catch {
    $status.Text = "Start failed: $($_.Exception.Message)"
    $button.Enabled = $true
  }
})

[void]$form.ShowDialog()
