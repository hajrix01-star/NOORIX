# اختبارات المحرك المحاسبي

## الاختبارات الآلية (مستقبلاً)

لإضافة اختبارات آلية لـ `FinancialCoreService`:

1. تثبيت Jest و @nestjs/testing:
   ```bash
   npm install --save-dev jest @nestjs/testing @types/jest ts-jest
   ```

2. إنشاء ملف `financial-core.e2e-spec.ts` مع اختبارات لـ:
   - `processInflow` مع الضريبة: التحقق من فصل الصافي والضريبة وإنشاء قيدين (إيراد + TAX-001)
   - `processOutflow`: التحقق من إنشاء فاتورة وقيد
   - `processTransfer`: التحقق من القيد المزدوج

3. مثال سريع:
   ```ts
   it('should split 115 into net=100, tax=15 when VAT 15%', async () => {
     const result = await service.processInflow({
       companyId, transactionDate, channels: [{ vaultId, amount: '115' }],
     });
     expect(result.ledgerEntries.filter(e => e.amount == 100).length).toBeGreaterThanOrEqual(1);
     expect(result.ledgerEntries.filter(e => e.amount == 15).length).toBeGreaterThanOrEqual(1);
   });
   ```

## اختبار السلفية يدوياً

```bash
node backend/scripts/test-advance-via-core.js
```

يتطلب: شركة، موظف، خزنة، ومستخدم في قاعدة البيانات (شغّل `prisma db seed` أولاً).
