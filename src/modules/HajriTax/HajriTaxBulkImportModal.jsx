/**
 * استيراد جماعي لأقراص HAJRI TAX من Excel — صف واحد لكل شركة + سنة + ربع
 */
import React, { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal, Button } from '../../ui';
import { exportToExcel, importFromExcel } from '../../utils/exportUtils';
import { disclosureFromBulkFlatRow, roundMoney2 } from '../../constants/taxDisclosure';
import { upsertVatPlanning, throwIfApiFailed } from '../../services/api';
import { useToast } from '../../context/ToastContext';

/** رؤوس القالب — المفتاح ثابت للقراءة من الملف المُصدَّر من نفس القالب */
export const HAJRI_BULK_TEMPLATE_COLUMNS = [
  { key: 'company_id', label: 'company_id' },
  { key: 'company_name_ar', label: 'company_name_ar' },
  { key: 'year', label: 'year' },
  { key: 'quarter', label: 'quarter' },
  { key: 'sales_amount', label: 'sales_amount' },
  { key: 'sales_vat', label: 'sales_vat' },
  { key: 'purchases_amount', label: 'purchases_amount' },
  { key: 'purchases_vat', label: 'purchases_vat' },
  { key: 'sales_adj', label: 'sales_adj' },
  { key: 'purchases_adj', label: 'purchases_adj' },
  { key: 'prior_adjustments', label: 'prior_adjustments' },
  { key: 'balance_carried', label: 'balance_carried' },
  { key: 'payment_target', label: 'payment_target' },
  { key: 'notes', label: 'notes' },
];

function parseQuarter(val) {
  if (val === '' || val === null || val === undefined) return NaN;
  const n = Number(val);
  if ([1, 2, 3, 4].includes(n)) return n;
  const s = String(val).trim().toUpperCase();
  const m = /^Q\s*([1-4])$/.exec(s);
  return m ? Number(m[1]) : NaN;
}

function num(row, key) {
  const v = row[key];
  if (v === '' || v === null || v === undefined) return 0;
  const x = parseFloat(String(v).replace(/,/g, '').trim());
  return Number.isFinite(x) ? x : 0;
}

function resolveCompanyId(companies, row) {
  const cid = String(row.company_id ?? row.companyId ?? '').trim();
  if (cid && companies.some((c) => c.id === cid)) return cid;

  const nameHint = String(row.company_name_ar ?? '').trim();
  if (!nameHint) return null;

  return (
    companies.find((c) => {
      const ar = (c.nameAr || '').trim();
      const en = (c.nameEn || '').trim().toLowerCase();
      const h = nameHint.toLowerCase();
      return ar === nameHint || ar.includes(nameHint) || en.includes(h);
    })?.id ?? null
  );
}

function rowToVals(row) {
  return {
    sales_amount: num(row, 'sales_amount'),
    sales_vat: num(row, 'sales_vat'),
    purchases_amount: num(row, 'purchases_amount'),
    purchases_vat: num(row, 'purchases_vat'),
    sales_adj: num(row, 'sales_adj'),
    purchases_adj: num(row, 'purchases_adj'),
    prior_adjustments: num(row, 'prior_adjustments'),
    balance_carried: num(row, 'balance_carried'),
  };
}

