$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $projectDir 'native\build\cn.hospital_workflow.floating_ball.json'
foreach ($browser in @('Google\Chrome','Microsoft\Edge')) {
  $registryPath = "HKCU:\Software\$browser\NativeMessagingHosts\cn.hospital_workflow.floating_ball"
  if ((Test-Path -LiteralPath $registryPath) -and (Get-Item -LiteralPath $registryPath).GetValue('') -eq $manifestPath) { Remove-Item -LiteralPath $registryPath }
}
Write-Output '已移除当前项目的桌面悬浮球注册。'
