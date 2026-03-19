# kill-port.ps1 — يقتل أي عملية تشغل المنفذ المحدد
param([int]$Port)
if (-not $Port) { Write-Host "Usage: kill-port.ps1 -Port 3000"; exit 1 }
$procs = netstat -ano | Select-String ":$Port\s" | ForEach-Object {
  ($_ -split '\s+')[-1]
} | Where-Object { $_ -match '^\d+$' } | Sort-Object -Unique
if ($procs.Count -eq 0) {
  Write-Host "[OK] المنفذ $Port حر."
} else {
  foreach ($pid in $procs) {
    try {
      Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
      Write-Host "[KILLED] PID $pid على المنفذ $Port"
    } catch {
      Write-Host "[SKIP] PID $pid"
    }
  }
  Start-Sleep -Milliseconds 500
  Write-Host "[OK] المنفذ $Port تم تحريره."
}
