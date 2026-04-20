/**
 * HAJRI TAX — سجل ضريبي تخطيطي معزول عن المحاسبة (قسم رئيسي مستقل).
 */
import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useUpsertVatPlanning, useVatPlanningList, useVatPlanningRegistry } from '../../hooks/useVatPlanning';
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
import { fmtTax } from '../../utils/format';
import { exportToExcel } from '../../utils/exportUtils';
import { openPrintWindow } from '../../utils/printUtils';
import { getTaxVatReport, getVatPlanningList, throwIfApiFailed, upsertVatPlanning } from '../../services/api';
import { Button, Input } from '../../ui';
import HajriTaxDetailEditor from './HajriTaxDetailEditor';
import HajriTaxRegistryList from './HajriTaxRegistryList';
import HajriTaxNewDeclarationModal from './HajriTaxNewDeclarationModal';

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
  const [regFilterCompany, setRegFilterCompany] = useState(() => searchParams.get('company') || '');
  const [regFilterYear, setRegFilterYear] = useState('');
  const [regFilterQuarter, setRegFilterQuarter] = useState('');
  const [detailCompanyId, setDetailCompanyId] = useState(null);
  const [detailReadOnly, setDetailReadOnly] = useState(false);
  const [showNewDeclarationModal, setShowNewDeclarationModal] = useState(false);

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

  const registryQueryFilters = useMemo(
    () => ({
      year: regFilterYear === '' ? undefined : Number(regFilterYear),
      quarter: regFilterQuarter === '' ? undefined : Number(regFilterQuarter),
      companyId: regFilterCompany || undefined,
    }),
    [regFilterYear, regFilterQuarter, regFilterCompany],
  );

  const { data: registryRows = [], isLoading: registryLoading, refetch: refetchRegistry } = useVatPlanningRegistry(
    registryQueryFilters,
    !detailCompanyId,
  );

  const periodStr = `Q${quarter}`;
  const periodLabel = `${year}-${periodStr}`;

  /** جلب إقرارات الربع المحدد — للربط مع `resolveRecord` وروابط ?edit=1 من دون فتح التفاصيل أولًا */
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

  const resolveRecord = useCallback(
    (companyId) => recordByCompany.get(companyId),
    [recordByCompany],
  );

  const openCompanyDetail = useCallback(
    async (companyId, forcedPeriod) => {
      let rec = null;
      if (
        forcedPeriod &&
        Number.isFinite(forcedPeriod.year) &&
        forcedPeriod.year >= 2000 &&
        Number.isFinite(forcedPeriod.quarter) &&
        [1, 2, 3, 4].includes(forcedPeriod.quarter)
      ) {
        setYear(forcedPeriod.year);
        setQuarter(forcedPeriod.quarter);
        const res = await getVatPlanningList(forcedPeriod.year, forcedPeriod.quarter, companyId);
        throwIfApiFailed(res, 'فشل تحميل السجل');
        const arr = Array.isArray(res.data) ? res.data : [];
        rec = arr[0] || null;
      } else {
        rec = resolveRecord(companyId);
      }
      const payload = rec?.payload && typeof rec.payload === 'object' ? rec.payload : {};
      setDraftData(clonePayload(payload));
      setPaymentTargetStr(rec?.paymentTarget != null ? String(rec.paymentTarget) : '');
      setNotes(rec?.notes || '');
      setSourceSnapshot(rec?.sourceSnapshot ?? null);
      setImportIso(rec?.importedAt || null);
      setDetailCompanyId(companyId);
      setDetailReadOnly(false);
      setSaveHint('');
    },
    [resolveRecord],
  );

  const openFromRegistryRow = useCallback((row, mode) => {
    setYear(row.year);
    setQuarter(row.quarter);
    setRegFilterCompany(row.companyId);
    setDetailReadOnly(mode === 'view');
    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
    setDraftData(clonePayload(payload));
    setPaymentTargetStr(row.paymentTarget != null ? String(row.paymentTarget) : '');
    setNotes(row.notes || '');
    setSourceSnapshot(row.sourceSnapshot ?? null);
    setImportIso(row.importedAt || null);
    setDetailCompanyId(row.companyId);
    setSaveHint('');
  }, []);

  const handleNewDeclarationConfirm = useCallback(
    async ({ companyId, year: y, quarter: q }) => {
      setYear(y);
      setQuarter(q);
      setRegFilterCompany(companyId);
      setDetailReadOnly(false);
      const res = await getVatPlanningList(y, q, companyId);
      throwIfApiFailed(res, 'فشل تحميل السجل');
      const rec = Array.isArray(res.data) && res.data[0] ? res.data[0] : null;
      if (rec) {
        setDraftData(clonePayload(rec.payload));
        setPaymentTargetStr(rec.paymentTarget != null ? String(rec.paymentTarget) : '');
        setNotes(rec.notes || '');
        setSourceSnapshot(rec.sourceSnapshot ?? null);
        setImportIso(rec.importedAt || null);
      } else {
        setDraftData(defaultDisclosureData());
        setPaymentTargetStr('');
        setNotes('');
        setSourceSnapshot(null);
        setImportIso(null);
      }
      setDetailCompanyId(companyId);
      setSaveHint('');
    },
    [],
  );

  const closeDetail = useCallback(() => {
    setDetailCompanyId(null);
    setDetailReadOnly(false);
    refetch();
    refetchRegistry();
    setSearchParams((sp) => {
      const next = new URLSearchParams(sp);
      next.delete('edit');
      return next;
    });
  }, [refetch, refetchRegistry, setSearchParams]);

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
    const yNum = Number(searchParams.get('year'));
    const qNum = Number(searchParams.get('quarter'));
    const forcedPeriod =
      Number.isFinite(yNum) && yNum >= 2000 && [1, 2, 3, 4].includes(qNum)
        ? { year: yNum, quarter: qNum }
        : undefined;
    void openCompanyDetail(c, forcedPeriod);
  }, [listLoading, searchParams, companies, openCompanyDetail]);

  const updateRow = useCallback((key, field, value) => {
    if (detailReadOnly) return;
    const num = parseFloat(String(value).replace(/,/g, '')) || 0;
    setDraftData((prev) => {
      const next = { ...prev };
      const isSummaryField = !field || SUMMARY_ROWS.some((r) => r.key === key);
      if (isSummaryField) next[key] = num;
      else next[key] = { ...(next[key] || { amount: 0, adjustment: 0, vat: 0 }), [field]: num };
      return next;
    });
  }, [detailReadOnly]);

  const renderEditableCell = useCallback(
    (key, field) => (
      <Input
        type="text"
        inputMode="decimal"
        readOnly={detailReadOnly}
        value={getRowValue(draftData, key, field) || ''}
        onChange={(e) => updateRow(key, field, e.target.value)}
        placeholder="0"
      />
    ),
    [draftData, updateRow, detailReadOnly],
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
    if (!detailCompanyId || detailReadOnly) return;
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
  }, [detailCompanyId, detailReadOnly, year, periodStr, salesAmountIncludesVat]);

  const handleBalancePayment = useCallback(() => {
    if (detailReadOnly) return;
    const target = parseFloat(String(paymentTargetStr).replace(/,/g, ''));
    if (!Number.isFinite(target)) return;
    setDraftData((prev) => scaleInputVatForPaymentTarget(prev, target));
  }, [paymentTargetStr, detailReadOnly]);

  const handleSaveDetail = useCallback(async () => {
    if (!detailCompanyId || detailReadOnly) return;
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
  }, [detailCompanyId, detailReadOnly, year, quarter, draftData, sourceSnapshot, paymentTargetStr, notes, importIso, upsertMutation, t]);

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
      return `<tr><td>${(label(r) || '').replace(/</g, '&lt;')}</td><td>${fmtTax(amt)}</td><td>${r.isTotal ? '—' : fmtTax(getRowValue(draftData, r.key, 'adjustment'))}</td><td>${fmtTax(vat)}</td></tr>`;
    }).join('');
    const inRows = INPUT_ROWS.map((r) => {
      const amt = r.isTotal ? inputTotal : getRowValue(draftData, r.key, 'amount');
      const vat = r.isTotal ? inputTotal : getRowValue(draftData, r.key, 'vat');
      return `<tr><td>${(label(r) || '').replace(/</g, '&lt;')}</td><td>${fmtTax(amt)}</td><td>${r.isTotal ? '—' : fmtTax(getRowValue(draftData, r.key, 'adjustment'))}</td><td>${fmtTax(vat)}</td></tr>`;
    }).join('');
    openPrintWindow({
      title: t('hajriTax'),
      companyName: name || '',
      subtitle: `${periodLabel} — ${lang === 'ar' ? 'تخطيط ضريبي (لا يؤثر على المحاسبة)' : 'Planning only (no accounting impact)'}`,
      body: `<p>${lang === 'ar' ? 'مبلغ الدفع المستهدف:' : 'Target payment:'} ${fmtTax(parseFloat(paymentTargetStr) || 0)} SR</p>
<table><thead><tr><th>${t('reportItem')}</th><th>SR</th><th>${lang === 'ar' ? 'تعديل' : 'Adj.'}</th><th>VAT</th></tr></thead>
<tbody><tr><td colspan="4" style="background:#f0fdf4;font-weight:700">${lang === 'ar' ? 'مخرجات ضريبة القيمة المضافة (المبيعات)' : 'Output VAT (sales)'}</td></tr>${outRows}
<tr><td colspan="4" style="background:#fef2f2;font-weight:700">${lang === 'ar' ? 'ضريبة المشتريات والمصروفات (ما سُجّلت ضريبته فقط)' : 'Purchases & expenses VAT (tax lines only)'}</td></tr>${inRows}</tbody></table>
<p><b>${lang === 'ar' ? 'صافي مستحق' : 'Net payable'}:</b> ${fmtTax(netPayableDraft)} SR</p>`,
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
    const rows = registryRows.map((r) => {
      const payload = r.payload && typeof r.payload === 'object' ? r.payload : defaultDisclosureData();
      const net = computeNetPayable(payload);
      const pt = r.paymentTarget != null ? parseFloat(String(r.paymentTarget)) : null;
      return {
        [lang === 'ar' ? 'الشركة' : 'Company']: lang === 'en'
          ? (r.company?.nameEn || r.company?.nameAr)
          : (r.company?.nameAr || r.company?.nameEn),
        Year: r.year,
        Quarter: `Q${r.quarter}`,
        [t('vatNetPayable')]: net,
        [t('vatPaymentTarget')]: Number.isFinite(pt) ? pt : '',
        [t('vatNotes')]: r.notes || '',
        [t('vatLastUpdated')]: r.updatedAt ? String(r.updatedAt).slice(0, 19) : '—',
      };
    });
    exportToExcel(rows, `hajri-tax-registry-${currentYear}.xlsx`);
  }, [registryRows, lang, t, currentYear]);

  const printConsolidated = useCallback(() => {
    const bodyRows = registryRows
      .map((r) => {
        const nm = lang === 'en' ? (r.company?.nameEn || r.company?.nameAr) : r.company?.nameAr;
        const payload = r.payload && typeof r.payload === 'object' ? r.payload : defaultDisclosureData();
        const net = computeNetPayable(payload);
        const pt = r.paymentTarget != null ? parseFloat(String(r.paymentTarget)) : null;
        return `<tr><td>${(nm || '').replace(/</g, '&lt;')}</td><td>${r.year}</td><td>Q${r.quarter}</td><td>${fmtTax(net)}</td><td>${pt != null && Number.isFinite(pt) ? fmtTax(pt) : '—'}</td><td>${(r.notes || '').replace(/</g, '&lt;')}</td></tr>`;
      })
      .join('');
    openPrintWindow({
      title: `${t('hajriTax')} — ${lang === 'ar' ? 'السجل' : 'Registry'}`,
      companyName: '',
      subtitle: '',
      body: `<table class="w-full"><thead><tr><th>${lang === 'ar' ? 'الشركة' : 'Company'}</th><th>${lang === 'ar' ? 'السنة' : 'Year'}</th><th>${t('vatQuarter')}</th><th>${t('vatNetPayable')}</th><th>${t('vatPaymentTarget')}</th><th>${t('vatNotes')}</th></tr></thead><tbody>${bodyRows}</tbody></table>`,
    });
  }, [registryRows, lang, t]);

  const exportJsonBundle = useCallback(() => {
    const records = registryRows.map((r) => ({
      companyId: r.companyId,
      year: r.year,
      quarter: r.quarter,
      payload: r.payload && typeof r.payload === 'object' ? r.payload : defaultDisclosureData(),
      paymentTarget: r.paymentTarget ?? null,
      notes: r.notes ?? null,
      sourceSnapshot: r.sourceSnapshot ?? null,
    }));
    const blob = new Blob(
      [JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), records }, null, 2)],
      { type: 'application/json' },
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'hajri-tax-registry-export.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }, [registryRows]);

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
      const fallbackYear = parsed.year;
      const fallbackQuarter = parsed.quarter;
      for (const item of list) {
        if (!item?.companyId) continue;
        const y = item.year ?? fallbackYear;
        const q = item.quarter ?? fallbackQuarter;
        if (!Number.isFinite(Number(y)) || !Number.isFinite(Number(q))) continue;
        const res = await upsertVatPlanning({
          companyId: item.companyId,
          year: Number(y),
          quarter: Number(q),
          payload: item.payload || defaultDisclosureData(),
          paymentTarget: item.paymentTarget ?? null,
          notes: item.notes ?? null,
          sourceSnapshot: item.sourceSnapshot ?? undefined,
        });
        throwIfApiFailed(res, 'فشل استيراد سجل');
      }
      qc.invalidateQueries({ queryKey: ['vat-planning'] });
      refetchRegistry();
      refetch();
    },
    [qc, refetchRegistry, refetch],
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
        readOnly={detailReadOnly}
        onSwitchToEdit={() => setDetailReadOnly(false)}
      />
    );
  }

  const jsonToolbar = (
    <>
      <Button size="sm" variant="ghost" onClick={exportConsolidatedExcel}>
        {t('vatConsolidatedExport')}
      </Button>
      <Button size="sm" variant="ghost" onClick={printConsolidated}>
        {t('vatConsolidatedPrint')}
      </Button>
      <Button size="sm" variant="ghost" onClick={exportJsonBundle}>
        {t('vatJsonExport')}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => jsonInputRef.current?.click()}>
        {t('vatJsonImport')}
      </Button>
      <input ref={jsonInputRef} type="file" accept=".json,application/json" className="hidden" onChange={onJsonImport} />
    </>
  );

  return (
    <>
      <HajriTaxRegistryList
        t={t}
        lang={lang}
        companies={companies}
        currentYear={currentYear}
        registryRows={registryRows}
        registryLoading={registryLoading}
        filterYear={regFilterYear}
        setFilterYear={setRegFilterYear}
        filterQuarter={regFilterQuarter}
        setFilterQuarter={setRegFilterQuarter}
        filterCompanyId={regFilterCompany}
        setFilterCompanyId={setRegFilterCompany}
        onNewDeclaration={() => setShowNewDeclarationModal(true)}
        onViewRow={(row) => openFromRegistryRow(row, 'view')}
        onEditRow={(row) => openFromRegistryRow(row, 'edit')}
        jsonToolbar={jsonToolbar}
      />
      <HajriTaxNewDeclarationModal
        open={showNewDeclarationModal}
        onClose={() => setShowNewDeclarationModal(false)}
        onConfirm={handleNewDeclarationConfirm}
        companies={companies}
        lang={lang}
        t={t}
      />
    </>
  );
}
