import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getVaults, createVault, updateVault, archiveVault, deleteVault } from '../../services/api';
import { useApp }         from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import Toast              from '../../components/Toast';
import DateFilterBar, { useDateFilter } from '../../shared/components/DateFilterBar';
import { fmt, sumAmounts } from '../../utils/format';
import VaultCard          from './components/VaultCard';
import VaultFormModal     from './components/VaultFormModal';
import VaultTransactionsModal from './components/VaultTransactionsModal';
import { Button } from '../../ui';

export default function TreasuryScreen() {
  const { activeCompanyId } = useApp();
  const { t } = useTranslation();
  const companyId   = activeCompanyId ?? '';
  const queryClient = useQueryClient();

  const [toast,           setToast]          = useState({ visible: false, message: '', type: 'success' });
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedVault,   setSelectedVault]  = useState(null);
  const [editVault,       setEditVault]      = useState(null);
  const [showAddForm,     setShowAddForm]    = useState(false);
  const [saveError,       setSaveError]      = useState('');

  const dateFilter = useDateFilter();
  const startDate = dateFilter?.startDate || null;
  const endDate = dateFilter?.endDate || null;

  const notify = (message, type = 'success') =>
    setToast({ visible: true, message, type });

  const { data: vaultsList = [], isLoading, isFetching, isError: vaultsError } = useQuery({
    queryKey: ['vaults', companyId, includeArchived, startDate, endDate],
    queryFn:  async () => {
      const res = await getVaults(companyId, includeArchived, startDate, endDate);
      if (!res?.success) throw new Error(res?.error || 'فشل تحميل الخزائن');
      const d = res?.data;
      return Array.isArray(d) ? d : (d?.items ?? []);
    },
    // بدون إبقاء بيانات شركة سابقة — يمنع خلط الخزائن عند تبديل الشركة
    enabled: !!companyId,
  });

  useEffect(() => {
    setSelectedVault(null);
    setEditVault(null);
    setShowAddForm(false);
    setSaveError('');
  }, [companyId]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['vaults', companyId] });

  const createMutation = useMutation({
    mutationFn: (body) => createVault({ ...body, companyId }),
    onSuccess: () => { invalidate(); setShowAddForm(false); setSaveError(''); notify(t('vaultAdded')); },
    onError:   (e) => setSaveError(e?.message || t('addFailed')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => updateVault(id, body),
    onSuccess: () => { invalidate(); setEditVault(null); setSaveError(''); notify(t('editSuccess')); },
    onError:   (e) => setSaveError(e?.message || t('updateFailed')),
  });

  const toggleSalesMutation = useMutation({
    mutationFn: (v) => updateVault(v.id, { isSalesChannel: !v.isSalesChannel }),
    onSuccess: () => { invalidate(); notify(t('salesChannelUpdated')); },
    onError:   (e) => notify(e?.message || t('updateFailed'), 'error'),
  });

  const togglePaymentMethodMutation = useMutation({
    mutationFn: (v) => updateVault(v.id, { showAsPaymentMethod: !(v.showAsPaymentMethod !== false) }),
    onSuccess: () => { invalidate(); notify(t('paymentMethodVisibilityUpdated')); },
    onError:   (e) => notify(e?.message || t('updateFailed'), 'error'),
  });

  const archiveMutation = useMutation({
    mutationFn: (id) => archiveVault(id),
    onSuccess: (_, id) => {
      const v = vaultsList.find((x) => x.id === id);
      invalidate();
      notify(v?.isArchived ? t('vaultRestored') : t('vaultArchived'));
    },
    onError: (e) => notify(e?.message || t('operationFailed'), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteVault(id),
    onSuccess: () => { invalidate(); notify(t('vaultDeleted')); },
    onError:   (e) => notify(e?.message || t('cannotDeleteVaultWithMovements'), 'error'),
  });

  const handleDelete = (v) => {
    if (!window.confirm(t('deleteVaultConfirm', v.nameAr))) return;
    deleteMutation.mutate(v.id);
  };

  const salesChannels  = useMemo(() => vaultsList.filter((v) => v.isActive !== false && v.isSalesChannel && !v.isArchived), [vaultsList]);
  const otherVaults    = useMemo(() => vaultsList.filter((v) => v.isActive !== false && !v.isSalesChannel && !v.isArchived), [vaultsList]);
  const archivedVaults = useMemo(
    () => includeArchived ? vaultsList.filter((v) => v.isActive !== false && v.isArchived) : [],
    [vaultsList, includeArchived],
  );
  const totalBalance   = useMemo(
    () => sumAmounts(vaultsList.filter((v) => v.isActive !== false && !v.isArchived), 'balance').toNumber(),
    [vaultsList],
  );

  const cardHandlers = (vault) => ({
    onEdit:               (x) => { setEditVault(x); setSaveError(''); },
    onToggleSalesChannel: (x) => toggleSalesMutation.mutate(x),
    onTogglePaymentMethod: (x) => togglePaymentMethodMutation.mutate(x),
    onArchive:            (x) => archiveMutation.mutate(x.id),
    onDelete:             handleDelete,
    onClick:              (x) => setSelectedVault(x),
  });

  const hasCompany = !!companyId;

  /* الإجمالي الكلي وارد/صادر */
  const totalIn  = useMemo(() => sumAmounts(vaultsList.filter((v) => v.isActive !== false && !v.isArchived), 'totalIn').toNumber(),  [vaultsList]);
  const totalOut = useMemo(() => sumAmounts(vaultsList.filter((v) => v.isActive !== false && !v.isArchived), 'totalOut').toNumber(), [vaultsList]);

  const SectionLabel = ({ label }) => (
    <div className="text-[11px] font-bold text-noorix-muted uppercase tracking-[0.06em] mb-2.5">
      {label}
    </div>
  );

  return (
    <div className="flex flex-col gap-4 px-3 py-4 lg:px-6">
      <Toast visible={toast.visible} message={toast.message} type={toast.type}
        onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />

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
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
            {t('showArchived')}
          </label>
          <Button variant="primary" onClick={() => { setShowAddForm(true); setSaveError(''); }}>
            {t('addVaultBtn')}
          </Button>
        </div>
      </div>

      <DateFilterBar filter={dateFilter} />

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
            <div className="grid gap-0 rounded-xl bg-noorix-surface overflow-hidden border border-noorix-border [grid-template-columns:repeat(auto-fit,minmax(120px,1fr))]">
              <div className="text-[11px] text-noorix-muted border-b border-noorix-border py-2 px-5 col-span-full">
                {dateFilter?.label || t('allMonths')}
              </div>
              {[
                { label: t('totalBalance'), value: totalBalance, color: totalBalance < 0 ? 'var(--noorix-accent-red)' : 'var(--noorix-text)', sign: totalBalance < 0 ? '−' : '' },
                { label: t('inbound'),      value: totalIn,      color: 'var(--noorix-accent-green)', sign: '' },
                { label: t('outbound'),     value: totalOut,     color: 'var(--noorix-text)', sign: '' },
              ].map(({ label, value, color, sign }, i) => (
                <div key={label} className="text-center p-4" style={{ borderRight: i < 2 ? '1px solid var(--noorix-border)' : 'none' }}>
                  <div className="text-[11px] text-noorix-muted mb-1.5 tracking-[0.03em]">{label}</div>
                  <div className="font-extrabold text-[20px] nx-font-numbers" style={{ color }}>
                    {sign}{fmt(Math.abs(value))}
                    <span className="text-[12px] font-medium text-noorix-muted me-[3px]">﷼</span>
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
                {salesChannels.map((v) => (
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
                {otherVaults.map((v) => (
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
                {archivedVaults.map((v) => (
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
              <Button variant="primary" onClick={() => setShowAddForm(true)}>{t('addVault')}</Button>
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

      {showAddForm && (
        <VaultFormModal initial={null}
          onClose={() => { setShowAddForm(false); setSaveError(''); }}
          onSave={(form) => createMutation.mutate(form)}
          isSaving={createMutation.isPending} saveError={saveError} />
      )}

      {editVault && (
        <VaultFormModal initial={editVault}
          onClose={() => { setEditVault(null); setSaveError(''); }}
          onSave={(form) => updateMutation.mutate({ id: editVault.id, body: form })}
          isSaving={updateMutation.isPending} saveError={saveError} />
      )}
    </div>
  );
}
