# NOORIX — إثبات نهائي بالدليل القاطع

**التاريخ:** 15 مارس 2025  
**الغرض:** إثبات أن الإصلاحات المحاسبية تمت بنجاح وليست ترقيعاً.

---

## 1. فحص "السموم البرمجية" (Forbidden Pattern Search)

### البحث الشامل في `src/`:

| النمط | النتائج | استخدام في حسابات الضرائب؟ |
|-------|--------|----------------------------|
| `Number(` | 6 مواضع | ❌ لا — لتحويل القيم من API أو input فقط |
| `parseFloat(` | 8 مواضع | ❌ لا — لقراءة قيمة input فقط، ثم يُمرَّر لـ splitTaxFromTotalAsNumbers |
| `/ 1.15` | **0** | ✅ لا يوجد |
| `* 0.15` | **0** | ✅ لا يوجد |

### تفصيل المواضع الحرجة:

**BatchEditPanel.jsx** — لا يوجد حساب يدوي للضريبة:

```javascript
// السطر 7: استيراد الدالة المركزية
import { splitTaxFromTotalAsNumbers } from '../../../constants/tax';

// الأسطر 140-145: الإثبات — استبدال المعادلة اليدوية
onChange={(e) => {
  const v = parseFloat(e.target.value);   // parseFloat لقراءة input فقط
  if (!isNaN(v) && v > 0) {
    const { net, tax } = splitTaxFromTotalAsNumbers(v, true);  // ← الدالة المركزية
    updateInv(i, { totalAmount: v, netAmount: net, taxAmount: tax });
  }
}}
```

**ملاحظة:** `parseFloat(e.target.value)` يُستخدم لقراءة قيمة حقل الإدخال فقط — الحساب الفعلي يتم داخل `splitTaxFromTotalAsNumbers` باستخدام Decimal.js.

---

## 2. فحص "الميزان المحاسبي" (115 SAR Test Case)

### محاكاة برمجية:

```javascript
// منطق tax.js — splitTaxFromTotal(115, true)
const t = new Decimal(115);
const divisor = new Decimal(1).plus(0.15);  // 1.15
const net = t.div(divisor);                 // 115 / 1.15
const tax = t.minus(net);                   // 115 - 100
```

### النتيجة الفعلية (تشغيل Node.js):

```
115 SAR Test:
Net: 100.0000
Tax: 15.0000
Sum: 115
```

| الحقل | القيمة المطلوبة | القيمة الفعلية | الحالة |
|-------|-----------------|----------------|--------|
| Net Amount | 100.0000 | 100.0000 | ✅ |
| Tax Amount | 15.0000 | 15.0000 | ✅ |
| المجموع | 115 | 115 | ✅ |

---

## 3. إثبات "تفكيك الوحش" (Structural Integrity)

### محتوى `useBatchCalculation.js`:

```javascript
/**
 * useBatchCalculation — Hook مركزي لحسابات دفعات المشتريات.
 * يستخدم tax.js كمصدر وحيد للضرائب و sumAmounts للجمع.
 */
import { useMemo } from 'react';
import Decimal from 'decimal.js';
import { sumAmounts } from '../utils/format';
import { splitTaxFromTotal } from '../constants/tax';

export function useBatchSummary(rows) {
  return useMemo(() => {
    let net = new Decimal(0);
    let tax = new Decimal(0);
    let total = new Decimal(0);
    let count = 0;
    for (const r of rows) {
      try {
        const t = new Decimal(r.totalInclusive || 0);
        if (t.gt(0) && r.supplierId && r.invoiceNumber) {
          const taxable = r.isTaxable !== false;
          const { net: n, tax: tx } = splitTaxFromTotal(t, taxable);  // ← من tax.js
          net = net.plus(n);
          tax = tax.plus(tx);
          total = total.plus(t);
          count++;
        }
      } catch { /* skip invalid row */ }
    }
    return { net, tax, total, count };
  }, [rows]);
}

export function useBatchInvoicesSummary(invoices) {
  return useMemo(() => {
    const active = (invoices || []).filter((i) => i.status !== 'cancelled');
    const total = sumAmounts(active, 'totalAmount');
    const net = sumAmounts(active, 'netAmount');
    const tax = sumAmounts(active, 'taxAmount');
    return { net: net.toNumber(), tax: tax.toNumber(), total: total.toNumber() };
  }, [invoices]);
}
```

