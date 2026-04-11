# =====================================================
# Noorix — SSH Tunnel to VPS Database
# يفتح نفقاً آمناً بين جهازك وقاعدة بيانات الخادم
#
# الاستخدام (في terminal منفصل):
#   .\scripts\open-tunnel.ps1
#
# ما يفعله:
#   localhost:5433  →  VPS:5432 (PostgreSQL)
#
# بعد تشغيله، شغّل الـ Backend في terminal آخر:
#   cd backend && npm run start:dev
# =====================================================

$VPS_HOST    = "77.37.51.67"
$VPS_USER    = "root"
$LOCAL_PORT  = 5433
$REMOTE_PORT = 5432
$KEY_PATH    = "$env:USERPROFILE\.ssh\noorix_vps"

Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host " Noorix — فتح النفق لقاعدة البيانات" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host " الخادم : $VPS_HOST" -ForegroundColor Yellow
Write-Host " المنفذ : localhost:$LOCAL_PORT  →  VPS:$REMOTE_PORT" -ForegroundColor Yellow
Write-Host ""
Write-Host " اضغط Ctrl+C لإيقاف النفق" -ForegroundColor Gray
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

# فتح النفق — يبقى مفتوحاً حتى تضغط Ctrl+C
ssh -o StrictHostKeyChecking=no `
    -o ServerAliveInterval=30 `
    -o ServerAliveCountMax=3 `
    -i $KEY_PATH `
    -L "${LOCAL_PORT}:localhost:${REMOTE_PORT}" `
    "${VPS_USER}@${VPS_HOST}" `
    -N
