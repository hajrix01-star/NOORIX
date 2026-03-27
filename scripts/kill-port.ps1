# kill-port.ps1 - free the given TCP port (kill owning PIDs)
param([int]$Port)
if (-not $Port) { Write-Host "Usage: kill-port.ps1 -Port 3000"; exit 1 }
# Force array: single PID otherwise becomes a string and foreach iterates characters
$procs = @(netstat -ano | Select-String ":$Port\s" | ForEach-Object {
  ($_ -split '\s+')[-1]
} | Where-Object { $_ -match '^\d+$' } | Sort-Object -Unique)
if ($procs.Count -eq 0) {
  Write-Host "[OK] المنفذ $Port حر."
} else {
  # Loop variable must not be the built-in process id variable
  foreach ($procId in $procs) {
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
