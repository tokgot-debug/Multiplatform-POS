$ErrorActionPreference = 'Stop'

$jdkHome = 'C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot'
$jdkBin = Join-Path $jdkHome 'bin'
$javaExe = Join-Path $jdkBin 'java.exe'

if (-not (Test-Path -LiteralPath $javaExe -PathType Leaf)) {
  throw "JDK 21 was not found at the expected path: $javaExe"
}

$versionOutput = (& $javaExe --version | Out-String)
if ($versionOutput -notmatch '^openjdk 21\.') {
  throw "The selected Java runtime is not JDK 21: $versionOutput"
}

$machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
$pathEntries = @($machinePath -split ';' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
$deduplicated = [System.Collections.Generic.List[string]]::new()
$deduplicated.Add($jdkBin)

foreach ($entry in $pathEntries) {
  $trimmed = $entry.Trim().TrimEnd('\')
  if ($trimmed -ieq $jdkBin.TrimEnd('\')) {
    continue
  }
  if (-not ($deduplicated | Where-Object { $_.TrimEnd('\') -ieq $trimmed })) {
    $deduplicated.Add($entry.Trim())
  }
}

[Environment]::SetEnvironmentVariable('JAVA_HOME', $jdkHome, 'Machine')
[Environment]::SetEnvironmentVariable('Path', ($deduplicated -join ';'), 'Machine')

Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class EnvironmentBroadcast {
    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern IntPtr SendMessageTimeout(
        IntPtr hWnd,
        uint Msg,
        UIntPtr wParam,
        string lParam,
        uint fuFlags,
        uint uTimeout,
        out UIntPtr lpdwResult);
}
'@

$result = [UIntPtr]::Zero
[void][EnvironmentBroadcast]::SendMessageTimeout(
  [IntPtr]0xffff,
  0x001A,
  [UIntPtr]::Zero,
  'Environment',
  0x0002,
  5000,
  [ref]$result
)

Write-Output "Machine JAVA_HOME set to $jdkHome"
Write-Output "Machine PATH now prioritizes $jdkBin"
