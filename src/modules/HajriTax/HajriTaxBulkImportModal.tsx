/**
 * استيراد جماعي لأقراص HAJRI TAX من Excel — صف واحد لكل شركة + سنة + ربع
 */
import React, { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal, Button, FileTrigger } from '../../ui';
import { exportToExcel, importFromExcel } from '../../utils/exportUtils';
import { disclosureFromBulkFlatRow, roundMoney2 } from '../../constants/taxDisclosure';
import { upsertVatPlanning, throwIfApiFailed } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { vatKeys } from '../../services/queryKeys';
import type {
  HajriTaxCompanyRef,
  HajriTaxLanguage,
  HajriTaxQuarter,
  HajriTaxTranslate,
} from '../../types/api/domains/hajriTax';

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
] as const;

type BulkImportRow = Record<string, unknown>;

type BulkFlatRowValues = {
  sales_amount: number;
  sales_vat: number;
  purchases_amount: number;
  purchases_vat: number;
  sales_adj: number;
  purchases_adj: number;
  prior_adjustments: number;
  balance_carried: number;
};

type HajriTaxBulkImportModalProps = {
  open: boolean;
  onClose: () => void;
  companies: HajriTaxCompanyRef[];
  lang: HajriTaxLanguage;
  t: HajriTaxTranslate;
  onImported: () => void;
};

function parseQuarter(val: unknown): HajriTaxQuarter | null {
  if (val === '' || val === null || val === undefined) return null;
  const n = Number(val);
  if (n === 1 || n === 2 || n === 3 || n === 4) return n;
  const s = String(val).trim().toUpperCase();
  const m = /^Q\s*([1-4])$/.exec(s);
  if (!m) return null;
  const parsed = Number(m[1]);
  return parsed === 1 || parsed === 2 || parsed === 3 || parsed === 4 ? parsed : null;
}

function num(row: BulkImportRow, key: keyof BulkFlatRowValues) {
  const v = row[key];
  if (v === '' || v === null || v === undefined) return 0;
  const x = parseFloat(String(v).replace(/,/g, '').trim());
  return Number.isFinite(x) ? x : 0;
}

function resolveCompanyId(companies: HajriTaxCompanyRef[], row: BulkImportRow) {
  const cid = String(row.company_id ?? row.companyId ?? '').trim();
  if (cid && companies.some((c) => c.id === cid)) return cid;

  const nameHint = String(row.company_name_ar ?? '').trim();
  if (!nameHint) return null;
  const normalizedHint = nameHint.toLowerCase();

  return (
    companies.find((c) => {
      const ar = (c.nameAr || '').trim();
      const en = (c.nameEn || '').trim().toLowerCase();
      return ar === nameHint || en === normalizedHint;
    })?.id ?? null
  );
}

function rowToVals(row: BulkImportRow): BulkFlatRowValues {
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

export default function HajriTaxBulkImportModal({ open, onClose, companies, lang, t, onImported }: HajriTaxBulkImportModalProps) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

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
    async (file: File | undefined) => {
      if (!file) return;
      setBusy(true);
      const errors: string[] = [];
      let ok = 0;

      try {
        const rows = (await importFromExcel(file, { headerRow: 0 })) as BulkImportRow[];
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

          if (!companyId || !Number.isFinite(year) || year < 2000 || quarter == null) {
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
            const message = e instanceof Error ? e.message : 'error';
            errors.push(`${t('hajriTaxBulkImportRow')} ${i + 2}: ${message}`);
          }
        }

        await qc.invalidateQueries({ queryKey: vatKeys.root() });
        onImported?.();

        if (ok > 0) {
          showToast(
            t('hajriTaxBulkImportDone', { ok: String(ok), errors: String(errors.length) }),
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
          <FileTrigger
            ref={fileRef}
            label={t('hajriTaxBulkImportChooseFile')}
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const f = e.target.files?.[0];
              void processFile(f);
            }}
            buttonProps={{ variant: 'primary', size: 'sm', loading: busy }}
          />
        </div>
      }
    >
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
