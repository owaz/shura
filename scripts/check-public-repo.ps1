$ErrorActionPreference = 'Stop'

$repositoryRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Push-Location $repositoryRoot

try {
    git check-ignore -q shura-backend/.env
    if ($LASTEXITCODE -ne 0) {
        throw 'shura-backend/.env is not ignored by Git.'
    }

    git check-ignore -q shura-frontend/.env.local
    if ($LASTEXITCODE -ne 0) {
        throw 'shura-frontend/.env.local is not ignored by Git.'
    }

    $stagedFiles = @(git diff --cached --name-only --diff-filter=ACMR)
    $forbiddenFiles = @($stagedFiles | Where-Object {
        $normalized = $_ -replace '\\', '/'
        $isAllowedExample = $normalized -match '/\.env(\.production)?\.example$'
        $looksSensitive =
            $normalized -match '(^|/)\.env($|\.)' -or
            $normalized -match '(^|/)(playwright/\.auth|\.auth)(/|$)' -or
            $normalized -match '\.(pem|p12|pfx|key|dump|backup)$'
        $looksSensitive -and -not $isAllowedExample
    })

    if ($forbiddenFiles.Count -gt 0) {
        Write-Error "Potentially sensitive staged files detected:`n$($forbiddenFiles -join "`n")"
        exit 1
    }

    $gitleaks = Get-Command gitleaks -ErrorAction SilentlyContinue
    if (-not $gitleaks) {
        Write-Error 'Gitleaks is required before publishing. Install it, then rerun this check.'
        exit 1
    }

    & $gitleaks.Source protect --staged --redact
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    & $gitleaks.Source git --redact
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    Write-Host '[ok] Local environment files are ignored, staged paths are safe, and Gitleaks found no publishable secrets.'
}
finally {
    Pop-Location
}
