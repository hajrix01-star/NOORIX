import React, { type ChangeEvent, useMemo, useState } from 'react';
import { Button, Input, SimpleTable } from '../../../ui';
import type { SimpleTableColumn } from '../../../ui';
import type { OrderSection } from '../../../types/api';
import type { ItemsManageTabController } from '../hooks/useItemsManageTab';
import { OrderConfirmModal } from './OrderConfirmModal';

export function ItemsManageTabSectionsSection({ ctrl }: { ctrl: ItemsManageTabController }) {
  const {
    t,
    companyId,
    sections,
    createSection,
    deleteSection,
  } = ctrl;

  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  async function handleAdd() {
    if (!nameAr.trim()) return;
    setBusy(true);
    try {
      await createSection.mutateAsync({ companyId, nameAr: nameAr.trim(), nameEn: nameEn.trim() || undefined });
      setNameAr('');
      setNameEn('');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    await deleteSection.mutateAsync(pendingDeleteId);
    setPendingDeleteId(null);
  }

  const sectionColumns = useMemo<SimpleTableColumn<OrderSection>[]>(
    () => [
      {
        key: 'nameAr',
        label: t('sectionNameAr'),
        render: (_value, row) => <span className="font-semibold">{row.nameAr}</span>,
      },
      {
        key: 'nameEn',
        label: t('sectionNameEn'),
        render: (_value, row) => <span className="text-noorix-muted">{row.nameEn || '-'}</span>,
      },
      {
        key: 'actions',
        label: t('actions'),
        align: 'center',
        width: 96,
        render: (_value, row) => (
          <Button
            type="button"
            size="sm"
            variant="danger"
            onClick={() => setPendingDeleteId(row.id)}
            disabled={deleteSection.isPending}
          >
            {t('delete')}
          </Button>
        ),
      },
    ],
    [t, deleteSection.isPending],
  );

  return (
    <div className="grid gap-5">
      <OrderConfirmModal
        open={!!pendingDeleteId}
        title={t('confirmDelete')}
        message={t('sectionDeleteConfirm')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        busy={deleteSection.isPending}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={confirmDelete}
      />

      <div className="noorix-surface-card p-4">
        <h4 className="m-0 mb-3 text-[15px]">+ {t('sectionAdd')}</h4>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[160px] flex-1">
            <Input
              label={`${t('sectionNameAr')} *`}
              value={nameAr}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setNameAr(event.target.value)}
              placeholder={t('sectionNameArPlaceholder')}
            />
          </div>
          <div className="min-w-[160px] flex-1">
            <Input
              label={t('sectionNameEn')}
              value={nameEn}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setNameEn(event.target.value)}
              placeholder={t('sectionNameEnPlaceholder')}
            />
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleAdd}
            disabled={busy || !nameAr.trim() || !companyId}
          >
            {busy ? t('saving') : t('add')}
          </Button>
        </div>
      </div>

      <SimpleTable
        columns={sectionColumns}
        data={sections}
        tableMinWidth={420}
        emptyMessage={t('sectionsEmpty')}
      />
    </div>
  );
}
