param(
  [int]$StartPort = 3000,
  [int]$EndPort = 3999
)

$ErrorActionPreference = 'SilentlyContinue'

function Get-ListenersInRange {
  param(
    [int]$FromPort,
    [int]$ToPort
  )

  $rows = @()
  netstat -ano -p tcp | Select-String 'LISTENING' | ForEach-Object {
    $line = $_.Line.Trim()
    if ($line -match '^TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)$') {
      $portNum = [int]$matches[1]
      $procId = [int]$matches[2]
      if ($portNum -ge $FromPort -and $portNum -le $ToPort -and $procId -gt 0 -and $procId -ne 4) {
        $rows += [PSCustomObject]@{
          Port = $portNum
          ProcId = $procId
        }
      }
    }
  }
  return $rows
}

function Stop-ProcSafely {
  param([int]$ProcId)
  try {
    $proc = Get-Process -Id $ProcId -ErrorAction Stop
    Stop-Process -Id $ProcId -Force -ErrorAction Stop
    return [PSCustomObject]@{
      ProcId = $ProcId
      Name = $proc.ProcessName
      Status = 'killed'
    }
  } catch {
    return [PSCustomObject]@{
      ProcId = $ProcId
      Name = ''
      Status = 'failed'
      Error = $_.Exception.Message
    }
  }
}

$initial = Get-ListenersInRange -FromPort $StartPort -ToPort $EndPort
$targets = $initial | Sort-Object ProcId -Unique

$results = @()
foreach ($target in $targets) {
  $results += Stop-ProcSafely -ProcId $target.ProcId
}

# Kill stale Next dev processes in this repo even if they are not listening.
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$repoLike = $repoRoot.Replace('\', '\\')
Get-CimInstance Win32_Process | ForEach-Object {
  $cmd = $_.CommandLine
  if (-not $cmd) { return }
  if ($cmd -like "*$repoRoot*" -and ($cmd -like '*next*dev*' -or $cmd -like '*bun*dev*')) {
    $results += Stop-ProcSafely -ProcId $_.ProcessId
  }
}

# Remove Next lock files so dev server doesn't auto-bump to next port.
$lockFiles = @(
  (Join-Path $repoRoot 'client/.next/dev/lock'),
  (Join-Path $repoRoot '.next/dev/lock')
)
foreach ($lockFile in $lockFiles) {
  if (Test-Path $lockFile) {
    Remove-Item $lockFile -Force
  }
}

Start-Sleep -Milliseconds 300
$remaining = Get-ListenersInRange -FromPort $StartPort -ToPort $EndPort

Write-Output "RANGE=$StartPort-$EndPort"
Write-Output "KILLED_OR_ATTEMPTED:"
if ($results.Count -eq 0) {
  Write-Output "(none)"
} else {
  $results | Sort-Object ProcId,Status | ForEach-Object {
    if ($_.Status -eq 'killed') {
      Write-Output "PID=$($_.ProcId) STATUS=killed NAME=$($_.Name)"
    } else {
      Write-Output "PID=$($_.ProcId) STATUS=failed ERROR=$($_.Error)"
    }
  }
}

Write-Output "REMAINING_LISTENERS_IN_RANGE:"
if ($remaining.Count -eq 0) {
  Write-Output "(none)"
} else {
  $remaining | Sort-Object Port,ProcId | ForEach-Object {
    Write-Output "PORT=$($_.Port) PID=$($_.ProcId)"
  }
}
