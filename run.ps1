param([Parameter(Position=0)][string]$Command = 'help',
      [Parameter(ValueFromRemainingArguments=$true)][string[]]$Arguments)
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    $spaNode = (Get-Command node -ErrorAction Stop).Source
    $spaRuntime = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'
    if (!$env:SPA_NODE_MODULES -and (Test-Path -LiteralPath (Join-Path $spaRuntime '@oai/artifact-tool'))) { $env:SPA_NODE_MODULES = $spaRuntime }
    if ($Command -eq 'test') { & $spaNode --test 'tests/*.test.mjs' }
    elseif ($Command -eq 'init') { & $spaNode scripts/init_project.mjs @Arguments }
    else { & $spaNode scripts/build_pptx.js $Command @Arguments }
    if ($LASTEXITCODE -ne 0) { throw "SPA command failed (exit $LASTEXITCODE)" }
} finally { Pop-Location }
