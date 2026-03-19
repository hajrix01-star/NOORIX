# NOORIX — تقرير التفتيش النهائي (Forensic Audit)

---

## 1. إثبات الأمان (RLS Verification)

### 1.1 قائمة الـ 13 جدولاً المفعل عليها RLS

| # | الجدول |
|---|--------|
| 1 | accounts |
| 2 | audit_logs |
| 3 | categories |
| 4 | companies |
| 5 | daily_sales_channels |
| 6 | daily_sales_summaries |
| 7 | employees |
| 8 | invoices |
| 9 | ledger_entries |
| 10 | suppliers |
| 11 | user_companies |
| 12 | users |
| 13 | vaults |

**المصدر:** استعلام `pg_tables` حيث `rowsecurity=true` — تم تنفيذه عبر `scripts/check-rls.js`.

---

### 1.2 إثبات استخدام TenantPrismaService

**VaultsService** — `backend/src/vaults/vaults.service.ts`:

```typescript
// السطر 10
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

// السطر 16-17
@Injectable()
export class VaultsService {
  constructor(private readonly prisma: TenantPrismaService) {}
```

**InvoiceService** — `backend/src/invoice/invoice.service.ts`:

```typescript
// السطر 14
import { TenantPrismaService }   from '../prisma/tenant-prisma.service';

// السطر 24-26
  constructor(
    private readonly prisma:         TenantPrismaService,
    private readonly audit:          AuditLogService,
    private readonly financialCore:  FinancialCoreService,
  ) {}
```

---

## 2. فحص الحسابات (Mathematical Accuracy)

### 2.1 VaultsService — دالة حساب الرصيد

**الملف:** `backend/src/vaults/vaults.service.ts` (أسطر 50-69)

```typescript
    // ── 5. بناء خرائط سريعة O(1) — Decimal للدقة المالية ─────
    const debitMap  = new Map<string, Decimal>(
      debitRows.map((r) => [r.debitAccountId,  new Decimal(r._sum.amount ?? 0)]),
    );
    const creditMap = new Map<string, Decimal>(
      creditRows.map((r) => [r.creditAccountId, new Decimal(r._sum.amount ?? 0)]),
    );

    // ── 6. دمج الأرصدة مع الخزائن (Decimal) ──────────────────
    return vaults.map((v) => {
      const totalIn  = debitMap.get(v.accountId)  ?? new Decimal(0);
      const totalOut = creditMap.get(v.accountId) ?? new Decimal(0);
      const balance  = totalIn.minus(totalOut);
      return {
        ...v,
        totalIn:  totalIn.toNumber(),
        totalOut: totalOut.toNumber(),
        balance:   balance.toNumber(),
      };
    });
```

**النتيجة:** ✅ جميع العمليات الحسابية (جمع، طرح) تتم عبر `Decimal`. `toNumber()` يُستخدم فقط عند الإرجاع للعرض.

---

### 2.2 PurchasesBatchScreen — Footer

**الملف:** `src/modules/Purchases/PurchasesBatchScreen.jsx` (أسطر 33-41، 89-98)

```javascript
/* ── مجاميع الجدول (Decimal للدقة المالية) ───────────────────── */
function InvoicesTableFooterSums(invoices) {
  let net = new Decimal(0), tax = new Decimal(0), total = new Decimal(0);
  for (const i of invoices) {
    net = net.plus(i.netAmount ?? 0);
    tax = tax.plus(i.taxAmount ?? 0);
    total = total.plus(i.totalAmount ?? 0);
  }
  return { net: net.toNumber(), tax: tax.toNumber(), total: total.toNumber() };
}

// في tfoot:
const sums = InvoicesTableFooterSums(invoices);
// ... fmt(sums.net), fmt(sums.tax), fmt(sums.total)
```

**النتيجة:** ✅ لا يوجد `Number()` في عمليات الجمع. الجمع يتم بـ `Decimal.plus()`. `toNumber()` يُستدعى فقط عند الإرجاع لتمرير القيمة إلى `fmt()`.

---

## 3. اختبار بوابة البيانات (DTO & Logic Audit)

### 3.1 CreateInvoiceDto — salary و advance

**الملف:** `backend/src/invoice/dto/create-invoice.dto.ts` (أسطر 14-22، 38-39)

```typescript
const INVOICE_KINDS = [
  'purchase',
  'expense',
  'hr_expense',
  'fixed_expense',
  'salary',      // ← السطر 19
  'advance',     // ← السطر 20
  'sale',
] as const;

  @IsIn(INVOICE_KINDS)
  kind: (typeof INVOICE_KINDS)[number];
```

**النتيجة:** ✅ `salary` و `advance` ضمن القائمة المسموحة.

---

### 3.2 حساب الضريبة المركزي — منع التلاعب

**الملف:** `backend/src/invoice/invoice.service.ts` (أسطر 34-47)

