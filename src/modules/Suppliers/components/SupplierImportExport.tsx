import React, { useRef, useState, type ChangeEvent } from 'react';
import { Button, FileInput } from '../../../ui';
import { exportToExcel } from '../../../utils/exportUtils';
import { fetchAllSuppliersForExport } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import type { SupplierCategoryRecord, SupplierCreatePayload, SupplierRecord } from '../supplierTypes';
import {
  buildSupplierExportFilename,
  buildSupplierExportRows,
  buildSupplierTemplateCsv,
  importSupplierRows,
  parseSupplierCsv,
  SUPPLIER_EXPORT_COLUMNS,
  type SupplierImportResult,
} from '../supplierImportExportModel';

export type SupplierImportExportProps = {
  companyId: string;
  suppliers?: SupplierRecord[];
  categories?: SupplierCategoryRecord[];
  onImport: (body: SupplierCreatePayload) => Promise<unknown>;
};

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function SupplierImportExport({
  companyId,
  suppliers = [],
  categories = [],
  onImport,
}: SupplierImportExportProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<SupplierImportResult | null>(null);
  const { showToast } = useToast();

  function handleDownloadTemplate() {
    downloadCsv(buildSupplierTemplateCsv(), 'نموذج_استيراد_الموردين.csv');
  }

  async function handleExport() {
    if (!companyId || exporting) return;
    setExporting(true);
    try {
      const allSuppliers = await fetchAllSuppliersForExport(companyId);
      if (!allSuppliers.length) return;
      await exportToExcel({
        data: buildSupplierExportRows(allSuppliers, categories),
        filename: buildSupplierExportFilename(),
        title: 'دليل الموردين',
        sheetName: 'الموردون',
        columns: SUPPLIER_EXPORT_COLUMNS,
        textColumnKeys: ['taxNumber', 'phone'],
        rtl: true,
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'تعذر تصدير الموردين', 'error');
    } finally {
      setExporting(false);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';

    const rows = parseSupplierCsv(await file.text());
    if (!rows.length) {
      setResult({ success: 0, failed: 0, errors: ['لم يتم العثور على بيانات صالحة في الملف.'] });
      return;
    }

    setImporting(true);
    setResult(null);
    const nextResult = await importSupplierRows(rows, companyId, onImport);
    setImporting(false);
    setResult(nextResult);
  }

  return (
    <div className="grid gap-2.5">
      <div className="flex items-center flex-wrap gap-2 bg-noorix-bg-muted rounded-lg border border-noorix-border py-[10px] px-[14px]">
        <Button onClick={handleDownloadTemplate}>تنزيل النموذج</Button>

        <Button
          variant="primary"
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          loading={importing}
        >
          {importing ? 'جاري الاستيراد...' : 'استيراد CSV'}
        </Button>
        <FileInput
          ref={fileRef}
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFileChange}
        />

        <Button
          variant="success"
          onClick={() => void handleExport()}
          disabled={!companyId || exporting}
          loading={exporting}
        >
          {exporting ? 'جاري تصدير الموردين...' : 'تصدير Excel'}
        </Button>
      </div>

      {result && (
        <div className={`py-[10px] px-[14px] rounded-[10px] text-[13px] border ${result.failed === 0 ? 'bg-[var(--noorix-green-7)] border-[var(--noorix-green-25)]' : 'bg-[var(--noorix-yellow-7)] border-[var(--noorix-yellow-35)]'}`}>
          <div className={`font-bold ${result.errors.length ? 'mb-1.5' : ''}`}>
            {result.failed === 0
              ? `تم استيراد ${result.success} مورد بنجاح`
              : `تم استيراد ${result.success} بنجاح - فشل ${result.failed}`}
          </div>
          {result.errors.length > 0 && (
            <ul className="m-0 text-[12px] max-h-[120px] overflow-y-auto ps-5 text-noorix-red list-disc">
              {result.errors.map((error) => <li key={error}>{error}</li>)}
            </ul>
          )}
          <Button
            variant="ghost"
            type="button"
            onClick={() => setResult(null)}
            className="mt-2 cursor-pointer text-noorix-muted text-[11px]"
          >
            إخفاء
          </Button>
        </div>
      )}
    </div>
  );
}
