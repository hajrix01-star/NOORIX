/**
 * Sections sub-tab — إدارة أقسام الطلبات (مطبخ، بار، كاشير...)
 */
import React, { useMemo, useState } from 'react';
import { Button, Input, SimpleTable } from '../../../ui';
import type { SimpleTableColumn } from '../../../ui';

export function ItemsManageTabSectionsSection({ ctrl }: any) {
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

  async function handleDelete(id: string) {
    if (!window.confirm(t('sectionDeleteConfirm'))) return;
    await deleteSection.mutateAsync(id);
  }

  const sectionColumns = useMemo<SimpleTableColumn<any>[]>(
    () => [
      {
        key: 'nameAr',
        label: t('sectionNameAr'),
        render: (v: any) => <span className="font-semibold">{v}</span>,
      },
      {
        key: 'nameEn',
        label: t('sectionNameEn'),
        render: (v: any) => <span className="text-noorix-muted">{v || '—'}</span>,
      },
      {
        key: 'actions',
        label: t('actions'),
        align: 'center',
        width: 96,
        render: (_: any, row: any) => (
          <Button
            size="sm"
            variant="danger"
            onClick={() => handleDelete(row.id)}
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
      {/* نموذج الإضافة */}
      <div className="noorix-surface-card p-4">
        <h4 className="m-0 mb-3 text-[15px]">+ {t('sectionAdd')}</h4>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="min-w-[160px] flex-1">
            <Input
              label={`${t('sectionNameAr')} *`}
              value={nameAr}
              onChange={(e: any) => setNameAr(e.target.value)}
              placeholder={t('sectionNameArPlaceholder')}
            />
          </div>
          <div className="min-w-[160px] flex-1">
            <Input
              label={t('sectionNameEn')}
              value={nameEn}
              onChange={(e: any) => setNameEn(e.target.value)}
              placeholder={t('sectionNameEnPlaceholder')}
            />
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleAdd}
            disabled={busy || !nameAr.trim() || !companyId}
          >
            {busy ? t('saving') : t('add')}
          </Button>
        </div>
      </div>

      {/* جدول الأقسام */}
      <SimpleTable
        columns={sectionColumns}
        data={sections as any[]}
        tableMinWidth={420}
        emptyMessage={t('sectionsEmpty')}
      />
    </div>
  );
}
