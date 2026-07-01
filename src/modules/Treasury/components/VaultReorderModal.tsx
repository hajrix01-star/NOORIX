/**
 * Reorder active vaults (used in sales and payment flows).)
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { Button, Modal, Badge } from '../../../ui';

export function VaultReorderModal({ open, onClose, vaultsList, onApply, isSaving }: any) {
  const { t, lang } = useTranslation();
  const [orderedIds, setOrderedIds] = useState<any[]>([]);

  const vaultById = useMemo(() => new Map(vaultsList.map((v: any) => [v.id, v])), [vaultsList]);

  useEffect(() => {
    if (open) {
      const ids = [...vaultsList]
        .filter((v: any) => v.isActive !== false && !v.isArchived)
        .sort(
          (a: any, b: any) =>
            (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
            String(a.nameAr).localeCompare(String(b.nameAr), 'ar'),
        )
        .map((v: any) => v.id);
      setOrderedIds(ids);
    }
  }, [open, vaultsList]);

  function move(i: any, dir: any) {
    const j = i + dir;
    if (j < 0 || j >= orderedIds.length) return;
    setOrderedIds((prev: any) => {
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={t('vaultReorderTitle')} size="md">
      <p className="text-[13px] text-noorix-muted mb-3 m-0">{t('vaultReorderHint')}</p>
      <ul className="flex flex-col gap-2 max-h-[min(60vh,420px)] overflow-y-auto p-0 m-0 list-none">
        {orderedIds.map((id: any, i: any) => {
          const v = vaultById.get(id);
          if (!v) return null;
          return (
            <li
              key={id}
              className="flex items-center gap-2 rounded-xl border border-noorix-border bg-noorix-bg-muted/90 px-3 py-2"
            >
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <span className="font-semibold text-[13px] text-noorix-text truncate" title={vaultDisplayName(v, lang)}>
                  {vaultDisplayName(v, lang)}
                </span>
                <div className="flex flex-wrap gap-1">
                  {(v as { isSalesChannel?: boolean }).isSalesChannel ? (
                    <Badge color="green" size="sm">
                      {t('salesChannel')}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={i === 0 || isSaving}
                  onClick={() => move(i, -1)}
                  aria-label={t('moveUp')}
                >
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={i === orderedIds.length - 1 || isSaving}
                  onClick={() => move(i, 1)}
                  aria-label={t('moveDown')}
                >
                  ↓
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-noorix-border">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
          {t('cancel')}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onApply(orderedIds)}
          disabled={isSaving || orderedIds.length === 0}
        >
          {t('saveOrder')}
        </Button>
      </div>
    </Modal>
  );
}
