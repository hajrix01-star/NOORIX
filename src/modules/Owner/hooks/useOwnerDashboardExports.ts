import { useCallback } from 'react';
import { exportToExcel, exportTableToPdf } from '../../../utils/exportUtils';
import { buildOwnerExcelRows, buildOwnerPdfColumns, buildOwnerPdfData, ownerExcelFilename, ownerPdfFilename } from '../utils/ownerDashboardExportRows';
import type { OwnerKpiTotals } from '../types';

type TFunction = (key: string) => string;

export function useOwnerDashboardExports(
  aggregated: OwnerKpiTotals,
  lang: string,
  year: number,
  selectedMonthNum: number | null,
  t: TFunction,
) {
  const handleExportExcel = useCallback(() => {
    const rows = buildOwnerExcelRows(aggregated, lang);
    exportToExcel(rows, ownerExcelFilename(year, selectedMonthNum));
  }, [aggregated, lang, year, selectedMonthNum]);

  const handleExportPdf = useCallback(() => {
    const cols = buildOwnerPdfColumns(lang);
    const data = buildOwnerPdfData(aggregated, lang);
    exportTableToPdf({
      title: `${t('ownerDashboard')} — ${year}`,
      filename: ownerPdfFilename(year),
      columns: cols,
      data,
    });
  }, [aggregated, lang, t, year]);

  return { handleExportExcel, handleExportPdf };
}
