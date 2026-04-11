# ⚠️ سكريبت آمن لتطبيق تغييرات الـ schema على قاعدة البيانات
# يتحقق من أن البيانات لن تُفقد قبل التطبيق

Write-Host "=== Noorix Safe Schema Push ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "هذا السكريبت سيطبق تغييرات schema.prisma على قاعدة البيانات." -ForegroundColor White
Write-Host ""
Write-Host "⚠️  تحذير مهم:" -ForegroundColor Red
Write-Host "   - لا تستخدم '--force-reset' على قاعدة البيانات الإنتاجية" -ForegroundColor Red
Write-Host "   - '--force-reset' يمحو جميع البيانات بشكل غير قابل للتراجع" -ForegroundColor Red
Write-Host ""

$confirm = Read-Host "هل أنت متأكد أن التغييرات آمنة (لا حذف جداول/أعمدة)؟ (y/N)"

if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "تم الإلغاء." -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "تطبيق التغييرات (بدون --force-reset)..." -ForegroundColor Cyan
npx prisma db push

Write-Host ""
Write-Host "✅ تم التطبيق. راجع البيانات للتأكد من سلامتها." -ForegroundColor Green
