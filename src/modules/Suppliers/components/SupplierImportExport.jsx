/**
 * SupplierImportExport — استيراد وتصدير الموردين عبر ملف CSV
 *
 * أعمدة التامبلت:
 *   A: الاسم بالعربي *  (إلزامي)
 *   B: الاسم بالإنجليزي
 *   C: الرقم الضريبي
 *   D: الهاتف
 *   E: نوع المورد      (purchases | expenses)
 */
import React, { useRef, useState } from 'react';

/* ─── ثوابت ─────────────────────────────────────────────────────────── */
const CSV_HEADERS_AR = ['الاسم بالعربي *', 'الاسم بالإنجليزي', 'الرقم الضريبي', 'الهاتف', 'نوع المورد (purchases/expenses)'];
const CSV_HEADERS_EN = ['nameAr', 'nameEn', 'taxNumber', 'phone', 'supplierType'];

const SAMPLE_ROWS = [
  ['مورد تجريبي أول', 'First Test Supplier', '3001234567890', '0501234567', 'purchases'],
  ['مورد مصروفات', '', '', '', 'expenses'],
];

/* ─── أدوات CSV ─────────────────────────────────────────────────────── */
function escapeCell(val) {
  const s = String(val ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function buildCsv(rows) {
  const lines = rows.map((r) => r.map(escapeCell).join(','));
  return lines.join('\r\n');
}

function downloadCsv(content, filename) {
  const bom = '\uFEFF'; // BOM لدعم Excel العربي
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text) {
  // إزالة BOM
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = clean.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  // السطر الأول رؤوس — نتحقق إن كانت عربية أو إنجليزية
  const headerLine = lines[0].toLowerCase();
  const isArabicHeader = headerLine.includes('الاسم') || headerLine.includes('اسم');

  const dataLines = isArabicHeader ? lines.slice(1) : lines; // إن لم تكن رؤوس نبدأ من 0

  return dataLines.map((line) => {
    // تحليل CSV بسيط مع دعم الخلايا بين علامات اقتباس
    const cells = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    cells.push(cur.trim());

    const nameAr     = cells[0] || '';
    const nameEn     = cells[1] || '';
    const taxNumber  = cells[2] || '';
    const phone      = cells[3] || '';
    const rawType    = (cells[4] || '').toLowerCase();
    const supplierType = rawType.includes('expense') ? 'expenses' : 'purchases';

    return { nameAr, nameEn, taxNumber, phone, supplierType };
  }).filter((r) => r.nameAr.trim()); // تجاهل الصفوف الفارغة أو بدون اسم عربي
}

/* ─── المكون الرئيسي ────────────────────────────────────────────────── */
export default function SupplierImportExport({ companyId, suppliers = [], onImport }) {
  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult]       = useState(null); // { success, failed, errors }

  /* تنزيل التامبلت */
  function handleDownloadTemplate() {
    const rows = [CSV_HEADERS_AR, ...SAMPLE_ROWS];
    downloadCsv(buildCsv(rows), 'نموذج_استيراد_الموردين.csv');
  }

  /* تصدير الموردين الحاليين */
  function handleExport() {
    if (!suppliers.length) return;
    const rows = [
      CSV_HEADERS_AR,
      ...suppliers.map((s) => [
        s.nameAr || '',
        s.nameEn || '',
        s.taxNumber || '',
        s.phone || '',
        s.supplierType || 'purchases',
      ]),
    ];
    downloadCsv(buildCsv(rows), `الموردين_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  /* قراءة ملف الاستيراد */
  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const text = await file.text();
    const rows = parseCsv(text);

    if (!rows.length) {
      setResult({ success: 0, failed: 0, errors: ['لم يتم العثور على بيانات صالحة في الملف.'] });
      return;
    }

    setImporting(true);
    setResult(null);

    let success = 0;
    const errors = [];

    for (const row of rows) {
      try {
        await onImport({ ...row, companyId });
        success++;
      } catch (err) {
        errors.push(`"${row.nameAr}": ${err?.message || 'خطأ غير معروف'}`);
      }
    }

    setImporting(false);
    setResult({ success, failed: errors.length, errors });
  }

  const btnBase = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', border: '1px solid var(--noorix-border)',
    background: 'var(--noorix-bg-surface)', color: 'var(--noorix-text)',
    fontFamily: 'inherit', whiteSpace: 'nowrap', minHeight: 38,
    transition: 'background 0.15s',
  };

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {/* ── شريط الأدوات ── */}
      <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
        padding: '10px 14px',
        background: 'var(--noorix-bg-muted)',
        borderRadius: 10,
        border: '1px solid var(--noorix-border)',
      }}>
        {/* تنزيل النموذج */}
        <button type="button" style={{ ...btnBase }} onClick={handleDownloadTemplate}>
          تنزيل النموذج
        </button>

        {/* استيراد */}
        <button
          type="button"
          style={{ ...btnBase, background: 'rgba(37,99,235,0.08)', color: 'var(--noorix-accent-blue)', borderColor: 'rgba(37,99,235,0.25)' }}
          onClick={() => fileRef.current?.click()}
          disabled={importing}
        >
          {importing ? 'جاري الاستيراد...' : 'استيراد CSV'}
        </button>
        <input
          ref={fileRef} type="file" accept=".csv,text/csv"
          style={{ display: 'none' }} onChange={handleFileChange}
        />

        {/* تصدير */}
        <button
          type="button"
          style={{ ...btnBase, background: 'rgba(22,163,74,0.08)', color: 'var(--noorix-accent-green)', borderColor: 'rgba(22,163,74,0.25)' }}
          onClick={handleExport}
          disabled={!suppliers.length}
        >
          تصدير ({suppliers.length})
        </button>
      </div>

      {/* ── نتيجة الاستيراد ── */}
      {result && (
        <div style={{
          padding: '10px 14px', borderRadius: 10,
          background: result.failed === 0 ? 'rgba(22,163,74,0.07)' : 'rgba(234,179,8,0.07)',
          border: `1px solid ${result.failed === 0 ? 'rgba(22,163,74,0.25)' : 'rgba(234,179,8,0.35)'}`,
          fontSize: 13,
        }}>
          <div style={{ fontWeight: 700, marginBottom: result.errors.length ? 6 : 0 }}>
            {result.failed === 0
              ? `تم استيراد ${result.success} مورد بنجاح`
              : `تم استيراد ${result.success} بنجاح — فشل ${result.failed}`}
          </div>
          {result.errors.length > 0 && (
            <ul style={{ margin: 0, padding: 'revert', fontSize: 12, color: 'var(--noorix-accent-red)', maxHeight: 120, overflowY: 'auto' }}>
              {result.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
          <button
            type="button"
            onClick={() => setResult(null)}
            style={{ marginTop: 8, fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--noorix-text-muted)' }}
          >
            إخفاء
          </button>
        </div>
      )}
    </div>
  );
}
