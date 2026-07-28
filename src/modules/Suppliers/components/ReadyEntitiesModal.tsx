import React, { useState, type ChangeEvent } from 'react';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { useApiQuery } from '../../../hooks/useApiQuery';
import { useDebouncedValue } from '../../../ui';
import { useTranslation } from '../../../i18n/useTranslation';
import { useToast } from '../../../context/ToastContext';
import {
  addSupplierDirectoryEntry,
  getSupplierDirectory,
} from '../../../services/api';
import { supplierKeys } from '../../../services/queryKeys';
import { Button, Input, Modal } from '../../../ui';
import type {
  SupplierDirectoryEntryRecord,
  SupplierDirectoryResult,
} from '../supplierTypes';

export type ReadyEntitiesModalProps = {
  companyId: string;
  open: boolean;
  onClose: () => void;
};

function actionLabel(
  entry: SupplierDirectoryEntryRecord,
  t: (key: string, ...args: string[]) => string,
) {
  if (entry.status === 'linked') return t('readyEntitiesAdded');
  if (entry.status === 'existing') return t('readyEntitiesLinkExisting');
  if (entry.status === 'ambiguous') return t('readyEntitiesNeedsReview');
  return t('readyEntitiesAdd');
}

export function ReadyEntitiesModal({
  companyId,
  open,
  onClose,
}: ReadyEntitiesModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 250);
  const query = useApiQuery<SupplierDirectoryResult>({
    queryKey: supplierKeys.directory(companyId, debouncedSearch),
    queryFn: () => getSupplierDirectory(companyId, debouncedSearch || undefined),
    enabled: open && Boolean(companyId),
    fallbackMessage: t('readyEntitiesLoadFailed'),
  });
  const addEntry = useApiMutation({
    mutationFn: (code: string) => addSupplierDirectoryEntry(companyId, code),
    invalidateQueries: [
      supplierKeys.byCompany(companyId),
      supplierKeys.directoryByCompany(companyId),
    ],
    showErrorToast: false,
  });

  function handleAdd(entry: SupplierDirectoryEntryRecord) {
    addEntry.mutate(entry.code, {
      onSuccess: () => {
        showToast(
          entry.status === 'existing'
            ? t('readyEntitiesLinkedSuccess', entry.nameAr)
            : t('readyEntitiesAddedSuccess', entry.nameAr),
          'success',
        );
      },
      onError: (error) => showToast(error.message || t('addFailed'), 'error'),
    });
  }

  const items = query.data?.items ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('readyEntitiesTitle')}
      size="xl"
    >
      <div className="grid gap-4">
        <div className="rounded-xl border border-noorix-border bg-noorix-bg-muted p-3 text-[12px] text-noorix-muted">
          {t('readyEntitiesSafetyHint')}
        </div>

        <Input
          autoFocus
          type="search"
          value={search}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
          placeholder={t('readyEntitiesSearchPlaceholder')}
        />

        {query.isLoading && (
          <p className="m-0 py-8 text-center text-[13px] text-noorix-muted">{t('loading')}</p>
        )}

        {query.isError && (
          <div className="rounded-xl border border-noorix-red bg-noorix-red/10 p-4 text-[13px] text-noorix-red">
            {query.error.message || t('readyEntitiesLoadFailed')}
          </div>
        )}

        {!query.isLoading && !query.isError && items.length === 0 && (
          <div className="rounded-xl border border-noorix-border p-8 text-center text-[13px] text-noorix-muted">
            {t('readyEntitiesNoResults')}
          </div>
        )}

        <div className="grid gap-3">
          {items.map((entry) => {
            const isPending = addEntry.isPending && addEntry.variables === entry.code;
            const disabled = entry.status === 'linked'
              || entry.status === 'ambiguous'
              || addEntry.isPending;
            return (
              <article
                key={entry.code}
                className="grid gap-3 rounded-xl border border-noorix-border bg-white p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-[14px] text-noorix-text">{entry.nameAr}</strong>
                    <span className="rounded-full bg-noorix-bg-muted px-2 py-1 text-[11px] text-noorix-muted">
                      {t(`readyEntityType_${entry.entityType}`)}
                    </span>
                    <span className="rounded-full bg-noorix-green/10 px-2 py-1 text-[11px] text-noorix-green">
                      {entry.defaultCategoryCode} · {entry.category?.nameAr ?? t('readyEntitiesCategoryOnAdd')}
                    </span>
                  </div>
                  {entry.nameEn && (
                    <p className="m-0 mt-1 text-[12px] text-noorix-muted" dir="ltr">
                      {entry.nameEn}
                    </p>
                  )}
                  {entry.aliases.length > 0 && (
                    <p className="m-0 mt-2 text-[11px] text-noorix-muted">
                      {t('readyEntitiesAliases')}: {entry.aliases.join('، ')}
                    </p>
                  )}
                  {entry.existingSupplier && entry.status !== 'linked' && (
                    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                      {t('readyEntitiesCurrentName')}: <strong>{entry.existingSupplier.nameAr}</strong>
                      {' · '}
                      {t('readyEntitiesCanonicalName')}: <strong>{entry.nameAr}</strong>
                    </div>
                  )}
                  <p className="m-0 mt-2 text-[11px] text-noorix-muted">
                    {entry.isTaxRegistered
                      ? t('readyEntitiesTaxable')
                      : t('readyEntitiesGovernmentNonTax')}
                    {' · '}
                    {entry.supplierInvoiceNumberRequired
                      ? t('readyEntitiesInvoiceRequired')
                      : t('readyEntitiesInvoiceOptional')}
                  </p>
                </div>
                <Button
                  variant={entry.status === 'linked' ? 'default' : 'primary'}
                  disabled={disabled}
                  onClick={() => handleAdd(entry)}
                >
                  {isPending ? t('saving') : actionLabel(entry, t)}
                </Button>
              </article>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

export default ReadyEntitiesModal;
