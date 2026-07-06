import { useCallback } from 'react';
import { exportToExcel, exportTableToPdf } from '../../../utils/exportUtils';
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
  const handleExportExcel = useCallback(() => {
    const rows = buildOwnerExcelRows(exportRows, lang);
    exportToExcel(rows, ownerExcelFilename(year, selectedMonthNum));
  }, [exportRows, lang, year, selectedMonthNum]);

  const handleExportPdf = useCallback(() => {
    const cols = buildOwnerPdfColumns(lang);
    const data = buildOwnerPdfData(exportRows, lang);
    exportTableToPdf({
      title: `${t('ownerDashboard')} — ${year}`,
      filename: ownerPdfFilename(year),
      columns: cols,
      data,
    });
  }, [exportRows, lang, t, year]);

  return { handleExportExcel, handleExportPdf };
}
