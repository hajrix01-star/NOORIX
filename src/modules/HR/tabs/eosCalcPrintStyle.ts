export const EOS_CALC_PRINT_CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  .doc{background:#fff;border:1px solid #dbe1e8;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);max-width:900px;margin:0 auto}
  .head{padding:20px 24px;border-bottom:2px solid #dbe1e8;background:#f8fafc;text-align:center}
  .head-sub{font-size:13px;font-weight:700;color:#374151;margin-top:6px}
  .head-date{font-size:11px;color:#64748b;margin-top:4px}
  .section{padding:16px 24px}
  .bi{display:grid;grid-template-columns:1fr 1px 1fr;gap:0;align-items:stretch}
  .sep{background:#e2e8f0;width:1px}
  .box-ar{padding:0 16px 0 12px;direction:rtl;text-align:right}
  .box-en{padding:0 12px 0 16px;direction:ltr;text-align:left}
  .box-title{font-size:13px;font-weight:800;color:#0a1f44;padding:10px 0 8px;border-bottom:2px solid #dbe1e8;margin-bottom:10px;text-align:center}
  .row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px dashed #e2e8f0;gap:8px;font-size:12px}
  .row:last-child{border-bottom:none}
  .row-label{color:#64748b;font-weight:600}
  .row-val{font-weight:700;color:#1a2332;white-space:nowrap}
  .row-highlight{background:#f0fdf4;border-radius:6px;padding:6px 8px;margin-top:4px;font-size:13px}
  .row-highlight .row-label{color:#15803d;font-weight:700}
  .row-highlight .row-val{color:#15803d;font-size:15px}
  .tbl-section{padding:16px 24px;border-top:1px solid #dbe1e8;background:#fafcff}
  table{width:100%;border-collapse:collapse;font-size:12px}
  thead th{background:#f1f5f9;padding:8px 12px;font-weight:700;color:#374151;border:1px solid #dbe1e8;text-align:center}
  tbody td{padding:7px 12px;border:1px solid #dbe1e8;color:#1a2332}
  tbody tr:nth-child(even) td{background:#f8fafc}
  .td-ar{text-align:right;direction:rtl}
  .td-en{text-align:left;direction:ltr}
  .td-num{text-align:center;font-weight:600;font-family:'Noto Sans Arabic','IBM Plex Sans',Arial,sans-serif}
  .foot{padding:12px 24px;border-top:1px solid #dbe1e8;background:#f8fafc;text-align:center;font-size:11px;color:#94a3b8}
  @media print{.doc{box-shadow:none;border:none}}
`;
