/**
 * Reads restaurant_monthly_report.html (monthly table: كاش / مدى / تطبيقات / مصروفات / رواتب).
 * Writes two Excel files for Noorix bulk import:
 *   - sales: one daily-summary row per month (transaction date = last day of month), three vault columns.
 *   - purchases: one "مشتريات" invoice per month when المصروفات > 0.
 *
 * ── كيف تُغذّى قاعدة البيانات في نووركس؟ ───────────────────────────────────
 * هذا السكربت لا يتصل بقاعدة البيانات ولا يزرعها مباشرة؛ يحوّل HTML → Excel فقط.
 * الإدخال الفعلي يتم بأحد المسارين:
 *   1) من التطبيق: استيراد المبيعات + استيراد الفواتير (المشتريات) من الملفين المُخرَجين.
 *   2) عبر الـ API (نفس الحقول التي يرسلها الاستيراد) باستخدام JWT + companyId.
 *
 * أسماء أعمدة «قناة: …» يجب أن تطابق nameAr أو nameEn للخزائن في شركتك (مثلاً وقت الكرك).
 * للتحقق من الخزائن: من واجهة الخزائن، أو GET /api/v1/vaults?companyId=… مع صلاحية VAULTS_READ.
 *
 * Edit VAULT_COLUMN_LABELS / PURCHASE_VAULT_NAME if your vault names differ.
 *
 * Usage:
 *   node scripts/restaurant-monthly-html-to-import.mjs path/to/restaurant_monthly_report.html
 *   node scripts/restaurant-monthly-html-to-import.mjs path/to/report.html ./out-dir
 */
import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

/** Must match vault names in Noorix (import matches nameAr or nameEn). وقت الكرك: نقد / بنك / هنجرستيشن */
const VAULT_COLUMN_LABELS = {
  /** عمود «كاش» في التقرير */
  cash: 'نقد',
  /** عمود «مدى» في التقرير */
  mada: 'بنك',
  /** عمود «تطبيقات» في التقرير → خزينة التطبيق */
  apps: 'هنجرستيشن',
};

/** صندوق دفع فاتورة المشتريات الشهرية الواحدة */
const PURCHASE_VAULT_NAME = 'نقد';

/** مورد افتراضي لملخص مشتريات الشهر (اختياري؛ اتركه فارغاً وعيّن من الواجهة إن لزم). */
const PURCHASE_SUPPLIER_NAME = '';

function parseMoneyCell(s) {
  if (s == null || s === '') return 0;
  const n = Number(String(s).replace(/,/g, '').replace(/\s/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function lastDayYmd(year, month1to12) {
  const d = new Date(year, month1to12, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseHtmlTable(html) {
  const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
  if (!tbody) throw new Error('No <tbody> found in HTML.');
  const rows = [];
  for (const tr of tbody[1].matchAll(/<tr>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...tr[1].matchAll(/<td>([\s\S]*?)<\/td>/gi)].map((m) =>
      m[1].replace(/<[^>]+>/g, '').trim(),
    );
    if (cells.length >= 8) rows.push(cells);
  }
  return rows;
}

function main() {
  const inPath = process.argv[2];
  const outDirArg = process.argv[3];
  if (!inPath) {
    console.error('Usage: node scripts/restaurant-monthly-html-to-import.mjs <input.html> [output-dir]');
    process.exit(1);
  }
  const absIn = path.resolve(inPath);
  const outDir = outDirArg ? path.resolve(outDirArg) : path.dirname(absIn);
  if (!fs.existsSync(absIn)) {
    console.error('File not found:', absIn);
    process.exit(1);
  }
  fs.mkdirSync(outDir, { recursive: true });

  const html = fs.readFileSync(absIn, 'utf8');
  const rawRows = parseHtmlTable(html);

  const salesRows = [];
  const purchaseRows = [];

  for (const cells of rawRows) {
    const [monthYm, sheetName, , cashS, madaS, appsS, expS] = cells;
    if (monthYm === 'الشهر' || !/^\d{4}-\d{2}$/.test(monthYm)) continue;

    const [yStr, mStr] = monthYm.split('-');
    const y = Number(yStr);
    const m = Number(mStr);
    const txDate = lastDayYmd(y, m);

    const cash = parseMoneyCell(cashS);
    const mada = parseMoneyCell(madaS);
    const apps = parseMoneyCell(appsS);
    const expenses = parseMoneyCell(expS);

    const hasSales = cash > 0 || mada > 0 || apps > 0;
    if (hasSales) {
      const row = {
        'تاريخ اليوم': txDate,
        'عدد العملاء': 0,
        'النقد في اليد': 0,
        'ملاحظات': `ملخص شهري ${monthYm} (${sheetName}) — تطبيقات → ${VAULT_COLUMN_LABELS.apps}`,
      };
      if (cash > 0) row[`قناة: ${VAULT_COLUMN_LABELS.cash}`] = cash;
      if (mada > 0) row[`قناة: ${VAULT_COLUMN_LABELS.mada}`] = mada;
      if (apps > 0) row[`قناة: ${VAULT_COLUMN_LABELS.apps}`] = apps;
      salesRows.push(row);
    }

    if (expenses > 0) {
      purchaseRows.push({
        'تاريخ الفاتورة': txDate,
        'نوع الفاتورة': 'مشتريات',
        'المبلغ الإجمالي': expenses,
        'اسم الصندوق': PURCHASE_VAULT_NAME,
        'اسم المورد': PURCHASE_SUPPLIER_NAME,
        'ملاحظات': `مصروفات شهر ${monthYm} (${sheetName}) — فاتورة مشتريات شهرية واحدة`,
      });
    }
  }

  const salesPath = path.join(outDir, 'restaurant_monthly_sales_import.xlsx');
  const purPath = path.join(outDir, 'restaurant_monthly_purchases_import.xlsx');

  const wsSales = XLSX.utils.json_to_sheet(salesRows);
  const wbSales = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbSales, wsSales, 'مبيعات');
  XLSX.writeFile(wbSales, salesPath);

  const wsPur = XLSX.utils.json_to_sheet(purchaseRows);
  const wbPur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbPur, wsPur, 'مشتريات');
  XLSX.writeFile(wbPur, purPath);

  console.log(`Wrote ${salesRows.length} sales rows → ${salesPath}`);
  console.log(`Wrote ${purchaseRows.length} purchase rows → ${purPath}`);
  console.log(
    'تأكد أن أسماء الخزائن في الملف تطابق nameAr/nameEn في نووركس، ثم استورد: المبيعات ثم الفواتير.',
  );
}

main();
