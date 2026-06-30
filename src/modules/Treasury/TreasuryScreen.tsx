import React, { useState, useMemo, useEffect } from 'react';
import { useApiMutation } from '../../hooks/useApiMutation';
import { updateVault } from '../../services/api';
import { useApp }         from '../../context/AppContext';
import { useToast }       from '../../context/ToastContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useVaults } from '../../hooks/useVaults';
import DateFilterBar, { useDateFilter } from '../../shared/components/DateFilterBar';
import FilterToolbar from '../../shared/components/FilterToolbar';
import { sumAmounts } from '../../utils/format';
import VaultCard          from './components/VaultCard';
import VaultFormModal     from './components/VaultFormModal';
import VaultTransactionsModal from './components/VaultTransactionsModal';
import VaultTransferModal from './components/VaultTransferModal';
import { VaultReorderModal } from './components/VaultReorderModal';
import { Button, ScreenShell, FmtNum } from '../../ui';
import { vaultKeys } from '../../services/queryKeys';

export default function TreasuryScreen() {
  const { activeCompanyId } = useApp();
  const { t } = useTranslation();
  const companyId   = activeCompanyId ?? '';

  const { showToast } = useToast();
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedVault,   setSelectedVault]  = useState<any>(null);
  const [editVault,       setEditVault]      = useState<any>(null);
  const [showAddForm,     setShowAddForm]    = useState(false);
  const [showTransfer,    setShowTransfer]   = useState(false);
  const [showReorder,     setShowReorder]    = useState(false);
  const [saveError,       setSaveError]      = useState('');

  const dateFilter = useDateFilter();
  const startDate = dateFilter?.startDate || null;
  const endDate = dateFilter?.endDate || null;

  const notify = (message: any, type: any = 'success') => showToast(message, type);

  const {
    vaultsList = [],
    isLoading,
    isFetching,
    isError: vaultsError,
    create: createMut,
    update: updateMut,
    archive: archiveMut,
    remove: removeMut,
    reorder: reorderMut,
  } = useVaults({ companyId, includeArchived, startDate, endDate });

  useEffect(() => {
    setSelectedVault(null);
    setEditVault(null);
    setShowAddForm(false);
    setShowReorder(false);
    setSaveError('');
  }, [companyId]);

  const toggleSalesMutation = useApiMutation({
    mutationFn: (v: any) => updateVault(v.id, { isSalesChannel: !v.isSalesChannel }),
    invalidateQueries: [vaultKeys.byCompany(companyId)],
    successToast: () => t('salesChannelUpdated'),
    errorToast: (e: any) => e?.message || t('updateFailed'),
  });

  const togglePaymentMethodMutation = useApiMutation({
    mutationFn: (v: any) => updateVault(v.id, { showAsPaymentMethod: !(v.showAsPaymentMethod !== false) }),
    invalidateQueries: [vaultKeys.byCompany(companyId)],
    successToast: () => t('paymentMethodVisibilityUpdated'),
    errorToast: (e: any) => e?.message || t('updateFailed'),
  });

  const handleDelete = (v: any) => {
    if (!window.confirm(t('deleteVaultConfirm', v.nameAr))) return;
    removeMut.mutate(v.id, {
      onSuccess: () => notify(t('vaultDeleted')),
      onError: (e: any) => notify(e?.message || t('cannotDeleteVaultWithMovements'), 'error'),
    });
  };

  const cmpVaultOrder = (a: any, b: any) =>
    (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.nameAr).localeCompare(String(b.nameAr), 'ar');
  const salesChannels  = useMemo(
    () => vaultsList.filter((v: any) => v.isActive !== false && v.isSalesChannel && !v.isArchived).sort(cmpVaultOrder),
    [vaultsList],
  );
  const otherVaults    = useMemo(
    () => vaultsList.filter((v: any) => v.isActive !== false && !v.isSalesChannel && !v.isArchived).sort(cmpVaultOrder),
    [vaultsList],
  );
  const archivedVaults = useMemo(
    () => includeArchived ? vaultsList.filter((v: any) => v.isActive !== false && v.isArchived) : [],
    [vaultsList, includeArchived],
  );
  const totalBalance   = useMemo(
    () => sumAmounts(vaultsList.filter((v: any) => v.isActive !== false && !v.isArchived), 'balance').toNumber(),
    [vaultsList],
  );

  const cardHandlers = (vault: any) => ({
    onEdit:               (x: any) => { setEditVault(x); setSaveError(''); },
    onToggleSalesChannel: (x: any) => toggleSalesMutation.mutate(x),
    onTogglePaymentMethod: (x: any) => togglePaymentMethodMutation.mutate(x),
    onArchive:            (x: any) => archiveMut.mutate(x.id, {
      onSuccess: () => notify(x?.isArchived ? t('vaultRestored') : t('vaultArchived')),
      onError: (e: any) => notify(e?.message || t('operationFailed'), 'error'),
    }),
    onDelete:             handleDelete,
    onClick:              (x: any) => setSelectedVault(x),
  });

  const hasCompany = !!companyId;

  /* الإجمالي الكلي وارد/صادر */
  const totalIn  = useMemo(() => sumAmounts(vaultsList.filter((v: any) => v.isActive !== false && !v.isArchived), 'totalIn').toNumber(),  [vaultsList]);
  const totalOut = useMemo(() => sumAmounts(vaultsList.filter((v: any) => v.isActive !== false && !v.isArchived), 'totalOut').toNumber(), [vaultsList]);

  const SectionLabel = ({ label }: any) => (
    <div className="text-[11px] font-bold text-noorix-muted uppercase tracking-[0.06em] mb-2.5">
      {label}
    </div>
  );

  return (
    <ScreenShell>
      {/* هيدر */}
      <div className="nx-page-header">
          <div className="flex-1 min-w-0">
          <h1 className="text-[20px] font-bold text-noorix-text m-0">{t('vaults')}</h1>
          {hasCompany && isFetching && !isLoading && (
            <p className="text-[12px] font-semibold mt-2 m-0 text-noorix-blue">
              {t('vaultsSyncing')}
            </p>
          )}
        </div>
        <div className="nx-toolbar">
          <label className="nx-checkbox text-noorix-muted">
            <input type="checkbox" checked={includeArchived} onChange={(e: any) => setIncludeArchived(e.target.checked)} />
            {t('showArchived')}
          </label>
          <Button variant="ghost" size="sm" onClick={() => setShowReorder(true)} disabled={!hasCompany}>
            {t('vaultReorderTitle')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowTransfer(true)} disabled={!hasCompany}>
            {t('vaultTransferOpen')}
          </Button>
          <Button variant="primary" size="sm" onClick={() => { setShowAddForm(true); setSaveError(''); }}>
            {t('addVaultBtn')}
          </Button>
        </div>
      </div>

      <FilterToolbar>
        <DateFilterBar filter={dateFilter} />
      </FilterToolbar>

      {!hasCompany && (
        <div className="noorix-surface-card p-5 text-center text-noorix-muted">
          {t('pleaseSelectCompanyVaults')}
        </div>
      )}

      {hasCompany && isLoading && (
        <div className="text-noorix-muted text-[13px] text-center p-10">
          {t('loading')}
        </div>
      )}

      {hasCompany && !isLoading && (
        <>
          {/* ── بطاقة الملخص الإجمالي (للشهر/الفترة المحددة) ── */}
          {vaultsList.length > 0 && (
            <div className="noorix-surface-card grid gap-0 overflow-hidden p-0 [grid-template-columns:repeat(auto-fit,minmax(120px,1fr))]">
              <div className="text-[11px] text-noorix-muted border-b border-noorix-border py-2 px-5 col-span-full">
                {dateFilter?.label || t('allMonths')}
              </div>
              {[
                { label: t('totalBalance'), value: totalBalance, color: totalBalance < 0 ? 'var(--noorix-accent-red)' : 'var(--noorix-text)', sign: totalBalance < 0 ? '−' : '' },
                { label: t('inbound'),      value: totalIn,      color: 'var(--noorix-accent-green)', sign: '' },
                { label: t('outbound'),     value: totalOut,     color: 'var(--noorix-text)', sign: '' },
              ].map(({ label, value, color, sign }: any, i: any) => (
                <div key={label} className="text-center p-4" style={{ borderRight: i < 2 ? '1px solid var(--noorix-border)' : 'none' }}>
                  <div className="text-[11px] text-noorix-muted mb-1.5 tracking-[0.03em]">{label}</div>
                  <div dir="ltr" className="font-extrabold text-[20px] nx-font-numbers" style={{ color }}>
                    {sign}<FmtNum n={Math.abs(value)} />
                    <span className="nx-sar me-[3px]">SR</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── قنوات المبيعات ── */}
          {salesChannels.length > 0 && (
            <section>
              <SectionLabel label={t('salesChannelsEnabled', salesChannels.length)} />
              <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(270px,1fr))]">
                {salesChannels.map((v: any) => (
                  <VaultCard key={v.id} vault={v} {...cardHandlers(v)} />
                ))}
              </div>
            </section>
          )}

          {/* ── خزائن أخرى ── */}
          {otherVaults.length > 0 && (
            <section>
              <SectionLabel label={t('otherVaults', otherVaults.length)} />
              <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(270px,1fr))]">
                {otherVaults.map((v: any) => (
                  <VaultCard key={v.id} vault={v} {...cardHandlers(v)} />
                ))}
              </div>
            </section>
          )}

          {/* ── مؤرشَف ── */}
          {includeArchived && archivedVaults.length > 0 && (
            <section>
              <SectionLabel label={t('archivedVaults', archivedVaults.length)} />
              <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(270px,1fr))]">
                {archivedVaults.map((v: any) => (
                  <VaultCard key={v.id} vault={v} {...cardHandlers(v)} />
                ))}
              </div>
            </section>
          )}

          {/* ── فارغة ── */}
          {vaultsList.length === 0 && (
            <div className="noorix-surface-card text-center p-6 border-2 border-dashed border-noorix-border">
              <div className="flex items-center justify-center bg-noorix-bg-muted w-14 h-14 rounded-[16px] mx-auto mb-[14px]">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--noorix-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
                  <rect x="2" y="6" width="20" height="12" rx="2"/>
                  <circle cx="12" cy="12" r="2.5"/>
                  <path d="M6 12h.01M18 12h.01"/>
                </svg>
              </div>
              <h3 className="text-[15px] mb-1.5 m-0">{t('noVaults')}</h3>
              <p className="text-noorix-muted text-[13px] mb-4 m-0">{t('addFirstVault')}</p>
              <Button variant="primary" size="sm" onClick={() => setShowAddForm(true)}>{t('addVault')}</Button>
            </div>
          )}
        </>
      )}

      {selectedVault && (
        <VaultTransactionsModal
          key={selectedVault.id}
          vault={selectedVault}
          companyId={companyId}
          onClose={() => setSelectedVault(null)}
          dateFilter={dateFilter}
        />
      )}

      {showTransfer && hasCompany && (
        <VaultTransferModal
          companyId={companyId}
          startDate={startDate}
          endDate={endDate}
          onClose={() => setShowTransfer(false)}
        />
      )}

      {showReorder && hasCompany && (
        <VaultReorderModal
          open={showReorder}
          onClose={() => setShowReorder(false)}
          vaultsList={vaultsList}
          isSaving={reorderMut.isPending}
          onApply={(vaultIds: any) => {
            reorderMut.mutate(vaultIds, {
              onSuccess: () => {
                setShowReorder(false);
                notify(t('vaultReorderSuccess'));
              },
              onError: (e: any) => notify(e?.message || t('updateFailed'), 'error'),
            });
          }}
        />
      )}

      {showAddForm && (
        <VaultFormModal initial={null}
          onClose={() => { setShowAddForm(false); setSaveError(''); }}
          onSave={(form: any) => createMut.mutate(
            form,
            {
              onSuccess: () => { setShowAddForm(false); setSaveError(''); notify(t('vaultAdded')); },
              onError: (e: any) => setSaveError(e?.message || t('addFailed')),
            },
          )}
          isSaving={createMut.isPending} saveError={saveError} />
      )}

      {editVault && (
        <VaultFormModal initial={editVault}
          onClose={() => { setEditVault(null); setSaveError(''); }}
          onSave={(form: any) => updateMut.mutate(
            { id: editVault.id, body: form },
            {
              onSuccess: () => { setEditVault(null); setSaveError(''); notify(t('editSuccess')); },
              onError: (e: any) => setSaveError(e?.message || t('updateFailed')),
            },
          )}
          isSaving={updateMut.isPending} saveError={saveError} />
      )}
    </ScreenShell>
  );
}