export default function HajriTaxBulkImportModal({ open, onClose, companies, lang, t, onImported }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const fileRef = React.useRef(null);

  const downloadTemplate = useCallback(async () => {
    const y = new Date().getFullYear();
    await exportToExcel({
      data: [
        {
          company_id: '',
          company_name_ar: '',
          year: y,
          quarter: 1,
          sales_amount: 0,
          sales_vat: 0,
          purchases_amount: 0,
          purchases_vat: 0,
          sales_adj: 0,
          purchases_adj: 0,
          prior_adjustments: 0,
          balance_carried: 0,
          payment_target: '',
          notes: '',
        },
      ],
      filename: 'hajri-tax-bulk-import-template.xlsx',
      title: t('hajriTaxBulkImportTemplateTitle'),
      sheetName: 'import',
      rtl: lang !== 'en',
      columns: HAJRI_BULK_TEMPLATE_COLUMNS,
    });
  }, [lang, t]);

  const processFile = useCallback(
    async (file) => {
      if (!file) return;
      setBusy(true);
      const errors = [];
      let ok = 0;

      try {
        const rows = await importFromExcel(file, { headerRow: 0 });
        if (!rows?.length) {
          showToast(t('hajriTaxBulkImportEmpty'), 'error');
          return;
        }

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const companyId = resolveCompanyId(companies || [], row);
          const year = Math.round(Number(row.year));
          const quarter = parseQuarter(row.quarter);

          const hasDigits =
            num(row, 'sales_amount') ||
            num(row, 'sales_vat') ||
            num(row, 'purchases_amount') ||
            num(row, 'purchases_vat');

          if (!companyId || !Number.isFinite(year) || year < 2000 || !Number.isFinite(quarter)) {
            if (hasDigits || String(row.company_name_ar || '').trim()) {
              errors.push(`${t('hajriTaxBulkImportRow')} ${i + 2}: ${t('hajriTaxBulkImportSkipBadMeta')}`);
            }
            continue;
          }

          const vals = rowToVals(row);
          const payload = disclosureFromBulkFlatRow(vals);
          const ptRaw = row.payment_target;
          const pt =
            ptRaw === '' || ptRaw === null || ptRaw === undefined
              ? roundMoney2(vals.sales_vat - vals.purchases_vat + vals.prior_adjustments + vals.balance_carried)
              : roundMoney2(parseFloat(String(ptRaw).replace(/,/g, '')));

          const res = await upsertVatPlanning({
            companyId,
            year,
            quarter,
            payload,
            paymentTarget: Number.isFinite(pt) ? pt : null,
            notes: String(row.notes ?? '').trim() || null,
            sourceSnapshot: { source: 'bulk-excel-import', importedAt: new Date().toISOString() },
          });

          try {
            throwIfApiFailed(res, 'upsert');
            ok += 1;
          } catch (e) {
            errors.push(`${t('hajriTaxBulkImportRow')} ${i + 2}: ${e?.message || 'error'}`);
          }
        }

        await qc.invalidateQueries({ queryKey: ['vat-planning'] });
        onImported?.();

        if (ok > 0) {
          showToast(
            t('hajriTaxBulkImportDone', { ok, errors: String(errors.length) }),
            'success',
          );
        }
        if (errors.length) {
          showToast(errors.slice(0, 4).join('\n'), 'error');
        }
        if (ok === 0 && errors.length === 0) {
          showToast(t('hajriTaxBulkImportEmpty'), 'error');
        }

        if (ok > 0) onClose();
      } finally {
        setBusy(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    },
    [companies, qc, onImported, onClose, showToast, t],
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('hajriTaxBulkImportTitle')}
      size="lg"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={busy}
            onClick={() => fileRef.current?.click()}
          >
            {t('hajriTaxBulkImportChooseFile')}
          </Button>
        </div>
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          void processFile(f);
        }}
      />

      <div className="grid gap-4 text-start">
        <p className="m-0 text-[13px] leading-relaxed text-noorix-muted">{t('hajriTaxBulkImportIntro')}</p>

        <div className="rounded-lg border border-noorix-border bg-[var(--noorix-blue-6)] p-3 text-[12px] leading-snug text-noorix-text">
          <div className="font-semibold text-noorix-blue mb-1">{t('hajriTaxBulkImportColumnsHint')}</div>
          <ul className="m-0 grid list-disc gap-1 ps-4">
            <li>{t('hajriTaxBulkImportRuleCompany')}</li>
            <li>{t('hajriTaxBulkImportRuleQuarter')}</li>
            <li>{t('hajriTaxBulkImportRuleDecimals')}</li>
          </ul>
        </div>

        <Button type="button" variant="ghost" size="sm" className="justify-center" onClick={() => void downloadTemplate()}>
          {t('hajriTaxBulkDownloadTemplate')}
        </Button>
      </div>
    </Modal>
  );
}
