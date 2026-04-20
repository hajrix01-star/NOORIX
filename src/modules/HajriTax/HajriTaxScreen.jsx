/**
 * HAJRI TAX — سجل ضريبي تخطيطي معزول عن المحاسبة (قسم رئيسي مستقل).
 */
import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { Button, Input } from '../../ui';
import HajriTaxDetailEditor from './HajriTaxDetailEditor';

function clonePayload(from) {
  return mergeImportedDisclosure(defaultDisclosureData(), from || {});
}

export default function HajriTaxScreen() {
  const { companies } = useApp();
  const { t, lang } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();
  const jsonInputRef = useRef(null);
  const urlOpenKeyRef = useRef('');

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(() => {
    const y = Number(searchParams.get('year'));
    return Number.isFinite(y) && y >= 2000 ? y : currentYear;
  });
  const [quarter, setQuarter] = useState(() => {
    const q = Number(searchParams.get('quarter'));
    return [1, 2, 3, 4].includes(q) ? q : 1;
  });
  const [companyFilter, setCompanyFilter] = useState(() => searchParams.get('company') || '');
  const [detailCompanyId, setDetailCompanyId] = useState(null);

  const [draftData, setDraftData] = useState(() => defaultDisclosureData());
  const [paymentTargetStr, setPaymentTargetStr] = useState('');
  const [notes, setNotes] = useState('');
  const [sourceSnapshot, setSourceSnapshot] = useState(null);
  const [importIso, setImportIso] = useState(null);
  const [saveHint, setSaveHint] = useState('');
  const [showSimulator, setShowSimulator] = useState(true);
  const [importingReport, setImportingReport] = useState(false);
  /** استيراد مبيعات بدون ضريبة مسجّلة: إذا كان صافي الفاتورة إجماليًا شاملاً 15% وليس أساسًا خاضعًا */
  const [salesAmountIncludesVat, setSalesAmountIncludesVat] = useState(false);

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

  const resolveRecord = useCallback(
    (companyId) => recordByCompany.get(companyId),
    [recordByCompany],
  );

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
    setSearchParams((sp) => {
      const next = new URLSearchParams(sp);
      next.delete('edit');
      return next;
    });
  }, [refetch, setSearchParams]);

  useEffect(() => {
    if (listLoading) return;
    if (searchParams.get('edit') !== '1') {
      urlOpenKeyRef.current = '';
      return;
    }
    const c = searchParams.get('company');
    if (!c || !companies?.some((x) => x.id === c)) return;
    const key = `${c}|${searchParams.get('year')}|${searchParams.get('quarter')}|1`;
    if (urlOpenKeyRef.current === key) return;
    urlOpenKeyRef.current = key;
    openCompanyDetail(c);
  }, [listLoading, searchParams, companies, openCompanyDetail]);

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

  const paymentTargetParsed = useMemo(() => {
    const p = parseFloat(String(paymentTargetStr).replace(/,/g, ''));
    return Number.isFinite(p) ? p : NaN;
  }, [paymentTargetStr]);

  /** ضريبة المدخلات النظرية المطلوبة إذا كان صافي السداد = المبلغ المستهدف (بافتراض ثابت التعديلات) */
  const simulatorRequiredInputVat = useMemo(() => {
    if (!Number.isFinite(paymentTargetParsed)) return null;
    return outputTotal + priorAdj + balanceCarried - paymentTargetParsed;
  }, [outputTotal, priorAdj, balanceCarried, paymentTargetParsed]);

  const simulatorEstimatedBaseAt15 = useMemo(() => {
    if (simulatorRequiredInputVat == null || simulatorRequiredInputVat <= 0) return null;
    return +(simulatorRequiredInputVat / 0.15).toFixed(2);
  }, [simulatorRequiredInputVat]);

  const handleImportFromTaxReport = useCallback(async () => {
    if (!detailCompanyId) return;
    setImportingReport(true);
    try {
      const res = await getTaxVatReport(detailCompanyId, year, periodStr, {
        salesAmountIncludesVat,
      });
      throwIfApiFailed(res, 'فشل استيراد تقرير الضريبة');
      const imported = res.data;
      setDraftData((prev) => mergeImportedDisclosure(prev, imported));
      setSourceSnapshot(imported && typeof imported === 'object' ? { ...imported } : imported);
      setImportIso(new Date().toISOString());
    } finally {
      setImportingReport(false);
    }
  }, [detailCompanyId, year, periodStr, salesAmountIncludesVat]);

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
      title: t('hajriTax'),
      companyName: name || '',
      subtitle: `${periodLabel} — ${lang === 'ar' ? 'تخطيط ضريبي (لا يؤثر على المحاسبة)' : 'Planning only (no accounting impact)'}`,
      body: `<p>${lang === 'ar' ? 'مبلغ الدفع المستهدف:' : 'Target payment:'} ${fmt(parseFloat(paymentTargetStr) || 0)} SR</p>
<table><thead><tr><th>${t('reportItem')}</th><th>SR</th><th>${lang === 'ar' ? 'تعديل' : 'Adj.'}</th><th>VAT</th></tr></thead>
<tbody><tr><td colspan="4" style="background:#f0fdf4;font-weight:700">${lang === 'ar' ? 'مخرجات ضريبة القيمة المضافة (المبيعات)' : 'Output VAT (sales)'}</td></tr>${outRows}
<tr><td colspan="4" style="background:#fef2f2;font-weight:700">${lang === 'ar' ? 'ضريبة المشتريات والمصروفات (ما سُجّلت ضريبته فقط)' : 'Purchases & expenses VAT (tax lines only)'}</td></tr>${inRows}</tbody></table>
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
    exportToExcel(rows, `hajri-tax-${detailCompanyId}-${periodLabel}.xlsx`);
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
    exportToExcel(rows, `hajri-tax-consolidated-${periodLabel}.xlsx`);
  }, [overviewRows, lang, t, periodLabel]);

  const printConsolidated = useCallback(() => {
    const bodyRows = overviewRows
      .map((r) => {
        const nm = lang === 'en' ? (r.nameEn || r.nameAr) : r.nameAr;
        return `<tr><td>${(nm || '').replace(/</g, '&lt;')}</td><td>${fmt(r.netPayable)}</td><td>${r.paymentTarget === '' ? '—' : fmt(r.paymentTarget)}</td><td>${(r.notes || '').replace(/</g, '&lt;')}</td></tr>`;
      })
      .join('');
    openPrintWindow({
      title: `${t('hajriTax')} — ${lang === 'ar' ? 'تقرير شامل' : 'Consolidated'}`,
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
    a.download = `hajri-tax-${periodLabel}.json`;
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
      <HajriTaxDetailEditor
        t={t}
        lang={lang}
        periodLabel={periodLabel}
        companyName={name}
        taxNumber={tax}
        closeDetail={closeDetail}
        handleImportFromTaxReport={handleImportFromTaxReport}
        importingReport={importingReport}
        handleSaveDetail={handleSaveDetail}
        savePending={upsertMutation.isPending}
        printDetail={printDetail}
        exportDetailExcel={exportDetailExcel}
        saveHint={saveHint}
        outputTotal={outputTotal}
        inputTotal={inputTotal}
        netPayableDraft={netPayableDraft}
        netVat={netVat}
        priorAdj={priorAdj}
        balanceCarried={balanceCarried}
        paymentTargetStr={paymentTargetStr}
        setPaymentTargetStr={setPaymentTargetStr}
        notes={notes}
        setNotes={setNotes}
        sourceSnapshot={sourceSnapshot}
        showSimulator={showSimulator}
        setShowSimulator={setShowSimulator}
        handleBalancePayment={handleBalancePayment}
        simulatorRequiredInputVat={simulatorRequiredInputVat}
        simulatorEstimatedBaseAt15={simulatorEstimatedBaseAt15}
        paymentTargetParsed={paymentTargetParsed}
        renderEditableCell={renderEditableCell}
        updateRow={updateRow}
        salesAmountIncludesVat={salesAmountIncludesVat}
        setSalesAmountIncludesVat={setSalesAmountIncludesVat}
      />
    );
  }

  return (
    <div className="grid gap-6">
      <div className="nx-page-header flex flex-wrap justify-end gap-4">
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
