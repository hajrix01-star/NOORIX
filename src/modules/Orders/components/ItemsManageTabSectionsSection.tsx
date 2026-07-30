import React, { type ChangeEvent, useMemo, useState } from 'react';
import { AdaptiveSheet, Button, DialogActions, Input, SimpleTable } from '../../../ui';
import type { SimpleTableColumn } from '../../../ui';
import { useToast } from '../../../context/ToastContext';
import type { OrderSection } from '../../../types/api';
import type { ItemsManageTabController } from '../hooks/useItemsManageTab';
import { OrderConfirmModal } from './OrderConfirmModal';

type SectionForm = {
  id?: string;
  nameAr: string;
  nameEn: string;
};

export function ItemsManageTabSectionsSection({ ctrl }: { ctrl: ItemsManageTabController }) {
  const {
    t,
    companyId,
    sections,
    createSection,
    updateSection,
    deleteSection,
  } = ctrl;
  const { showToast } = useToast();

  const [form, setForm] = useState<SectionForm | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const editing = Boolean(form?.id);
  const saving = editing ? updateSection.isPending : createSection.isPending;

  function openCreateForm() {
    setForm({ nameAr: '', nameEn: '' });
  }

  function openEditForm(section: OrderSection) {
    setForm({
      id: section.id,
      nameAr: section.nameAr,
      nameEn: section.nameEn || '',
    });
  }

  function closeForm() {
    if (saving) return;
    setForm(null);
  }

  async function handleSave() {
    if (!form?.nameAr.trim()) {
      showToast(t('ordersSectionNameRequired'), 'error');
      return;
    }
    const body = {
      nameAr: form.nameAr.trim(),
      nameEn: form.nameEn.trim() || undefined,
    };
    try {
      if (form.id) {
        await updateSection.mutateAsync({ id: form.id, body });
        showToast(t('ordersSectionUpdated'), 'success');
      } else {
        await createSection.mutateAsync({ companyId, ...body });
        showToast(t('ordersSectionAdded'), 'success');
      }
      setForm(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t(editing ? 'updateFailed' : 'addFailed'), 'error');
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
        width: 160,
        render: (_value, row) => (
          <div className="flex items-center justify-center gap-2">
            <Button type="button" size="sm" onClick={() => openEditForm(row)}>
              {t('edit')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="danger"
              onClick={() => setPendingDeleteId(row.id)}
              disabled={deleteSection.isPending}
            >
              {t('delete')}
            </Button>
          </div>
        ),
      },
    ],
    [t, deleteSection.isPending],
  );

  return (
    <div className="grid gap-4">
      <AdaptiveSheet
        open={form !== null}
        onClose={closeForm}
        title={editing ? t('ordersEditSection') : t('sectionAdd')}
        size="sm"
        side="start"
        footer={(
          <DialogActions
            actions={[
              { key: 'cancel', label: t('cancel'), role: 'cancel', disabled: saving, onClick: closeForm },
              { key: 'save', label: t('save'), role: 'save', loading: saving, disabled: saving, onClick: handleSave },
            ]}
          />
        )}
      >
        <div className="flex flex-col gap-4">
          <Input
            label={`${t('sectionNameAr')} *`}
            value={form?.nameAr || ''}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setForm((current) => (current ? { ...current, nameAr: event.target.value } : current))
            }
            placeholder={t('sectionNameArPlaceholder')}
            autoFocus
          />
          <Input
            label={t('sectionNameEn')}
            value={form?.nameEn || ''}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setForm((current) => (current ? { ...current, nameEn: event.target.value } : current))
            }
            placeholder={t('sectionNameEnPlaceholder')}
          />
        </div>
      </AdaptiveSheet>

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

      <div className="noorix-surface-card flex items-center justify-between gap-2 p-3">
        <Button type="button" variant="primary" size="sm" onClick={openCreateForm}>
          + {t('sectionAdd')}
        </Button>
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
