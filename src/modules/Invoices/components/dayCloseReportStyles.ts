export const DAY_CLOSE_REPORT_STYLES = `
        .day-close-report { --dc-border: #94a3b8; --dc-head: #0f172a; --dc-muted: #64748b; }
        .day-close-report .dc-section-title {
          font-size: 12px; font-weight: 800; color: var(--dc-head); margin: 0 0 8px; padding-bottom: 4px;
          border-bottom: 2px solid #cbd5e1; letter-spacing: 0.02em;
        }
        .day-close-report .dc-table {
          width: 100%; border-collapse: collapse; font-size: 12px;
          font-feature-settings: "tnum" 1; font-variant-numeric: tabular-nums;
        }
        .day-close-report .dc-table caption { caption-side: top; text-align: right; font-weight: 700; font-size: 11px; color: var(--dc-muted); padding: 0 0 6px; }
        .day-close-report .dc-table thead th {
          background: #1e293b; color: #fff; font-weight: 700; text-align: right; padding: 8px 10px;
          border: 1px solid #0f172a; font-size: 11px; white-space: nowrap;
        }
        .day-close-report .dc-table tbody td {
          text-align: right; padding: 7px 10px; border: 1px solid #cbd5e1; vertical-align: top;
          line-height: 1.35; color: #0f172a;
        }
        .day-close-report .dc-table tbody tr:nth-child(even) td { background: var(--noorix-bg-page, #f8fafc); }
        .day-close-report .dc-table .dc-num { font-family: var(--noorix-font-numbers, ui-monospace, monospace); text-align: left; direction: ltr; unicode-bidi: isolate; }
        .day-close-report .dc-table .dc-muted { color: var(--dc-muted); font-size: 10px; font-weight: 500; }
        .day-close-report .dc-table .dc-empty { text-align: center; color: var(--dc-muted); font-style: italic; }
        .day-close-report .dc-kpi-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(148px, 1fr)); gap: 10px;
        }
        .day-close-report .dc-kpi-card {
          padding: 10px 12px; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff;
        }
        .day-close-report .dc-kpi-card__label { font-size: 10px; font-weight: 800; color: #334155; margin-bottom: 4px; }
        .day-close-report .dc-kpi-card__val { font-size: 16px; font-weight: 800; font-family: var(--noorix-font-numbers); letter-spacing: 0.02em; }
        .day-close-report .dc-kpi-card__sub { font-size: 10px; color: var(--dc-muted); margin-top: 4px; }
        .day-close-report .dc-kpi-card--in { border-color: var(--noorix-green-35); background: var(--noorix-green-6); }
        .day-close-report .dc-kpi-card--out { border-color: var(--noorix-red-25); background: var(--noorix-red-4); }
        .day-close-report .dc-kpi-card--cash { border-color: var(--noorix-blue-30); background: var(--noorix-blue-5); }
        .day-close-report .dc-kpi-card--bal { border-color: var(--noorix-violet-28); background: var(--noorix-violet-5); }
        .day-close-report .dc-print-cash-line {
          margin: 0 0 8px;
          padding: 0;
          border: none;
          background: transparent;
          box-shadow: none;
        }
        .day-close-report .dc-print-cash-line__row {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: var(--dc-head);
          line-height: 1.45;
        }
        .day-close-report .dc-print-cash-line__label { font-weight: 800; }
        .day-close-report .dc-print-cash-line__amount {
          font-weight: 900;
          font-size: 13px;
          font-family: var(--noorix-font-numbers, ui-monospace, monospace);
          direction: ltr;
          unicode-bidi: isolate;
          margin-inline-start: 4px;
        }
        .day-close-report .dc-print-cash-line__meta {
          font-size: 10px;
          font-weight: 600;
          color: var(--dc-muted);
        }
        .day-close-report .dc-print-cash-line__sub {
          margin-top: 3px;
          font-size: 10px;
          font-weight: 600;
          color: var(--dc-muted);
          line-height: 1.35;
        }
        .day-close-report .dc-inline-stats {
          display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 11px; margin-top: 4px;
        }
        .day-close-report .dc-inline-stats > div {
          padding: 8px 10px; background: #f1f5f9; border-radius: 6px; border: 1px solid #e2e8f0;
        }
        .day-close-ops-wrap {
          border: 1px solid #cbd5e1; border-radius: 6px; overflow: auto; max-height: 300px;
        }
        .day-close-print-only { display: none !important; }
        .day-close-multi-print { display: none !important; }

        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          html, body {
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            margin: 0 !important;
          }
          #root { min-height: 0 !important; height: auto !important; }
          body > *:not(.nx-modal-backdrop) { display: none !important; }
          .nx-modal-backdrop {
            position: static !important;
            inset: auto !important;
            display: block !important;
            width: 100% !important;
            min-height: 0 !important;
            height: auto !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            box-shadow: none !important;
            overflow: visible !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }
          .nx-modal-backdrop,
          .nx-modal-backdrop * {
            visibility: visible !important;
          }
          .nx-modal.day-close-modal {
            max-width: 100% !important;
            max-height: none !important;
            overflow: visible !important;
            box-shadow: none !important;
            border: none !important;
          }
          .nx-modal.day-close-modal .flex-1.overflow-y-auto {
            overflow: visible !important;
            max-height: none !important;
            padding: 2mm 4mm !important;
          }
          .day-close-no-print { display: none !important; }
          .day-close-screen-only { display: none !important; }
          .day-close-print-only { display: table !important; }
          .day-close-print-only.dc-print-block { display: block !important; }
          .day-close-print-root {
            box-shadow: none !important; border: none !important; background: #fff !important;
            max-width: 100% !important; padding: 0 !important; margin: 0 !important; border-radius: 0 !important;
            zoom: 0.92;
          }
          [data-print-mode="multi"] .day-close-single-print { display: none !important; }
          [data-print-mode="multi"] .day-close-multi-print { display: block !important; }
          [data-print-mode="single"] .day-close-multi-print { display: none !important; }
          .day-close-multi-day--break {
            page-break-before: always;
            break-before: page;
          }
          .day-close-ops-wrap {
            max-height: none !important; overflow: visible !important; border: none !important;
          }
          .day-close-report .dc-table thead th { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .day-close-report .dc-table tbody tr:nth-child(even) td { background: #f8fafc !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .day-close-report .dc-section-title {
            font-size: 9pt !important; page-break-after: avoid; border-bottom-color: #333 !important;
            margin: 0 0 4px !important; padding-bottom: 2px !important;
          }
          .day-close-report .dc-table { font-size: 8.5pt !important; page-break-inside: auto; }
          .day-close-report .dc-table thead { display: table-header-group !important; }
          .day-close-report .dc-table thead th {
            font-size: 8pt !important; padding: 4px 6px !important; background: #1e293b !important; color: #fff !important;
          }
          .day-close-report .dc-table tbody td { font-size: 8pt !important; padding: 3px 6px !important; line-height: 1.25 !important; }
          .day-close-report .dc-table .dc-num { font-size: 8pt !important; }
          .day-close-report .dc-print-header {
            text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px;
          }
          .day-close-report .dc-print-header__co { font-size: 12pt; font-weight: 800; margin: 0 0 2px; }
          .day-close-report .dc-print-header__doc { font-size: 10pt; font-weight: 700; margin: 0; color: #333; }
          .day-close-report .dc-print-header__date { font-size: 8pt; margin: 4px 0 0; color: #555; }
          .day-close-report .dc-print-cash-line {
            margin: 0 0 5px !important;
            padding: 0 !important;
            page-break-inside: avoid;
          }
          .day-close-report .dc-print-cash-line__row { font-size: 9.5pt !important; }
          .day-close-report .dc-print-cash-line__amount { font-size: 10.5pt !important; }
          .day-close-report .dc-print-cash-line__meta { font-size: 8pt !important; }
          .day-close-report .dc-print-cash-line__sub { font-size: 7.5pt !important; margin-top: 2px !important; }
        }
`;

export const DAY_CLOSE_PRINT_PREVIEW_IFRAME_FIX = `
        @media print {
          body > *:not(.nx-modal-backdrop) {
            display: revert !important;
          }
          .print-header,
          .print-footer,
          .day-close-preview-section {
            display: block !important;
            visibility: visible !important;
          }
        }
`;
