param(
    [string[]] $Roles = @('R-SENSE', 'R-SF', 'R-WIFI', 'C-SF', 'C-WIFI'),
    [string] $WifiSsid = $env:STARSHIELD_WIFI_SSID,
    [string] $WifiPassword = $env:STARSHIELD_WIFI_PASSWORD,
    [string] $WifiApIp = '192.168.63.1',
    [string] $WifiPeerIp = '10.19.20.255',
    [int] $WifiUdpPort = 6789,
    [string] $StagingSrc = 'D:\s0\src',
    [string] $ArtifactRoot = 'D:\table\ros_car\xuanxun-starshield\星闪硬件代码\builds\s0-20260919'
)

$ErrorActionPreference = 'Stop'
$validRoles = @('R-SENSE', 'R-SF', 'R-WIFI', 'C-SF', 'C-WIFI')
$roleDefines = @{
    'R-SENSE' = 'CONFIG_STARSHIELD_ROLE_R_SENSE=y'
    'R-SF'    = 'CONFIG_STARSHIELD_ROLE_R_SF=y'
    'R-WIFI'  = 'CONFIG_STARSHIELD_ROLE_R_WIFI=y'
    'C-SF'    = 'CONFIG_STARSHIELD_ROLE_C_SF=y'
    'C-WIFI'  = 'CONFIG_STARSHIELD_ROLE_C_WIFI=y'
}
$roleMasks = @{
    'R-SENSE' = 2
    'R-SF'    = 1
    'R-WIFI'  = 4
    'C-SF'    = 3
    'C-WIFI'  = 5
}
$roleClears = @(
    '-:CONFIG_STARSHIELD_ROLE_R_SENSE',
    '-:CONFIG_STARSHIELD_ROLE_R_SF',
    '-:CONFIG_STARSHIELD_ROLE_R_WIFI',
    '-:CONFIG_STARSHIELD_ROLE_C_SF',
    '-:CONFIG_STARSHIELD_ROLE_C_WIFI'
)
$commonDefines = @(
    'CONFIG_ENABLE_PRODUCTS_SAMPLE=y',
    'CONFIG_SAMPLE_SUPPORT_XUANXUN_STARSHIELD=y',
    'CONFIG_SUPPORT_SLE_PERIPHERAL=y',
    'CONFIG_SUPPORT_SLE_CENTRAL=y',
    'CONFIG_STARSHIELD_LED_DATA_PIN=5',
    'CONFIG_STARSHIELD_UART2_TX_PIN=8',
    'CONFIG_STARSHIELD_UART2_RX_PIN=7'
) + $roleClears

if (($Roles | Where-Object { $_ -notin $validRoles }).Count -gt 0) {
    throw "Unsupported role. Valid roles: $($validRoles -join ', ')"
}
if (($Roles -contains 'R-WIFI' -or $Roles -contains 'C-WIFI') -and
    ([string]::IsNullOrWhiteSpace($WifiSsid) -or [string]::IsNullOrWhiteSpace($WifiPassword))) {
    throw 'R-WIFI/C-WIFI requires -WifiSsid and -WifiPassword; credentials are never stored in this script.'
}

$env:JIUYUAN_SHORTPATH_BUILD = '1'
$env:Path = 'D:\Program Files\Huawei\DevEco Studio\sdk\default\openharmony\native\build-tools\cmake\bin;' +
    'D:\Program Files\HiSpark Studio 25.12.1\tools\Windows\ninja;' +
    'D:\Program Files\HiSpark Studio 25.12.1\tools\Windows\cc_riscv32_musl_fp_win\bin;' +
    'D:\Program Files\HiSpark Studio 25.12.1\tools\Windows\cc_riscv32_musl_win\bin;' + $env:Path

