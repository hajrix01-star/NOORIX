/**
 * HAJRI TAX — سجل ضريبي تخطيطي معزول عن المحاسبة (قسم رئيسي مستقل).
 * العرض فقط؛ المنطق في useHajriTaxScreen.
 */
import React, { useCallback } from 'react';
import { getRowValue, roundMoney2 } from '../../constants/taxDisclosure';
import { Button, FileTrigger, Input } from '../../ui';
import HajriTaxDetailEditor from './HajriTaxDetailEditor';
import HajriTaxRegistryList from './HajriTaxRegistryList';
import HajriTaxNewDeclarationModal from './HajriTaxNewDeclarationModal';
import HajriTaxBulkImportModal from './HajriTaxBulkImportModal';
import { useHajriTaxScreen } from './useHajriTaxScreen';

export default function HajriTaxScreen() {
  const s = useHajriTaxScreen();

  const renderEditableCell = useCallback(
    (key: any, field: any) => {
      const cellId = `${key}:${field}`;
      const raw = getRowValue(s.draftData, key, field);
      const n = Number(raw);
      const rounded = Number.isFinite(n) ? roundMoney2(n) : NaN;
      const isZero = !Number.isFinite(rounded) || rounded === 0;
      const committed = !Number.isFinite(n) || isZero ? '' : rounded.toFixed(2);
      const display = s.cellEdit?.id === cellId ? s.cellEdit.text : committed;

      return (
        <Input
          type="text"
          inputMode="decimal"
          readOnly={s.detailReadOnly}
          value={display}
          placeholder=" "
          onFocus={() => {
            if (s.detailReadOnly) return;
            const start = !Number.isFinite(n) || isZero ? '' : roundMoney2(n).toFixed(2);
            s.setCellEdit({ id: cellId, text: start });
          }}
          onBlur={() => {
            s.setCellEdit((cur: any) => {
              if (cur?.id !== cellId) return cur;
              s.updateRow(key, field, cur.text);
              return null;
            });
          }}
          onChange={(e: any) => {
            if (s.detailReadOnly) return;
            const text = e.target.value;
            s.setCellEdit({ id: cellId, text });
            s.updateRow(key, field, text);
          }}
        />
      );
    },
    [s.draftData, s.updateRow, s.detailReadOnly, s.cellEdit, s.setCellEdit],
  );

  if (!s.companies?.length) {
    return (
      <div className="noorix-surface-card p-5 text-center text-noorix-muted">
        {s.t('pleaseSelectCompany')}
      </div>
    );
  }

  if (s.detailCompanyId) {
    const { name, tax } = s.companyMeta(s.detailCompanyId);
    return (
      <HajriTaxDetailEditor
        t={s.t}
        lang={s.lang}
        periodLabel={s.periodLabel}
        companyName={name}
        taxNumber={tax}
        closeDetail={s.closeDetail}
        handleImportFromTaxReport={s.handleImportFromTaxReport}
        importingReport={s.importingReport}
        handleSaveDetail={s.handleSaveDetail}
        savePending={s.upsertMutation.isPending}
        printDetail={s.printDetail}
        exportDetailExcel={s.exportDetailExcel}
        saveHint={s.saveHint}
        outputTotal={s.outputTotal}
        inputTotal={s.inputTotal}
        netPayableDraft={s.netPayableDraft}
        netVat={s.netVat}
        priorAdj={s.priorAdj}
        balanceCarried={s.balanceCarried}
        paymentTargetStr={s.paymentTargetStr}
        setPaymentTargetStr={s.setPaymentTargetStr}
        notes={s.notes}
        setNotes={s.setNotes}
        sourceSnapshot={s.sourceSnapshot}
        showSimulator={s.showSimulator}
        setShowSimulator={s.setShowSimulator}
        handleBalancePayment={s.handleBalancePayment}
        simulatorRequiredInputVat={s.simulatorRequiredInputVat}
        simulatorEstimatedBaseAt15={s.simulatorEstimatedBaseAt15}
        simulatorInvalidTarget={s.simulatorInvalidTarget}
        paymentTargetParsed={s.paymentTargetParsed}
        renderEditableCell={renderEditableCell}
        updateRow={s.updateRow}
        salesAmountIncludesVat={s.salesAmountIncludesVat}
        setSalesAmountIncludesVat={s.setSalesAmountIncludesVat}
        readOnly={s.detailReadOnly}
        onSwitchToEdit={() => s.setDetailReadOnly(false)}
        filingSubmitted={s.detailFilingSubmitted}
        onApproveFiling={() => void s.persistDetailFilingSubmitted(true)}
        onReopenFiling={() => void s.persistDetailFilingSubmitted(false)}
        filingActionPending={s.upsertMutation.isPending}
      />
    );
  }

  const jsonToolbar = (
    <>
      <Button size="sm" variant="ghost" onClick={s.exportConsolidatedExcel}>
        {s.t('vatConsolidatedExport')}
      </Button>
      <Button size="sm" variant="ghost" onClick={s.printConsolidated}>
        {s.t('vatConsolidatedPrint')}
      </Button>
      <Button size="sm" variant="ghost" onClick={s.exportJsonBundle}>
        {s.t('vatJsonExport')}
      </Button>
      <FileTrigger
        ref={s.jsonInputRef}
        label={s.t('vatJsonImport')}
        accept=".json,application/json"
        onChange={s.onJsonImport}
        buttonProps={{ size: 'sm', variant: 'ghost' }}
      />
      <Button size="sm" variant="ghost" onClick={() => s.setShowBulkImportModal(true)}>
        {s.t('hajriTaxBulkImportTitle')}
      </Button>
    </>
  );

  return (
    <>
      <HajriTaxRegistryList
        t={s.t}
        lang={s.lang}
        companies={s.registryFilterCompanies}
        filterYearOptions={s.registryFilterYearOptions}
        currentYear={s.currentYear}
        registryRows={s.registryRows}
        registryLoading={s.registryLoading}
        filterYear={s.regFilterYear}
        setFilterYear={s.setRegFilterYear}
        filterQuarter={s.regFilterQuarter}
        setFilterQuarter={s.setRegFilterQuarter}
        filterCompanyId={s.regFilterCompany}
        setFilterCompanyId={s.setRegFilterCompany}
        onNewDeclaration={() => s.setShowNewDeclarationModal(true)}
        onViewRow={(row: any) => s.openFromRegistryRow(row, 'view')}
        onEditRow={(row: any) => s.openFromRegistryRow(row, 'edit')}
        onRegistryFilingChange={s.handleRegistryFilingChange}
        filingBusyRowId={s.filingBusyRowId}
        jsonToolbar={jsonToolbar}
      />
      <HajriTaxNewDeclarationModal
        open={s.showNewDeclarationModal}
        onClose={() => s.setShowNewDeclarationModal(false)}
        onConfirm={s.handleNewDeclarationConfirm}
        companies={s.companies}
        lang={s.lang}
        t={s.t}
      />
      <HajriTaxBulkImportModal
        open={s.showBulkImportModal}
        onClose={() => s.setShowBulkImportModal(false)}
        companies={s.companies}
        lang={s.lang}
        t={s.t}
        onImported={s.handleBulkImportSuccess}
      />
    </>
  );
}
