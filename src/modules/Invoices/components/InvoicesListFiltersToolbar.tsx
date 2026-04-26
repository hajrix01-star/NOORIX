import React from 'react';
import { Button, Input } from '../../../ui';
import { vaultDisplayName } from '../../../utils/vaultDisplay';

/**
 * لافتة الحفر + شريط الفلاتر التنفيذي — مستخرج من InvoicesListScreen
 */
export function InvoicesListFiltersToolbar({
  t,
  lang,
  urlExtra,
  setUrlExtra,
  setPage,
  setDayCloseOpen,
  setDayCloseOpenV2,
  setShowImportExport,
  filterHasNotesOnly,
  setFilterHasNotesOnly,
  showCancelled,
  setShowCancelled,
  filterKind,
  setFilterKind,
  filterSupplierId,
  setFilterSupplierId,
  filterCreatedByUserId,
  setFilterCreatedByUserId,
  filterVaultId,
  setFilterVaultId,
  suppliers,
  creatorUsersForFilter,
  vaultsList,
}: any) {
  return (
    <>
      {(urlExtra.categoryId || urlExtra.expenseLineId || urlExtra.kind) && (
        <div className="noorix-surface-card flex items-center justify-between flex-wrap gap-3 text-[12px] py-[10px] px-[14px] border border-dashed border-[var(--noorix-blue-35)] bg-[var(--noorix-blue-4)]">
          <span className="nx-cell-muted">{t('invoicesDrillBanner')}</span>
          <Button
            size="sm"
            onClick={() => {
              setUrlExtra({ kind: '', categoryId: '', expenseLineId: '' });
              setPage(1);
            }}
          >
            {t('clearDrillFilters')}
          </Button>
        </div>
      )}
      <div className="noorix-exec-filters noorix-exec-filters--scroll">
        <Button
          size="sm"
          variant="primary"
          icon={
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          }
          onClick={() => {
            setDayCloseOpenV2(false);
            setDayCloseOpen(true);
          }}
        >
          {t('dayCloseOpenBtn')}
        </Button>
        <Button
          size="sm"
          icon={
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          }
          onClick={() => {
            setDayCloseOpen(false);
            setDayCloseOpenV2(true);
          }}
        >
          {t('dayCloseOpenBtnV2')}
        </Button>
        <Button
          size="sm"
          icon={
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          }
          onClick={() => setShowImportExport(true)}
        >
          {t('importExportLabel')}
        </Button>
        <Button
          size="sm"
          variant={filterHasNotesOnly ? 'primary' : 'ghost'}
          aria-pressed={filterHasNotesOnly}
          onClick={() => {
            setFilterHasNotesOnly((v: any) => !v);
            setPage(1);
          }}
        >
          {t('filterInvoicesWithNotesOnly')}
        </Button>
        <Button
          size="sm"
          onClick={() => setShowCancelled((v: any) => !v)}
          style={
            showCancelled
              ? {
                  color: 'var(--noorix-accent-red)',
                  borderColor: 'var(--noorix-red-25)',
                  background: 'var(--noorix-red-6)',
                }
              : undefined
          }
        >
          {showCancelled ? t('hideCancelledInvoices') : t('showCancelledInvoices')}
        </Button>
        <span className="noorix-exec-filters__icon" title={t('filterByType')} aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="4 2 20 2 14 10 14 22 10 22 10 10 4 2" />
          </svg>
        </span>
        <Input
          type="select"
          value={filterKind}
          onChange={(e: any) => {
            setFilterKind(e.target.value);
            setUrlExtra((p: any) => ({ ...p, kind: '' }));
            setPage(1);
          }}
          className="noorix-exec-filters__select"
        >
          <option value="">{t('filterAllTypes')}</option>
          <option value="purchase">{t('categoryTypes')}</option>
          <option value="expense">{t('categoryTypeExpense')}</option>
          <option value="fixed_expense">{t('fixedExpenseType')}</option>
          <option value="hr_expense">{t('invoiceKindHrExpense')}</option>
          <option value="salary">{t('totalSalary')}</option>
          <option value="advance">{t('quickAdvance')}</option>
          <option value="sale">{t('categoryTypeSale')}</option>
        </Input>
        <Input
          type="select"
          value={filterSupplierId}
          onChange={(e: any) => {
            setFilterSupplierId(e.target.value);
            setPage(1);
          }}
          className="noorix-exec-filters__select"
        >
          <option value="">{t('allSuppliers')}</option>
          {(suppliers || []).map((s: any) => (
            <option key={s.id} value={s.id}>
              {(lang === 'en' ? s.nameEn || s.nameAr : s.nameAr || s.nameEn) || s.id}
            </option>
          ))}
        </Input>
        <span className="noorix-exec-filters__icon" title={t('invoiceUserColumn')} aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </span>
        <Input
          type="select"
          value={filterCreatedByUserId}
          onChange={(e: any) => {
            setFilterCreatedByUserId(e.target.value);
            setPage(1);
          }}
          className="noorix-exec-filters__select"
          aria-label={t('invoiceUserColumn')}
        >
          <option value="">{t('invoicesFilterCreatorAll')}</option>
          <option value="__none__">{t('invoicesFilterCreatorUnrecorded')}</option>
          {creatorUsersForFilter.map((u: any) => (
            <option key={u.id} value={u.id}>
              {lang === 'en' ? u.nameEn || u.nameAr || u.email : u.nameAr || u.nameEn || u.email}
            </option>
          ))}
        </Input>
        <span className="noorix-exec-filters__icon" title={t('invoiceVaultColumn')} aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="6" width="20" height="14" rx="2" />
            <path d="M12 10v4M8 12h8" />
          </svg>
        </span>
        <Input
          type="select"
          value={filterVaultId}
          onChange={(e: any) => {
            setFilterVaultId(e.target.value);
            setPage(1);
          }}
          className="noorix-exec-filters__select"
          aria-label={t('invoiceVaultColumn')}
        >
          <option value="">{t('invoicesFilterVaultAll')}</option>
          {vaultsList.map((v: any) => (
            <option key={v.id} value={v.id}>
              {vaultDisplayName(v, lang) || v.id}
            </option>
          ))}
        </Input>
      </div>
    </>
  );
}
