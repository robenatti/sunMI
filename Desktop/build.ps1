# Build sunMI / SolX POS for Windows x64 with NW.js.
# Mirrors the CTUSuite layout: dist/SolXPOS.exe + dist/package.nw/ (directory).
# Does not modify the source repository or any original application JS.
param(
    [string]$NWVersion = '0.116.0',
    [string]$Branch = 'main',
    [string]$RuntimeDirectory = ''
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$work = Join-Path $root '.build'
$cache = Join-Path $root '.cache'
$dist = Join-Path $root 'dist'
$source = Join-Path $work 'sunMI'
$package = Join-Path $dist 'package.nw'

try {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        throw 'Git non trovato nel PATH.'
    }
    if (Test-Path -LiteralPath $work) { Remove-Item -LiteralPath $work -Recurse -Force }
    if (Test-Path -LiteralPath $dist) { Remove-Item -LiteralPath $dist -Recurse -Force }
    New-Item -ItemType Directory -Path $work, $cache, $dist, $package -Force | Out-Null

    Write-Host '[1/4] Scaricamento codice da robenatti/sunMI ...'
    & git clone --depth 1 --branch $Branch 'https://github.com/robenatti/sunMI.git' $source
    if ($LASTEXITCODE -ne 0) { throw 'git clone fallito' }

    $assets = Join-Path $source 'app/src/main/assets'
    if (-not (Test-Path (Join-Path $assets 'index.html'))) { throw 'index.html non trovato nel repository' }
    if (-not (Test-Path (Join-Path $assets 'js/vendor/pouchdb-9.0.0.min.js'))) {
        throw 'PouchDB 9.0.0 non trovato nel repository'
    }

    Write-Host '[2/4] Copia HTML/CSS/JS originali in dist/package.nw ...'
    Get-ChildItem -LiteralPath $assets -Force | Copy-Item -Destination $package -Recurse -Force
    Copy-Item -LiteralPath (Join-Path $root 'package.json') -Destination (Join-Path $package 'package.json') -Force
    New-Item -ItemType Directory -Path (Join-Path $package 'platform') -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $root 'nw-bridge.js') -Destination (Join-Path $package 'platform/nw-bridge.js') -Force

    Write-Host '[3/4] Preparazione runtime NW.js ...'
    if ($RuntimeDirectory) {
        $runtime = (Resolve-Path -LiteralPath $RuntimeDirectory).Path
        if (-not (Test-Path (Join-Path $runtime 'nw.exe'))) {
            throw 'RuntimeDirectory non contiene nw.exe'
        }
    } else {
        $archive = "nwjs-v$NWVersion-win-x64.zip"
        $zipPath = Join-Path $cache $archive
        if (-not (Test-Path -LiteralPath $zipPath)) {
            $uri = "https://dl.nwjs.io/v$NWVersion/$archive"
            Write-Host "Download $uri"
            Invoke-WebRequest -Uri $uri -OutFile $zipPath -UseBasicParsing
        }
        $unpack = Join-Path $work 'runtime'
        Expand-Archive -LiteralPath $zipPath -DestinationPath $unpack -Force
        $runtime = Join-Path $unpack "nwjs-v$NWVersion-win-x64"
        if (-not (Test-Path (Join-Path $runtime 'nw.exe'))) { throw 'nw.exe non trovato nel runtime scaricato' }
    }
    Get-ChildItem -LiteralPath $runtime -Force | Copy-Item -Destination $dist -Recurse -Force
    Rename-Item -LiteralPath (Join-Path $dist 'nw.exe') -NewName 'SolXPOS.exe'

    Write-Host '[4/4] Cartella pronta:'
    Write-Host "  $dist"
    Write-Host "  $(Join-Path $dist 'SolXPOS.exe')"
    Write-Host "  $(Join-Path $dist 'package.nw')"
    Write-Host 'Il repository remoto non e stato modificato.'
} catch {
    Write-Error "BUILD FALLITA: $($_.Exception.Message)"
    exit 1
}
