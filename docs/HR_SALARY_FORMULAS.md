# معادلات الرواتب والأوفر تايم ونهاية الخدمة

## حاسبة الرواتب (لشهر محدد YYYY-MM)

### عامل الاستحقاق النسبي (Proration)

- **إن التحق الموظف خلال نفس الشهر فقط:**
  ```
  proration = أيام_العمل_خلال_الشهر / عدد_أيام_الشهر
  ```
- **وإلا:** `proration = 1`

### المكونات بعد الاستحقاق النسبي

| المكون | المعادلة |
|--------|----------|
| basic | basic_salary × proration |
| housing | housing_allowance × proration |
| transport | transport_allowance × proration |
| overtime_component | other_allowances × proration |
| overtime_pay | ساعات_إضافية × (أساس÷30÷8) × 1.5 |
| **gross** | basic + housing + transport + overtime_component + overtime_pay |

### التأمينات الاجتماعية (GOSI)

```
gosi = (is_gosi_subscribed ? basic × (gosi_percentage/100) : 0)
```

### الخصومات

- **خصومات السلف:** loanDeduction = Σ monthly_deduction لكل قرض active
- **الخصومات اليدوية:** manualTotal = absenceDeduction + lateDeduction + otherDeductions
- **الإجمالي:** totalDeductions = gosi + loanDeduction + manualTotal
- **الصافي:** net = gross - totalDeductions

---

## مكافأة نهاية الخدمة (EOS)

### الراتب المعتمد (بدون أوفر تايم)

```
totalSalary = basic_salary + housing_allowance + transport_allowance
```

### مدة الخدمة

```
totalYears = daysBetween(endDate, startDate) / 365
```

### المكافأة الأساسية (المادة 84)

- **إذا totalYears ≤ 5:**
  ```
  baseReward = (totalSalary / 2) × totalYears
  ```
- **وإلا:**
  ```
  baseReward = (totalSalary / 2) × 5 + totalSalary × (totalYears - 5)
  ```

### نسبة الاستحقاق حسب سبب الإنهاء

| السبب | السنوات | النسبة |
|-------|---------|--------|
| استقالة | < 2 | 0% |
| استقالة | 2 ≤ x < 5 | 33.33% |
| استقالة | 5 ≤ x < 10 | 66.67% |
| استقالة | ≥ 10 | 100% |
| انتهاء عقد / إنهاء من صاحب العمل | أي | 100% |

### الناتج النهائي

```
finalReward = baseReward × (entitlementPercent / 100)
netPayable = finalReward + pendingSalaries + leaveBalance - deductions
```
