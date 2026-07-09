import { useCallback } from 'react';
import { usePrintPreview } from '../../../ui';
import { exportToExcel } from '../../../utils/exportUtils';
import { buildPrintTableHtml } from '../../../utils/printTableHtml';
import { buildOwnerExcelRows, buildOwnerPdfColumns, buildOwnerPdfData, ownerExcelFilename, ownerPdfFilename } from '../utils/ownerDashboardExportRows';
import type { OwnerOverviewExportRow } from '../../../types/api';

type TFunction = (key: string) => string;

export function useOwnerDashboardExports(
  exportRows: OwnerOverviewExportRow[],
  lang: string,
  year: number,
  selectedMonthNum: number | null,
  t: TFunction,
) {
  const { openPrintDocumentPreview, printPreviewModal } = usePrintPreview({
    title: t('ownerDashboard'),
    closeLabel: t('close') || 'Close',
    printLabel: `${t('print')} / PDF`,
  });

  const handleExportExcel = useCallback(() => {
    const rows = buildOwnerExcelRows(exportRows, lang);
    exportToExcel(rows, ownerExcelFilename(year, selectedMonthNum));
  }, [exportRows, lang, year, selectedMonthNum]);

  const handlePrintPdf = useCallback(() => {
    const cols = buildOwnerPdfColumns(lang);
    const data = buildOwnerPdfData(exportRows, lang);
    openPrintDocumentPreview({
      title: `${t('ownerDashboard')} - ${year}`,
      subtitle: ownerPdfFilename(year),
      landscape: true,
      body: buildPrintTableHtml({
        columns: cols.map((label, index) => ({ key: String(index), header: label })),
        rows: data.map((row) => cols.reduce<Record<string, unknown>>((acc, label, index) => {
          acc[String(index)] = row[index] ?? '';
          return acc;
        }, {})),
      }),
    });
  }, [exportRows, lang, openPrintDocumentPreview, t, year]);

  return { handleExportExcel, handlePrintPdf, printPreviewModal };
}