```typescript
  async createWithLedger(dto: CreateInvoiceDto, userId?: string | null) {
    const total   = new Decimal(String(dto.totalAmount));
    const taxable = dto.isTaxable !== false;
    let net: string;
    let tax: string;
    if (dto.netAmount != null && dto.taxAmount != null) {
      net = String(dto.netAmount);
      tax = String(dto.taxAmount);
    } else {
      const netDec = taxable ? total.div(1.15) : total;
      const taxDec = taxable ? total.minus(netDec) : new Decimal(0);
      net = netDec.toFixed(4);
      tax = taxDec.toFixed(4);
    }
```

**آلية المنع:**
- إذا أرسل العميل `netAmount` و `taxAmount` → يُطبَّق `@IsAmountConsistent` (هامش 0.01).
- إذا لم يُرسلهما → الباكيند يحسب `net` و `tax` من `totalAmount` و `isTaxable` فقط.
- لا يمكن للفرونت إند فرض أرقام ضريبة غير متسقة دون رفض الطلب.

**الملف:** `backend/src/common/validators/amount-consistency.validator.ts` — يتحقق من `|net + tax - total| ≤ 0.01`.

---

## 4. اختبار الذرية (Batch Integrity)

### 4.1 بداية الـ Transaction

**الملف:** `backend/src/financial-core/financial-core.service.ts` (أسطر 133-138)

```typescript
  async processOutflowBatch(dtos: OutflowDto[], callerUserId?: string) {
    const userId   = this._resolveUserId(callerUserId);
    const tenantId = this._resolveTenantId();

    return this.db.withTenant(async (tx) => {
```

**الملف:** `backend/src/prisma/tenant-prisma.service.ts` (أسطر 66-75)

```typescript
  async withTenant<T>(fn: ...) {
    const tenantId = TenantContext.getTenantId();

    return this.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT set_config('app.current_tenant_id', ${tenantId}, true)
      `;
      return fn(tx as unknown as ...);
    });
  }
```

**مسار الـ Transaction:** `createBatchWithLedger` → `processOutflowBatch` → `db.withTenant(fn)` → `this.$transaction(async (tx) => { ... })`.

---

### 4.2 مسار الـ Rollback عند فشل الفاتورة رقم 3

1. `processOutflowBatch` يدخل `withTenant` → يبدأ `$transaction`.
2. تُنشأ الفاتورة 1 و 2 بنجاح.
3. عند إنشاء الفاتورة 3 يحدث خطأ (مثلاً: `_getVaultAccount` يرمي `NotFoundException`).
4. الاستثناء يخرج من الـ callback دون استدعاء `return`.
5. Prisma يلغي الـ transaction بالكامل.
6. جميع التغييرات (الفواتير 1 و 2، القيود، الـ AuditLog) تُرجع (Rollback).
7. لا يُحفظ أي شيء في قاعدة البيانات.

---

## 5. اختبار المنع (Bypass Check)

### 5.1 كود رفع 401 في TenantMiddleware

**الملف:** `backend/src/common/tenant.middleware.ts` (أسطر 36-41)

```typescript
      if (!tenantId) {
        // token صالح لكن بدون tenantId (tokens قديمة) — رفض صريح
        throw new UnauthorizedException(
          'التوكين منتهي الصلاحية أو غير مكتمل. يُرجى تسجيل الدخول مجدداً.',
        );
      }
```

---

### 5.2 ثغرة حرجة — الـ 401 لا يُعاد فعلياً

**الملف:** `backend/src/common/tenant.middleware.ts` (أسطر 25-49)

```typescript
    try {
      const token   = authHeader.slice(7);
      const payload = this.jwtService.verify<...>(token, ...);

      const tenantId = payload?.tenantId;
      const userId   = payload?.sub ?? null;

      if (!tenantId) {
        throw new UnauthorizedException(...);  // ← نرمي الاستثناء
      }

      TenantContext.run(tenantId, userId, () => next());
    } catch {                    // ← نلتقط كل الاستثناءات
      next();                    // ← نستدعي next() بدلاً من إعادة الرمي!
    }
```

**المشكلة:** عند غياب `tenantId` يُرمى `UnauthorizedException`، لكن الـ `catch` يلتقطه ويستدعي `next()` بدلاً من إعادة رميه. النتيجة: الطلب يستمر ولا يُعاد 401.

**الإصلاح المطلوب:** إعادة رمي `UnauthorizedException` في الـ `catch`:

```typescript
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      next();
    }
```

---

## الخلاصة

| البند | الحالة |
|-------|--------|
| RLS على 13 جدولاً | ✅ مثبت |
| TenantPrismaService في VaultsService و InvoiceService | ✅ مثبت |
| Decimal في VaultsService | ✅ مثبت |
| Decimal في Footer (PurchasesBatchScreen) | ✅ مثبت |
| salary و advance في CreateInvoiceDto | ✅ مثبت |
| حساب الضريبة المركزي في الباكيند | ✅ مثبت |
| Batch داخل $transaction | ✅ مثبت |
| Rollback عند فشل أي فاتورة | ✅ مثبت |
| TenantMiddleware يمنع التوكينات القديمة | ❌ ثغرة — الـ catch يبتلع الاستثناء |
