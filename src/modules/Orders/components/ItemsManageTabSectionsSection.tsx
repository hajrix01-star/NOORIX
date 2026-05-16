/**
 * Sections sub-tab — إدارة أقسام الطلبات (مطبخ، بار، كاشير...)
 */
import React, { useState } from 'react';
import { Button, Input } from '../../../ui';

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
      <div className="noorix-surface-card overflow-auto">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="border-b-2 border-noorix-border">
              <th className="font-bold text-right py-[10px] px-4">{t('sectionNameAr')}</th>
              <th className="font-bold text-right py-[10px] px-4">{t('sectionNameEn')}</th>
              <th className="text-center font-bold py-[10px] px-4 w-20">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {(sections as any[]).map((s: any) => (
              <tr key={s.id} className="border-b border-noorix-border">
                <td className="py-[10px] px-4 font-semibold">{s.nameAr}</td>
                <td className="py-[10px] px-4 text-noorix-muted">{s.nameEn || '—'}</td>
                <td className="py-[10px] px-4 text-center">
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(s.id)}
                    disabled={deleteSection.isPending}
                  >
                    {t('delete')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(sections as any[]).length === 0 && (
          <div className="text-center text-noorix-muted p-8 text-[14px]">{t('sectionsEmpty')}</div>
        )}
      </div>
    </div>
  );
}
