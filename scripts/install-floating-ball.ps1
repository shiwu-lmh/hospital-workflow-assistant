param([string[]]$ExtensionId, [switch]$BuildOnly)
$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
$nativeDir = Join-Path $projectDir 'native'
$outputDir = Join-Path $nativeDir 'build'
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$exePath = Join-Path $outputDir 'HospitalFloatingBall.exe'
& $compiler /nologo /codepage:65001 /target:winexe /platform:anycpu "/out:$exePath" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll (Join-Path $nativeDir 'FloatingBall.cs')
if ($LASTEXITCODE -ne 0) { throw '桌面悬浮球编译失败' }
if ($BuildOnly) { Write-Output $exePath; exit }
if (!$ExtensionId) {
  Add-Type -AssemblyName System.Web.Extensions
  $jsonReader = New-Object System.Web.Script.Serialization.JavaScriptSerializer
  $jsonReader.MaxJsonLength = 67108864
  $jsonReader.RecursionLimit = 256
  $foundIds = @()
  foreach ($browserRoot in @('Microsoft\Edge\User Data','Google\Chrome\User Data')) {
    $userData = Join-Path $env:LOCALAPPDATA $browserRoot
    if (!(Test-Path -LiteralPath $userData)) { continue }
    foreach ($profile in Get-ChildItem -LiteralPath $userData -Directory) {
      foreach ($name in @('Preferences','Secure Preferences')) {
        $prefPath = Join-Path $profile.FullName $name
        if (!(Test-Path -LiteralPath $prefPath)) { continue }
        try { $settings = $jsonReader.DeserializeObject([System.IO.File]::ReadAllText($prefPath)).extensions.settings } catch { continue }
        if (!$settings) { continue }
        foreach ($entry in $settings.GetEnumerator()) {
          if ($entry.Value.path -and ($entry.Value.path.TrimEnd('\') -ieq (Join-Path $projectDir 'extension') -or $entry.Value.path.TrimEnd('\') -ieq (Join-Path $projectDir 'dist\unpacked'))) { $foundIds += $entry.Key }
        }
      }
    }
  }
  $ExtensionId = @($foundIds | Select-Object -Unique)
}
if (!$ExtensionId) { throw '未找到已加载的本项目扩展，请加载扩展后重试，或传入 -ExtensionId 扩展ID。' }
foreach ($id in $ExtensionId) { if ($id -cnotmatch '^[a-p]{32}$') { throw "扩展ID无效：$id" } }
$manifestPath = Join-Path $outputDir 'cn.hospital_workflow.floating_ball.json'
$manifestJson = @{name='cn.hospital_workflow.floating_ball';description='Hospital workflow desktop floating ball';path=$exePath;type='stdio';allowed_origins=@($ExtensionId | ForEach-Object { "chrome-extension://$_/" })} | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText($manifestPath, $manifestJson, (New-Object System.Text.UTF8Encoding($false)))
foreach ($browser in @('Google\Chrome','Microsoft\Edge')) {
  $registryPath = "HKCU:\Software\$browser\NativeMessagingHosts\cn.hospital_workflow.floating_ball"
  New-Item -Path $registryPath -Force | Out-Null
  Set-Item -LiteralPath $registryPath -Value $manifestPath
}
Write-Output "桌面悬浮球已安装（当前用户）：$($ExtensionId -join ', ')"