### إثبات المركزية:

| الموقع | قبل | بعد |
|--------|-----|-----|
| PurchasesBatchScreen | ~15 سطر useMemo يدوي | `const summary = useBatchSummary(rows);` |
| BatchEditPanel | `v/1.15` يدوي | `splitTaxFromTotalAsNumbers(v, true)` |
| InvoiceEditModal | `v/1.15` يدوي | `splitTaxFromTotalAsNumbers(v, true)` |
| SalesService | `new Decimal(1.15)` ثابت | `splitTaxFromTotal(totalAmount, true)` |

### عدد أسطر PurchasesBatchScreen.jsx:

| المقياس | القيمة |
|---------|--------|
| **العدد الحالي** | 435 سطر |
| **المستهدف** | < 300 سطر |
| **الحالة** | ⚠️ تم نقل منطق الحسابات إلى Hook، لكن الشاشة ما زالت تحتوي على تبويبات وتاريخ ودفعات — التقسيم الإضافي يتطلب فصل BatchHistory و BatchEntry كمكونات منفصلة |

---

## 4. إثبات "المصدر الوحيد" (tax.js)

**الملف:** `src/constants/tax.js` (وليس utils — الملف في constants)

```javascript
/**
 * محرك الضرائب — المصدر الوحيد (SSOT) لحسابات الضريبة في الفرونت إند.
 * يعتمد على Decimal.js فقط — لا Math.round ولا Number في العمليات المالية.
 * نسبة 15% حسب ZATCA / السعودية.
 */
import Decimal from 'decimal.js';

export const TAX_RATE = 0.15;

export function splitTaxFromTotal(totalInclusive, isTaxable = true, rate = TAX_RATE) {
  const t = new Decimal(totalInclusive || 0);
  if (t.lte(0)) return { net: new Decimal(0), tax: new Decimal(0) };
  if (!isTaxable) return { net: t, tax: new Decimal(0) };
  const divisor = new Decimal(1).plus(rate);   // ← Decimal فقط
  const net = t.div(divisor);                  // ← Decimal.div
  const tax = t.minus(net);                    // ← Decimal.minus
  return { net, tax };
}

export function splitTaxFromTotalAsNumbers(totalInclusive, isTaxable = true, rate = TAX_RATE) {
  const { net, tax } = splitTaxFromTotal(totalInclusive, isTaxable, rate);
  return { net: net.toNumber(), tax: tax.toNumber() };  // التحويل النهائي فقط عند الخروج
}
```

### فحص عدم استخدام المكتبات الافتراضية:

| الدالة | Math.round | Number | parseFloat في الحساب |
|--------|------------|--------|----------------------|
| splitTaxFromTotal | ❌ | ❌ | ❌ |
| splitTaxFromTotalAsNumbers | ❌ | ❌ | ❌ |

**الخلاصة:** جميع العمليات الحسابية داخل tax.js تستخدم `Decimal` فقط. `toNumber()` يُستدعى فقط عند إرجاع القيمة للمكوّن الخارجي.

---

## الخلاصة النهائية

| المعيار | النتيجة |
|---------|---------|
| السموم البرمجية | ✅ لا `/ 1.15` ولا `* 0.15` في src/ |
| BatchEditPanel | ✅ يستخدم `splitTaxFromTotalAsNumbers` |
| اختبار 115 ريال | ✅ Net: 100.0000, Tax: 15.0000 |
| useBatchCalculation | ✅ منطق مركزي، يستدعي tax.js |
| tax.js | ✅ Decimal.js فقط، لا Math.round ولا Number في الحساب |

**ميزان Noorix دقيق بالهللة.**
