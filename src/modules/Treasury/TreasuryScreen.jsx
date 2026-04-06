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

  const gridColStyle = { gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))' };

  const SectionLabel = ({ label }) => (
    <div className="nx-text-xs nx-font-700 nx-text-muted nx-uppercase nx-mb-10" style={{ letterSpacing: '0.06em' }}>
      {label}
    </div>
  );

  return (
    <div className="nx-screen">
      <Toast visible={toast.visible} message={toast.message} type={toast.type}
        onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />

      {/* هيدر */}
      <div className="nx-page-header">
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <h1 className="nx-page-title">{t('vaults')}</h1>
          {hasCompany && isFetching && !isLoading && (
            <p className="nx-text-sm nx-font-600" style={{ margin: '8px 0 0', color: 'var(--noorix-accent-blue)' }}>
              {t('vaultsSyncing')}
            </p>
          )}
        </div>
        <div className="nx-toolbar">
          <label className="nx-checkbox nx-text-muted">
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
            {t('showArchived')}
          </label>
          <Button variant="primary" onClick={() => { setShowAddForm(true); setSaveError(''); }}>
            + {t('addVault')}
          </Button>
        </div>
      </div>

      <DateFilterBar filter={dateFilter} />

      {!hasCompany && (
        <div className="noorix-surface-card nx-p-20 nx-text-center nx-text-muted">
          {t('pleaseSelectCompanyVaults')}
        </div>
      )}

      {hasCompany && isLoading && (
        <div className="nx-text-muted nx-text-base nx-text-center" style={{ padding: 40 }}>
          {t('loading')}
        </div>
      )}

      {hasCompany && !isLoading && (
        <>
          {/* ── بطاقة الملخص الإجمالي (للشهر/الفترة المحددة) ── */}
          {vaultsList.length > 0 && (
            <div className="nx-grid nx-rounded-lg nx-bg-surface nx-overflow-hidden nx-border-all" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 0 }}>
              <div className="nx-text-xs nx-text-muted nx-border-b" style={{ gridColumn: '1 / -1', padding: '8px 20px' }}>
                {dateFilter?.label || t('allMonths')}
              </div>
              {[
                { label: t('totalBalance'), value: totalBalance, color: totalBalance < 0 ? '#dc2626' : 'var(--noorix-text)', sign: totalBalance < 0 ? '−' : '' },
                { label: t('inbound'),      value: totalIn,      color: '#16a34a', sign: '' },
                { label: t('outbound'),     value: totalOut,     color: 'var(--noorix-text)', sign: '' },
              ].map(({ label, value, color, sign }, i) => (
                <div key={label} className="nx-text-center" style={{ padding: '16px 20px', borderRight: i < 2 ? '1px solid var(--noorix-border)' : 'none' }}>
                  <div className="nx-text-xs nx-text-muted nx-mb-6" style={{ letterSpacing: '0.03em' }}>{label}</div>
                  <div className="nx-font-800" style={{ fontSize: 20, fontFamily: 'var(--noorix-font-numbers)', color }}>
                    {sign}{fmt(Math.abs(value))}
                    <span className="nx-text-sm nx-font-500 nx-text-muted" style={{ marginRight: 3 }}>﷼</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── قنوات المبيعات ── */}
          {salesChannels.length > 0 && (
            <section>
              <SectionLabel label={t('salesChannelsEnabled', salesChannels.length)} />
              <div className="nx-grid nx-gap-14" style={gridColStyle}>
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
              <div className="nx-grid nx-gap-14" style={gridColStyle}>
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
              <div className="nx-grid nx-gap-14" style={gridColStyle}>
                {archivedVaults.map((v) => (
                  <VaultCard key={v.id} vault={v} {...cardHandlers(v)} />
                ))}
              </div>
            </section>
          )}

          {/* ── فارغة ── */}
          {vaultsList.length === 0 && (
            <div className="noorix-surface-card nx-text-center" style={{ padding: 48, border: '2px dashed var(--noorix-border)' }}>
              <div className="nx-flex-center nx-bg-muted" style={{ width: 56, height: 56, borderRadius: 16, justifyContent: 'center', margin: '0 auto 14px' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--noorix-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
                  <rect x="2" y="6" width="20" height="12" rx="2"/>
                  <circle cx="12" cy="12" r="2.5"/>
                  <path d="M6 12h.01M18 12h.01"/>
                </svg>
              </div>
              <h3 className="nx-text-lg" style={{ margin: '0 0 6px' }}>{t('noVaults')}</h3>
              <p className="nx-text-muted nx-text-base" style={{ margin: '0 0 18px' }}>{t('addFirstVault')}</p>
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
