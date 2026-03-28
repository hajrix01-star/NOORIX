# kill-port.ps1 - free the given TCP port (kill owning PIDs)
param([int]$Port)
if (-not $Port) { Write-Host "Usage: kill-port.ps1 -Port 3000"; exit 1 }

$pids = @()
# Windows 8+: أدق من تحليل netstat (LISTEN فقط)
try {
  $pids = @(
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique |
      Where-Object { $_ -and $_ -gt 0 }
  )
} catch { }

if ($pids.Count -eq 0) {
  # احتياط: netstat — آخر عمود PID؛ صفوف LISTENING فقط
  $procs = @(netstat -ano | Select-String "LISTENING" | Select-String ":$Port\s" | ForEach-Object {
    ($_ -split '\s+')[-1]
  } | Where-Object { $_ -match '^\d+$' -and $_ -ne '0' } | Sort-Object -Unique)
  $pids = $procs
}

if ($pids.Count -eq 0) {
  Write-Host "[OK] المنفذ $Port حر."
} else {
  foreach ($procId in $pids) {
    try {
      Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
      Write-Host "[KILLED] PID $procId على المنفذ $Port"
    } catch {
      Write-Host "[SKIP] PID $procId"
    }
  }
  Start-Sleep -Milliseconds 500
  Write-Host "[OK] المنفذ $Port تم تحريره."
}