$quote = [char]34
foreach ($role in $Roles) {
    Write-Host "=== Building $role ===" -ForegroundColor Cyan
    $defines = @($commonDefines) + $roleDefines[$role] + ("CONFIG_STARSHIELD_LED_MASK=" + $roleMasks[$role])
    if ($role -eq 'R-WIFI') {
        $defines += 'CONFIG_STARSHIELD_WIFI_STA_SSID=' + $quote + $WifiSsid + $quote
        $defines += 'CONFIG_STARSHIELD_WIFI_STA_PASSWORD=' + $quote + $WifiPassword + $quote
        $defines += 'CONFIG_STARSHIELD_WIFI_PEER_IP=' + $quote + $WifiPeerIp + $quote
        $defines += "CONFIG_STARSHIELD_WIFI_UDP_PORT=$WifiUdpPort"
    }
    if ($role -eq 'C-WIFI') {
        $defines += 'CONFIG_STARSHIELD_WIFI_STA_SSID=' + $quote + $WifiSsid + $quote
        $defines += 'CONFIG_STARSHIELD_WIFI_STA_PASSWORD=' + $quote + $WifiPassword + $quote
        $defines += "CONFIG_STARSHIELD_WIFI_UDP_PORT=$WifiUdpPort"
    }

    Push-Location $StagingSrc
    try {
        & python '.\build.py' -c ws63-liteos-app ("-def=" + ($defines -join ','))
        if ($LASTEXITCODE -ne 0) {
            throw "Build failed for $role with exit code $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }

    $outputRoot = Join-Path $StagingSrc 'output\ws63'
    $pkgRoot = Join-Path $outputRoot 'fwpkg\ws63-liteos-app'
    $appRoot = Join-Path $outputRoot 'acore\ws63-liteos-app'
    foreach ($required in @(
        (Join-Path $pkgRoot 'ws63-liteos-app_all.fwpkg'),
        (Join-Path $pkgRoot 'ws63-liteos-app_load_only.fwpkg'),
        (Join-Path $appRoot 'ws63-liteos-app-sign.bin'),
        (Join-Path $appRoot 'mconfig.h')
    )) {
        if (-not (Test-Path -LiteralPath $required)) {
            throw "Missing build artifact for ${role}: $required"
        }
    }

    $roleRoot = Join-Path $ArtifactRoot $role
    New-Item -ItemType Directory -Force -Path $roleRoot | Out-Null
    $sourceAll = Join-Path $pkgRoot 'ws63-liteos-app_all.fwpkg'
    $sourceLoadOnly = Join-Path $pkgRoot 'ws63-liteos-app_load_only.fwpkg'
    $sourceApp = Join-Path $appRoot 'ws63-liteos-app-sign.bin'
    $sourceConfig = Join-Path $appRoot 'mconfig.h'
    $destAll = Join-Path $roleRoot "$role`_all.fwpkg"
    $destLoadOnly = Join-Path $roleRoot "$role`_load_only.fwpkg"
    $destApp = Join-Path $roleRoot "$role`_app-sign.bin"
    $destConfig = Join-Path $roleRoot 'mconfig.h'
    Copy-Item -LiteralPath $sourceAll -Destination $destAll -Force
    Copy-Item -LiteralPath $sourceLoadOnly -Destination $destLoadOnly -Force
    Copy-Item -LiteralPath $sourceApp -Destination $destApp -Force
    Copy-Item -LiteralPath $sourceConfig -Destination $destConfig -Force
    if ((Get-FileHash -LiteralPath $sourceAll).Hash -ne (Get-FileHash -LiteralPath $destAll).Hash) {
        throw "Artifact hash mismatch for ${role}: $destAll"
    }

    $buildNinja = Get-Content -Raw (Join-Path $appRoot 'build.ninja')
    $roleMacro = [regex]::Match($buildNinja, '-DCONFIG_STARSHIELD_ROLE_[A-Z_]+=[yn]').Value
    if ($roleMacro -ne ('-D' + $roleDefines[$role])) {
        throw "Unexpected role macro for ${role}: $roleMacro"
    }
    Write-Host "Archived $role ($roleMacro)" -ForegroundColor Green
}

Write-Host "StarShield S0 role builds complete." -ForegroundColor Green
