import React, { useState, useMemo } from 'react';
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

  const { data: vaultsList = [], isLoading } = useQuery({
    queryKey: ['vaults', companyId, includeArchived, startDate, endDate],
    queryFn:  async () => {
      const res = await getVaults(companyId, includeArchived, startDate, endDate);
      if (!res?.success) return [];
      const d = res?.data;
      return Array.isArray(d) ? d : (d?.items ?? []);
    },
    placeholderData: (prev) => prev,
    enabled: !!companyId,
  });

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

  const salesChannels  = useMemo(() => vaultsList.filter((v) =>  v.isSalesChannel && !v.isArchived), [vaultsList]);
  const otherVaults    = useMemo(() => vaultsList.filter((v) => !v.isSalesChannel && !v.isArchived), [vaultsList]);
  const archivedVaults = useMemo(
    () => includeArchived ? vaultsList.filter((v) => v.isArchived) : [],
    [vaultsList, includeArchived],
  );
  const totalBalance   = useMemo(
    () => sumAmounts(vaultsList.filter((v) => !v.isArchived), 'balance').toNumber(),
    [vaultsList],
  );

  const cardHandlers = (vault) => ({
    onEdit:              (x) => { setEditVault(x); setSaveError(''); },
    onToggleSalesChannel: (x) => toggleSalesMutation.mutate(x),
    onArchive:           (x) => archiveMutation.mutate(x.id),
    onDelete:            handleDelete,
    onClick:             (x) => setSelectedVault(x),
  });

  const hasCompany = !!companyId;

  /* الإجمالي الكلي وارد/صادر */
  const totalIn  = useMemo(() => sumAmounts(vaultsList.filter((v) => !v.isArchived), 'totalIn').toNumber(),  [vaultsList]);
  const totalOut = useMemo(() => sumAmounts(vaultsList.filter((v) => !v.isArchived), 'totalOut').toNumber(), [vaultsList]);

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
    gap: 14,
  };

  const SectionLabel = ({ label }) => (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
      color: 'var(--noorix-text-muted)', marginBottom: 10,
    }}>
      {label}
    </div>
  );

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <Toast visible={toast.visible} message={toast.message} type={toast.type}
        onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />

      {/* هيدر */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{t('vaults')}</h1>
          <p style={{ marginTop: 3, fontSize: 13, color: 'var(--noorix-text-muted)', margin: '3px 0 0' }}>
            {t('vaultsDesc')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--noorix-text-muted)', cursor: 'pointer' }}>
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
            {t('showArchived')}
          </label>
          <button type="button" className="noorix-btn-nav noorix-btn-primary"
            onClick={() => { setShowAddForm(true); setSaveError(''); }}>
            + {t('addVault')}
          </button>
        </div>
      </div>

      <DateFilterBar filter={dateFilter} />

      {!hasCompany && (
        <div className="noorix-surface-card" style={{ padding: 20, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>
          {t('pleaseSelectCompanyVaults')}
        </div>
      )}

      {hasCompany && isLoading && (
        <div style={{ color: 'var(--noorix-text-muted)', fontSize: 13, textAlign: 'center', padding: 40 }}>
          {t('loading')}
        </div>
      )}

      {hasCompany && !isLoading && (
        <>
          {/* ── بطاقة الملخص الإجمالي (للشهر/الفترة المحددة) ── */}
          {vaultsList.length > 0 && (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0,
              borderRadius: 12, border: '1px solid var(--noorix-border)',
              background: 'var(--noorix-bg-surface)', overflow: 'hidden',
            }}>
              <div style={{ gridColumn: '1 / -1', padding: '8px 20px', fontSize: 11, color: 'var(--noorix-text-muted)', borderBottom: '1px solid var(--noorix-border)' }}>
                📅 {dateFilter?.label || t('allMonths')}
              </div>
              {[
                { label: t('totalBalance'), value: totalBalance, color: totalBalance < 0 ? '#dc2626' : 'var(--noorix-text)', sign: totalBalance < 0 ? '−' : '' },
                { label: t('inbound'),      value: totalIn,      color: '#16a34a', sign: '' },
                { label: t('outbound'),     value: totalOut,     color: 'var(--noorix-text)', sign: '' },
              ].map(({ label, value, color, sign }, i) => (
                <div key={label} style={{
                  padding: '16px 20px', textAlign: 'center',
                  borderRight: i < 2 ? '1px solid var(--noorix-border)' : 'none',
                }}>
                  <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginBottom: 6, letterSpacing: '0.03em' }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--noorix-font-numbers)', color }}>
                    {sign}{fmt(Math.abs(value))}
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--noorix-text-muted)', marginRight: 3 }}>﷼</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── قنوات المبيعات ── */}
          {salesChannels.length > 0 && (
            <section>
              <SectionLabel label={t('salesChannelsEnabled', salesChannels.length)} />
              <div style={gridStyle}>
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
              <div style={gridStyle}>
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
              <div style={gridStyle}>
                {archivedVaults.map((v) => (
                  <VaultCard key={v.id} vault={v} {...cardHandlers(v)} />
                ))}
              </div>
            </section>
          )}

          {/* ── فارغة ── */}
          {vaultsList.length === 0 && (
            <div className="noorix-surface-card" style={{ padding: 48, textAlign: 'center', border: '2px dashed var(--noorix-border)' }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--noorix-bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--noorix-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
                  <rect x="2" y="6" width="20" height="12" rx="2"/>
                  <circle cx="12" cy="12" r="2.5"/>
                  <path d="M6 12h.01M18 12h.01"/>
                </svg>
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('noVaults')}</h3>
              <p style={{ margin: '0 0 18px', color: 'var(--noorix-text-muted)', fontSize: 13 }}>{t('addFirstVault')}</p>
              <button type="button" className="noorix-btn-nav noorix-btn-primary" onClick={() => setShowAddForm(true)}>{t('addVault')}</button>
            </div>
          )}
        </>
      )}

      {selectedVault && (
        <VaultTransactionsModal vault={selectedVault} companyId={companyId}
          onClose={() => setSelectedVault(null)} dateFilter={dateFilter} />
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
