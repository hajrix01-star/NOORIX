/**
 * أنماط طباعة/PDF لتصدير تقرير الربح والخسارة (جدول عام).
 */
export function profitLossPdfExportExtraCss(): string {
  return `
.pl-pdf-export-wrap { margin-top: 8px; }
table.pl-pdf-export-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  box-shadow: 0 1px 3px rgba(15,23,42,0.08);
  border-radius: 6px;
  overflow: hidden;
}
table.pl-pdf-export-table thead th {
  background: linear-gradient(180deg, #0f172a 0%, #1e3a5f 100%) !important;
  color: #fff !important;
  font-weight: 800;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 10px 8px !important;
  border: 1px solid #0f172a !important;
  vertical-align: middle;
}
table.pl-pdf-export-table tbody td {
  padding: 7px 8px !important;
  border: 1px solid #e2e8f0 !important;
  vertical-align: middle;
  line-height: 1.35;
}
table.pl-pdf-export-table tbody td:first-child {
  font-weight: 500;
  color: #1e293b;
  background: #fafbfc !important;
}
table.pl-pdf-export-table tbody td:not(:first-child) {
  text-align: center !important;
  font-variant-numeric: tabular-nums;
  font-family: 'Noto Sans Arabic', 'IBM Plex Sans', ui-monospace, monospace;
}
table.pl-pdf-export-table tbody tr.pl-pdf-row-group td {
  font-weight: 800;
  font-size: 11px;
  border-top: 2px solid #94a3b8 !important;
}
table.pl-pdf-export-table tbody tr.pl-pdf-gk-sales td {
  background: linear-gradient(180deg, #dbeafe 0%, #eff6ff 100%) !important;
  color: #1e40af;
}
table.pl-pdf-export-table tbody tr.pl-pdf-gk-purchases td {
  background: linear-gradient(180deg, #fee2e2 0%, #fef2f2 100%) !important;
  color: #991b1b;
}
table.pl-pdf-export-table tbody tr.pl-pdf-gk-expenses td {
  background: linear-gradient(180deg, #ffedd5 0%, #fffbeb 100%) !important;
  color: #9a3412;
}
table.pl-pdf-export-table tbody tr.pl-pdf-row-summary td {
  font-weight: 800;
  font-size: 11px;
  background: linear-gradient(180deg, #e0e7ff 0%, #eef2ff 100%) !important;
  border-top: 2px double #4338ca !important;
  color: #312e81;
}
table.pl-pdf-export-table tbody tr.pl-pdf-row-summary.pl-pdf-net-positive td:not(:first-child) {
  color: #15803d !important;
}
table.pl-pdf-export-table tbody tr.pl-pdf-row-summary.pl-pdf-net-negative td:not(:first-child) {
  color: #b91c1c !important;
}
table.pl-pdf-export-table tbody tr.pl-pdf-row-detail:nth-child(even) td:not(:first-child) {
  background: #f8fafc !important;
}
table.pl-pdf-export-table tbody tr.pl-pdf-row-detail:nth-child(even) td:first-child {
  background: #f1f5f9 !important;
}
@media print {
  table.pl-pdf-export-table { font-size: 10px; }
  table.pl-pdf-export-table thead th { padding: 8px 6px !important; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
`.trim();
}
