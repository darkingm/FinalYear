$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$statusDir = Join-Path $repoRoot '.grapuco'
$statusFile = Join-Path $statusDir 'status.json'

New-Item -ItemType Directory -Force -Path $statusDir | Out-Null

$startedAt = (Get-Date).ToUniversalTime().ToString('o')
$commit = (& git -C $repoRoot rev-parse --short HEAD 2>$null)
if (-not $commit) { $commit = 'unknown' }

function Write-Status {
    param(
        [string]$State,
        [string]$Message,
        [int]$ExitCode = 0
    )

    $payload = [ordered]@{
        state = $State
        message = $Message
        started_at = $startedAt
        finished_at = (Get-Date).ToUniversalTime().ToString('o')
        commit = $commit
        cwd = $repoRoot
        command = 'npx grapuco ingest'
        exit_code = $ExitCode
    }

    $payload | ConvertTo-Json -Depth 4 | Set-Content -Path $statusFile -Encoding UTF8
}

Write-Status -State 'running' -Message 'Grapuco reindex started'

try {
    Push-Location $repoRoot
    & npx grapuco ingest
    $exitCode = $LASTEXITCODE
    Pop-Location

    if ($exitCode -ne 0) {
        Write-Status -State 'failed' -Message "Grapuco reindex failed with exit code $exitCode" -ExitCode $exitCode
        exit $exitCode
    }

    Write-Status -State 'success' -Message 'Grapuco reindex completed'
    exit 0
}
catch {
    if ($PWD.Path -eq $repoRoot) {
        Pop-Location
    }
    Write-Status -State 'failed' -Message $_.Exception.Message -ExitCode 1
    throw
}
