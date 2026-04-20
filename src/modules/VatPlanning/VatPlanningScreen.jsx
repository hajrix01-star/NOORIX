/**
 * سجل الضريبة التخطيطي — معزول عن المحاسبة؛ استيراد من تقرير الضريبة؛ حفظ لكل شركة وربع.
 */
import React, { useMemo, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useUpsertVatPlanning, useVatPlanningList } from '../../hooks/useVatPlanning';
import {
  OUTPUT_ROWS,
  INPUT_ROWS,
  SUMMARY_ROWS,
  defaultDisclosureData,
  mergeImportedDisclosure,
  computeNetPayable,
  computeOutputTotal,
  computeInputTotal,
  getRowValue,
  scaleInputVatForPaymentTarget,
} from '../../constants/taxDisclosure';
import { fmt } from '../../utils/format';
import { exportToExcel } from '../../utils/exportUtils';
import { openPrintWindow } from '../../utils/printUtils';
import { getTaxVatReport, throwIfApiFailed, upsertVatPlanning } from '../../services/api';
import { Button, Input, FmtNum } from '../../ui';

function clonePayload(from) {
  return mergeImportedDisclosure(defaultDisclosureData(), from || {});
}

export default function VatPlanningScreen() {
  const { companies } = useApp();
  const { t, lang } = useTranslation();
  const qc = useQueryClient();
  const jsonInputRef = useRef(null);

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [quarter, setQuarter] = useState(1);
  const [companyFilter, setCompanyFilter] = useState('');
  const [detailCompanyId, setDetailCompanyId] = useState(null);

  const [draftData, setDraftData] = useState(() => defaultDisclosureData());
  const [paymentTargetStr, setPaymentTargetStr] = useState('');
  const [notes, setNotes] = useState('');
  const [sourceSnapshot, setSourceSnapshot] = useState(null);
  const [importIso, setImportIso] = useState(null);
  const [saveHint, setSaveHint] = useState('');

  const periodStr = `Q${quarter}`;
  const periodLabel = `${year}-${periodStr}`;

  const { data: apiRecords = [], isLoading: listLoading, refetch } = useVatPlanningList(
    year,
    quarter,
    undefined,
    true,
  );

  const upsertMutation = useUpsertVatPlanning();

  const recordByCompany = useMemo(() => {
    const m = new Map();
    (apiRecords || []).forEach((r) => m.set(r.companyId, r));
    return m;
  }, [apiRecords]);

  const filteredCompanies = useMemo(() => {
    const base = Array.isArray(companies) ? companies : [];
    if (!companyFilter) return base;
    return base.filter((c) => c.id === companyFilter);
  }, [companies, companyFilter]);

  /** صفوف الجدول: كل الشركات المفلترة — حتى بدون سجل محفوظ (ربع بدون مبيعات) */
  const overviewRows = useMemo(() => {
    return filteredCompanies.map((c) => {
      const rec = resolveRecord(c.id);
      const payload = rec?.payload && typeof rec.payload === 'object' ? rec.payload : defaultDisclosureData();
      const net = computeNetPayable(payload);
      const pt = rec?.paymentTarget != null ? parseFloat(String(rec.paymentTarget)) : null;
      return {
        companyId: c.id,
        nameAr: c.nameAr,
        nameEn: c.nameEn,
        taxNumber: c.taxNumber || '',
        netPayable: net,
        paymentTarget: Number.isFinite(pt) ? pt : '',
        notes: rec?.notes || '',
        updatedAt: rec?.updatedAt || '',
      };
    });
  }, [filteredCompanies, resolveRecord]);

  const resolveRecord = useCallback(
    (companyId) => recordByCompany.get(companyId),
    [recordByCompany],
  );

  const openCompanyDetail = useCallback(
    (companyId) => {
      const rec = resolveRecord(companyId);
      const payload = rec?.payload && typeof rec.payload === 'object' ? rec.payload : {};
      setDraftData(clonePayload(payload));
      setPaymentTargetStr(rec?.paymentTarget != null ? String(rec.paymentTarget) : '');
      setNotes(rec?.notes || '');
      setSourceSnapshot(rec?.sourceSnapshot ?? null);
      setImportIso(rec?.importedAt || null);
      setDetailCompanyId(companyId);
      setSaveHint('');
    },
    [resolveRecord],
  );

  const closeDetail = useCallback(() => {
    setDetailCompanyId(null);
    refetch();
  }, [refetch]);

  const updateRow = useCallback((key, field, value) => {
    const num = parseFloat(String(value).replace(/,/g, '')) || 0;
    setDraftData((prev) => {
      const next = { ...prev };
      const isSummaryField = !field || SUMMARY_ROWS.some((r) => r.key === key);
      if (isSummaryField) next[key] = num;
      else next[key] = { ...(next[key] || { amount: 0, adjustment: 0, vat: 0 }), [field]: num };
      return next;
    });
  }, []);

  const renderEditableCell = useCallback(
    (key, field) => (
      <Input
        type="text"
        inputMode="decimal"
        value={getRowValue(draftData, key, field) || ''}
        onChange={(e) => updateRow(key, field, e.target.value)}
        placeholder="0"
      />
    ),
    [draftData, updateRow],
  );

  const outputTotal = useMemo(() => computeOutputTotal(draftData), [draftData]);
  const inputTotal = useMemo(() => computeInputTotal(draftData), [draftData]);
  const netPayableDraft = useMemo(() => computeNetPayable(draftData), [draftData]);
  const priorAdj = getRowValue(draftData, 'prior_adjustments');
  const balanceCarried = getRowValue(draftData, 'balance_carried');
  const netVat = outputTotal - inputTotal;

  const handleImportFromTaxReport = useCallback(async () => {
    if (!detailCompanyId) return;
    const res = await getTaxVatReport(detailCompanyId, year, periodStr);
    throwIfApiFailed(res, 'فشل استيراد تقرير الضريبة');
    const imported = res.data;
    setDraftData((prev) => mergeImportedDisclosure(prev, imported));
    setSourceSnapshot(imported && typeof imported === 'object' ? { ...imported } : imported);
    setImportIso(new Date().toISOString());
  }, [detailCompanyId, year, periodStr]);

  const handleBalancePayment = useCallback(() => {
    const target = parseFloat(String(paymentTargetStr).replace(/,/g, ''));
    if (!Number.isFinite(target)) return;
    setDraftData((prev) => scaleInputVatForPaymentTarget(prev, target));
  }, [paymentTargetStr]);

  const handleSaveDetail = useCallback(async () => {
    if (!detailCompanyId) return;
    const pt = parseFloat(String(paymentTargetStr).replace(/,/g, ''));
    const body = {
      companyId: detailCompanyId,
      year,
      quarter,
      payload: draftData,
      sourceSnapshot: sourceSnapshot ?? undefined,
      paymentTarget: Number.isFinite(pt) ? pt : null,
      notes: notes.trim() || null,
      importedAt: importIso || undefined,
    };
    await upsertMutation.mutateAsync(body);
    setSaveHint(t('vatSavedOk'));
  }, [detailCompanyId, year, quarter, draftData, sourceSnapshot, paymentTargetStr, notes, importIso, upsertMutation, t]);

  const companyMeta = useCallback(
    (id) => {
      const c = companies?.find((x) => x.id === id);
      if (!c) return { name: id, tax: '' };
      const name = lang === 'en' ? (c.nameEn || c.nameAr || '') : (c.nameAr || c.nameEn || '');
      return { name, tax: c.taxNumber || '' };
    },
    [companies, lang],
  );

  const printDetail = useCallback(() => {
    const { name } = companyMeta(detailCompanyId);
    const label = (r) => (lang === 'ar' ? r.labelAr : r.labelEn);
    const outRows = OUTPUT_ROWS.map((r) => {
      const amt = r.isTotal ? outputTotal : getRowValue(draftData, r.key, 'amount');
      const vat = r.isTotal ? outputTotal : getRowValue(draftData, r.key, 'vat');
      return `<tr><td>${(label(r) || '').replace(/</g, '&lt;')}</td><td>${fmt(amt)}</td><td>${r.isTotal ? '—' : fmt(getRowValue(draftData, r.key, 'adjustment'))}</td><td>${fmt(vat)}</td></tr>`;
    }).join('');
    const inRows = INPUT_ROWS.map((r) => {
      const amt = r.isTotal ? inputTotal : getRowValue(draftData, r.key, 'amount');
      const vat = r.isTotal ? inputTotal : getRowValue(draftData, r.key, 'vat');
      return `<tr><td>${(label(r) || '').replace(/</g, '&lt;')}</td><td>${fmt(amt)}</td><td>${r.isTotal ? '—' : fmt(getRowValue(draftData, r.key, 'adjustment'))}</td><td>${fmt(vat)}</td></tr>`;
    }).join('');
    openPrintWindow({
      title: t('reportVatRegistry'),
      companyName: name || '',
      subtitle: `${periodLabel} — ${lang === 'ar' ? 'تخطيط ضريبي (لا يؤثر على المحاسبة)' : 'Planning only (no accounting impact)'}`,
      body: `<p>${lang === 'ar' ? 'مبلغ الدفع المستهدف:' : 'Target payment:'} ${fmt(parseFloat(paymentTargetStr) || 0)} SR</p>
<table><thead><tr><th>${t('reportItem')}</th><th>SR</th><th>${lang === 'ar' ? 'تعديل' : 'Adj.'}</th><th>VAT</th></tr></thead>
<tbody><tr><td colspan="4" style="background:#f0fdf4;font-weight:700">${lang === 'ar' ? 'مخرجات' : 'Output'}</td></tr>${outRows}
<tr><td colspan="4" style="background:#fef2f2;font-weight:700">${lang === 'ar' ? 'مدخلات' : 'Input'}</td></tr>${inRows}</tbody></table>
<p><b>${lang === 'ar' ? 'صافي مستحق' : 'Net payable'}:</b> ${fmt(netPayableDraft)} SR</p>`,
    });
  }, [detailCompanyId, companyMeta, lang, draftData, outputTotal, inputTotal, netPayableDraft, paymentTargetStr, periodLabel, t]);

  const exportDetailExcel = useCallback(() => {
    const rows = [];
    const label = (r) => (lang === 'ar' ? r.labelAr : r.labelEn);
    OUTPUT_ROWS.forEach((r) => {
      if (!r.isTotal) rows.push({ Item: label(r), Amount: getRowValue(draftData, r.key, 'amount'), VAT: getRowValue(draftData, r.key, 'vat') });
    });
    INPUT_ROWS.forEach((r) => {
      if (!r.isTotal) rows.push({ Item: label(r), Amount: getRowValue(draftData, r.key, 'amount'), VAT: getRowValue(draftData, r.key, 'vat') });
    });
    rows.push({ Item: lang === 'ar' ? 'صافي مستحق' : 'Net payable', Amount: '', VAT: netPayableDraft });
    exportToExcel(rows, `vat-registry-${detailCompanyId}-${periodLabel}.xlsx`);
  }, [draftData, lang, detailCompanyId, netPayableDraft, periodLabel]);

  const exportConsolidatedExcel = useCallback(() => {
    const rows = overviewRows.map((r) => ({
      [lang === 'ar' ? 'الشركة' : 'Company']: lang === 'en' ? (r.nameEn || r.nameAr) : r.nameAr,
      [lang === 'ar' ? 'الرقم الضريبي' : 'Tax No.']: r.taxNumber,
      [t('vatNetPayable')]: r.netPayable,
      [t('vatPaymentTarget')]: r.paymentTarget === '' ? '' : r.paymentTarget,
      [t('vatNotes')]: r.notes,
      [t('vatLastUpdated')]: r.updatedAt ? String(r.updatedAt).slice(0, 19) : '—',
    }));
    exportToExcel(rows, `vat-registry-consolidated-${periodLabel}.xlsx`);
  }, [overviewRows, lang, t, periodLabel]);

  const printConsolidated = useCallback(() => {
    const bodyRows = overviewRows
      .map((r) => {
        const nm = lang === 'en' ? (r.nameEn || r.nameAr) : r.nameAr;
        return `<tr><td>${(nm || '').replace(/</g, '&lt;')}</td><td>${fmt(r.netPayable)}</td><td>${r.paymentTarget === '' ? '—' : fmt(r.paymentTarget)}</td><td>${(r.notes || '').replace(/</g, '&lt;')}</td></tr>`;
      })
      .join('');
    openPrintWindow({
      title: lang === 'ar' ? 'تقرير ضريبي شامل (تخطيط)' : 'Consolidated VAT planning',
      companyName: '',
      subtitle: periodLabel,
      body: `<table class="w-full"><thead><tr><th>${lang === 'ar' ? 'الشركة' : 'Company'}</th><th>${t('vatNetPayable')}</th><th>${t('vatPaymentTarget')}</th><th>${t('vatNotes')}</th></tr></thead><tbody>${bodyRows}</tbody></table>`,
    });
  }, [overviewRows, lang, periodLabel, t]);

  const exportJsonBundle = useCallback(() => {
    const records = filteredCompanies.map((c) => {
      const rec = resolveRecord(c.id);
      return {
        companyId: c.id,
        payload: rec?.payload && typeof rec.payload === 'object' ? rec.payload : defaultDisclosureData(),
        paymentTarget: rec?.paymentTarget ?? null,
        notes: rec?.notes ?? null,
        sourceSnapshot: rec?.sourceSnapshot ?? null,
      };
    });
    const blob = new Blob(
      [JSON.stringify({ version: 1, year, quarter, exportedAt: new Date().toISOString(), records }, null, 2)],
      { type: 'application/json' },
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vat-registry-${periodLabel}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [filteredCompanies, resolveRecord, year, quarter, periodLabel]);

  const onJsonImport = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      let parsed;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        return;
      }
      const list = Array.isArray(parsed?.records) ? parsed.records : Array.isArray(parsed) ? parsed : [];
      const y = parsed.year ?? year;
      const q = parsed.quarter ?? quarter;
      for (const item of list) {
        if (!item?.companyId) continue;
        const res = await upsertVatPlanning({
          companyId: item.companyId,
          year: y,
          quarter: q,
          payload: item.payload || defaultDisclosureData(),
          paymentTarget: item.paymentTarget ?? null,
          notes: item.notes ?? null,
          sourceSnapshot: item.sourceSnapshot ?? undefined,
        });
        throwIfApiFailed(res, 'فشل استيراد سجل');
      }
      qc.invalidateQueries({ queryKey: ['vat-planning'] });
      refetch();
    },
    [year, quarter, qc, refetch],
  );

  if (!companies?.length) {
    return (
      <div className="noorix-surface-card p-5 text-center text-noorix-muted">
        {t('pleaseSelectCompany')}
      </div>
    );
  }

  if (detailCompanyId) {
    const { name, tax } = companyMeta(detailCompanyId);
    return (
      <div className="grid gap-6">
        <div className="nx-page-header flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-bold m-0">{t('reportVatRegistry')}</h2>
            <p className="mt-1.5 text-[13px] text-noorix-muted">{t('reportVatRegistryDesc')}</p>
            <p className="mt-1 text-[12px] font-semibold text-noorix-blue">{name}{tax ? ` · ${tax}` : ''}</p>
          </div>
          <div className="nx-toolbar flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={closeDetail}>{t('vatBackToList')}</Button>
            <Button size="sm" onClick={handleImportFromTaxReport}>{t('vatImportFromTaxReport')}</Button>
            <Button size="sm" onClick={handleSaveDetail} disabled={upsertMutation.isPending}>{t('save')}</Button>
            <Button size="sm" onClick={printDetail}>{t('print')}</Button>
            <Button size="sm" onClick={exportDetailExcel}>{t('exportExcel')}</Button>
          </div>
        </div>
        {saveHint ? <div className="text-[13px] text-noorix-green font-medium">{saveHint}</div> : null}

        <div className="noorix-surface-card p-4 grid gap-4 md:grid-cols-2">
          <Input
            type="text"
            label={t('vatPaymentTarget')}
            inputMode="decimal"
            value={paymentTargetStr}
            onChange={(e) => setPaymentTargetStr(e.target.value)}
            placeholder="0"
          />
          <div className="flex items-end gap-2">
            <Button size="sm" onClick={handleBalancePayment}>{t('vatBalanceInputs')}</Button>
          </div>
          <Input
            multiline
            rows={2}
            label={t('vatNotes')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {sourceSnapshot ? (
          <details className="noorix-surface-card p-4 text-[13px]">
            <summary className="cursor-pointer font-bold">{t('vatReferenceSnapshot')}</summary>
            <pre className="mt-2 overflow-x-auto text-[12px] whitespace-pre-wrap">{JSON.stringify(sourceSnapshot, null, 2)}</pre>
          </details>
        ) : null}

        <div className="noorix-surface-card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] table-fixed border-collapse text-[14px]">
              <thead>
                <tr>
                  <th className="text-end border-b border-noorix-border font-bold py-[10px] px-3 bg-[var(--noorix-table-header-bg)] w-[28%]">{t('reportItem')}</th>
                  <th className="text-end border-b nx-font-numbers font-bold py-[10px] px-3 bg-[var(--noorix-table-header-bg)]">SR</th>
                  <th className="text-center border-b font-bold py-[10px] px-3 bg-[var(--noorix-table-header-bg)]">{lang === 'ar' ? 'تعديل' : 'Adj.'}</th>
                  <th className="text-end border-b nx-font-numbers font-bold py-[10px] px-3 bg-[var(--noorix-table-header-bg)]">VAT</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4} className="font-bold text-noorix-green py-[10px] px-3 bg-[var(--noorix-green-6)]">
                    {lang === 'ar' ? 'مخرجات (مبيعات)' : 'Output (sales)'}
                  </td>
                </tr>
                {OUTPUT_ROWS.map((r) => (
                  <tr key={r.key} style={{ background: r.isTotal ? 'var(--noorix-navy-4)' : undefined }}>
                    <td className="border-b border-noorix-border py-[10px] px-3 truncate" title={lang === 'ar' ? r.labelAr : r.labelEn}>
                      {lang === 'ar' ? r.labelAr : r.labelEn}
                    </td>
                    <td className="text-end border-b border-noorix-border py-2 px-3 nx-font-numbers">
                      {r.isTotal ? fmt(outputTotal) : renderEditableCell(r.key, 'amount')}
                    </td>
                    <td className="text-center border-b border-noorix-border py-2 px-3">
                      {r.isTotal ? '—' : renderEditableCell(r.key, 'adjustment')}
                    </td>
                    <td className="text-end border-b nx-font-numbers py-2 px-3">
                      {r.isTotal ? fmt(outputTotal) : renderEditableCell(r.key, 'vat')}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={4} className="font-bold text-noorix-red py-[10px] px-3 bg-[var(--noorix-red-6)]">
                    {lang === 'ar' ? 'مدخلات (مشتريات ومصاريف بضريبة)' : 'Input (taxable purchases/expenses)'}
                  </td>
                </tr>
                {INPUT_ROWS.map((r) => (
                  <tr key={r.key} style={{ background: r.isTotal ? 'var(--noorix-navy-4)' : undefined }}>
                    <td className="border-b border-noorix-border py-[10px] px-3 truncate" title={lang === 'ar' ? r.labelAr : r.labelEn}>
                      {lang === 'ar' ? r.labelAr : r.labelEn}
                    </td>
                    <td className="text-end border-b nx-font-numbers py-2 px-3">
                      {r.isTotal ? fmt(inputTotal) : renderEditableCell(r.key, 'amount')}
                    </td>
                    <td className="text-center border-b border-noorix-border py-2 px-3">
                      {r.isTotal ? '—' : renderEditableCell(r.key, 'adjustment')}
                    </td>
                    <td className="text-end border-b nx-font-numbers py-2 px-3">
                      {r.isTotal ? fmt(inputTotal) : renderEditableCell(r.key, 'vat')}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={4} className="font-bold py-[10px] px-3 bg-[var(--noorix-blue-6)]">{lang === 'ar' ? 'الملخص' : 'Summary'}</td>
                </tr>
                <tr>
                  <td className="border-b py-[10px] px-3">{lang === 'ar' ? 'صافي الضريبة' : 'Net VAT'}</td>
                  <td colSpan={3} className="border-b text-end nx-font-numbers font-bold py-[10px] px-3"><FmtNum n={netVat} /></td>
                </tr>
                <tr>
                  <td className="border-b py-[10px] px-3">{lang === 'ar' ? 'تصحيحات سابقة' : 'Prior adjustments'}</td>
                  <td colSpan={3} className="border-b text-center py-2 px-3">
                    <Input type="text" inputMode="decimal" value={priorAdj || ''} onChange={(e) => updateRow('prior_adjustments', null, e.target.value)} placeholder="0" />
                  </td>
                </tr>
                <tr>
                  <td className="border-b py-[10px] px-3">{lang === 'ar' ? 'رصيد مرحّل' : 'Balance carried'}</td>
                  <td colSpan={3} className="border-b text-center py-2 px-3">
                    <Input type="text" inputMode="decimal" value={balanceCarried || ''} onChange={(e) => updateRow('balance_carried', null, e.target.value)} placeholder="0" />
                  </td>
                </tr>
                <tr className="bg-[var(--noorix-blue-8)] border-t-2 border-noorix-blue">
                  <td className="font-extrabold p-3">{lang === 'ar' ? 'صافي مستحق / مسترد' : 'Net payable / refundable'}</td>
                  <td colSpan={3} className="text-end nx-font-numbers font-extrabold p-3">
                    <FmtNum n={netPayableDraft} /> <span className="nx-sar">SR</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="nx-page-header">
        <div>
          <h2 className="text-[18px] font-bold m-0">{t('reportVatRegistry')}</h2>
          <p className="mt-1.5 text-[13px] text-noorix-muted">{t('reportVatRegistryDesc')}</p>
        </div>
        <div className="nx-toolbar flex flex-wrap gap-2 items-end">
          <Input type="select" label={t('reportYear')} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Input>
          <Input type="select" label={t('vatQuarter')} value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}>
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={q}>{lang === 'ar' ? `الربع ${q}` : `Q${q}`}</option>
            ))}
          </Input>
          <Input type="select" label={t('vatFilterCompany')} value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
            <option value="">{t('vatAllCompanies')}</option>
            {(companies || []).map((c) => (
              <option key={c.id} value={c.id}>{lang === 'en' ? (c.nameEn || c.nameAr) : c.nameAr}</option>
            ))}
          </Input>
          <Button size="sm" onClick={exportConsolidatedExcel}>{t('vatConsolidatedExport')}</Button>
          <Button size="sm" onClick={printConsolidated}>{t('vatConsolidatedPrint')}</Button>
          <Button size="sm" onClick={exportJsonBundle}>{t('vatJsonExport')}</Button>
          <Button size="sm" onClick={() => jsonInputRef.current?.click()}>{t('vatJsonImport')}</Button>
          <input ref={jsonInputRef} type="file" accept=".json,application/json" className="hidden" onChange={onJsonImport} />
        </div>
      </div>

      {listLoading ? (
        <div className="text-noorix-muted text-[14px]">{t('loading')}</div>
      ) : (
        <div className="noorix-surface-card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] table-fixed border-collapse text-[14px]">
              <thead>
                <tr>
                  <th className="text-end border-b border-noorix-border font-bold py-[10px] px-3 bg-[var(--noorix-table-header-bg)]">{lang === 'ar' ? 'الشركة' : 'Company'}</th>
                  <th className="text-end border-b nx-font-numbers font-bold py-[10px] px-3 bg-[var(--noorix-table-header-bg)]">{t('vatNetPayable')}</th>
                  <th className="text-end border-b nx-font-numbers font-bold py-[10px] px-3 bg-[var(--noorix-table-header-bg)]">{t('vatPaymentTarget')}</th>
                  <th className="text-end border-b font-bold py-[10px] px-3 bg-[var(--noorix-table-header-bg)]">{t('vatNotes')}</th>
                  <th className="text-end border-b font-bold py-[10px] px-3 bg-[var(--noorix-table-header-bg)]">{t('vatLastUpdated')}</th>
                  <th className="text-end border-b font-bold py-[10px] px-3 bg-[var(--noorix-table-header-bg)] sticky right-0 bg-[var(--noorix-table-header-bg)]">{lang === 'ar' ? 'إجراء' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {overviewRows.map((row) => {
                  const nm = lang === 'en' ? (row.nameEn || row.nameAr) : row.nameAr;
                  return (
                    <tr key={row.companyId}>
                      <td className="border-b border-noorix-border py-[10px] px-3 truncate" title={nm}>{nm}</td>
                      <td className="border-b nx-font-numbers py-[10px] px-3 text-end">{fmt(row.netPayable)}</td>
                      <td className="border-b nx-font-numbers py-[10px] px-3 text-end">{row.paymentTarget === '' ? '—' : fmt(row.paymentTarget)}</td>
                      <td className="border-b py-[10px] px-3 truncate text-end" title={row.notes}>{row.notes || '—'}</td>
                      <td className="border-b nx-font-numbers py-[10px] px-3 text-end text-[12px]">{row.updatedAt ? String(row.updatedAt).slice(0, 19) : '—'}</td>
                      <td className="border-b py-[10px] px-3 text-end sticky right-0 bg-noorix-surface">
                        <Button size="sm" onClick={() => openCompanyDetail(row.companyId)}>{t('vatEditQuarter')}</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
