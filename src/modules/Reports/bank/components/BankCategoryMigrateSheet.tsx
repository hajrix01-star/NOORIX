import React from 'react';
import { Button, AdaptiveSheet } from '../../../../ui';
import type { MigrateGroup } from '../hooks/useBankCategoryTreeData';

export function BankCategoryMigrateSheet({
  open,
  migrating,
  onClose,
  onRun,
  activeFlatCount,
  groupedForMigrate,
  t,
}: {
  open: boolean;
  migrating: boolean;
  onClose: () => void;
  onRun: () => void;
  activeFlatCount: number;
  groupedForMigrate: MigrateGroup[];
  t: (k: string, ...args: string[]) => string;
}) {
  return (
    <AdaptiveSheet
      open={open}
      onClose={() => !migrating && onClose()}
      title={t('bankTreeMigrateTitle')}
      size="md"
      side="start"
      className="bank-tree-migrate-drawer"
      closeOnBackdrop={!migrating}
      footer={
        <>
          <Button variant="ghost" disabled={migrating} onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button variant="primary" disabled={migrating} onClick={onRun}>
            {migrating ? t('loading') : t('bankTreeMigrateRun')}
          </Button>
        </>
      }
    >
      <p className="text-[13px] text-noorix-muted">
        {t('bankTreeMigrateBody', String(activeFlatCount), String(groupedForMigrate.length))}
      </p>
      <div className="overflow-auto grid gap-2 mt-3 rounded-lg max-h-[200px]">
        {groupedForMigrate.map((g, i) => (
          <div key={i} className="p-2 rounded-lg bg-noorix-bg-muted text-[12px]">
            <strong>{g.categoryName}</strong> — {g.keywords.slice(0, 6).join(', ')}
            {g.keywords.length > 6 ? '…' : ''}
          </div>
        ))}
      </div>
    </AdaptiveSheet>
  );
}
