import { SupplierSelect } from '../../../components/common/SupplierSelect';
import { Button } from '../../../ui';
import type {
  BatchTranslateFn,
  PurchaseBatchEntryRow,
  PurchaseBatchSupplier,
  PurchaseBatchUpdateRow,
} from '../batch/purchaseBatchTypes';

type BookmarkSize = 'compact' | 'touch' | 'none';

type BatchSupplierBookmarkButtonProps = {
  row: Pick<PurchaseBatchEntryRow, 'supplierId'>;
  bookmarkedIds: string[];
  onBookmark: (id: string) => void;
  t: BatchTranslateFn;
  size?: Exclude<BookmarkSize, 'none'>;
};

export function BatchSupplierBookmarkButton({
  row,
  bookmarkedIds,
  onBookmark,
  t,
  size = 'compact',
}: BatchSupplierBookmarkButtonProps) {
  if (!row.supplierId) return null;

  const isOn = bookmarkedIds.includes(row.supplierId);
  const title = isOn ? t('removeFromShortcuts') : t('addToShortcuts');
  const className =
    size === 'touch'
      ? `min-h-[40px] min-w-[40px] ${isOn ? 'bg-[var(--noorix-yellow-15)]' : 'bg-noorix-bg-page'}`
      : `text-[14px] w-8 h-8 min-w-8 min-h-8 rounded-md shrink-0 ${
          isOn ? 'bg-[var(--noorix-yellow-15)]' : 'bg-noorix-bg-page'
        }`;

  return (
    <Button
      type="button"
      size={size === 'touch' ? 'sm' : undefined}
      onClick={() => onBookmark(row.supplierId)}
      title={title}
      className={className}
      aria-pressed={isOn}
    >
      {isOn ? '★' : '☆'}
    </Button>
  );
}

type BatchSupplierPickInnerProps = {
  suppliers: PurchaseBatchSupplier[];
  row: Pick<PurchaseBatchEntryRow, 'supplierId'>;
  bookmarkedIds: string[];
  onBookmark: (id: string) => void;
  handleSupplierChange: (supplierId: string) => void;
  t: BatchTranslateFn;
  bookmarkSize?: BookmarkSize;
  supplierInputId?: string;
};

export function BatchSupplierPickInner({
  suppliers,
  row,
  bookmarkedIds,
  onBookmark,
  handleSupplierChange,
  t,
  bookmarkSize = 'compact',
  supplierInputId,
}: BatchSupplierPickInnerProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <SupplierSelect
          id={supplierInputId}
          suppliers={suppliers}
          value={row.supplierId}
          onChange={handleSupplierChange}
          bookmarkedIds={bookmarkedIds}
          placeholder={t('selectSupplier')}
        />
      </div>
      {bookmarkSize !== 'none' ? (
        <BatchSupplierBookmarkButton
          row={row}
          bookmarkedIds={bookmarkedIds}
          onBookmark={onBookmark}
          t={t}
          size={bookmarkSize === 'touch' ? 'touch' : 'compact'}
        />
      ) : null}
    </div>
  );
}

type BatchNetTaxReadonlyProps = {
  net: string;
  tax: string;
  variant?: 'table' | 'stack';
  t: BatchTranslateFn;
};

export function BatchNetTaxReadonly({ net, tax, variant = 'table', t }: BatchNetTaxReadonlyProps) {
  if (variant === 'stack') {
    return (
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-noorix-bg py-2 px-2.5">
        <div>
          <div className="text-[12px] text-noorix-muted mb-0.5">{t('net')}</div>
          <div className="text-[13px] font-semibold text-noorix-text nx-font-numbers">
            {net || '-'}
          </div>
        </div>
        <div>
          <div className="text-[12px] text-noorix-muted mb-0.5">{t('tax')}</div>
          <div className="text-[13px] font-semibold text-noorix-amber nx-font-numbers">
            {tax || '-'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-[11px] leading-[1.5] nx-font-numbers">
      <div className="text-noorix-muted">{net || '-'}</div>
      <div className="text-noorix-amber">{tax || '-'}</div>
    </div>
  );
}

type BatchTaxToggleButtonProps = {
  row: Pick<PurchaseBatchEntryRow, 'isTaxable'>;
  index: number;
  onUpdate: PurchaseBatchUpdateRow;
  t: BatchTranslateFn;
  density?: 'table' | 'stack';
};

export function BatchTaxToggleButton({
  row,
  index,
  onUpdate,
  t,
  density = 'table',
}: BatchTaxToggleButtonProps) {
  const active = row.isTaxable !== false;
  const title = active ? t('batchRowTaxToggleTitleOn') : t('batchRowTaxToggleTitleOff');
  const label = active ? t('batchRowTaxIncludeVat') : t('batchRowTaxExemptShort');

  if (density === 'stack') {
    return (
      <div>
        <div className="text-[11px] font-semibold text-noorix-muted mb-1">{t('taxPct')}</div>
        <Button
          type="button"
          variant="raw"
          onClick={() => onUpdate(index, 'isTaxable', !active)}
          className={`w-full min-h-[44px] text-[12px] font-bold rounded-lg border ${
            active
              ? 'border-noorix-amber bg-[var(--noorix-amber-8)] text-noorix-amber'
              : 'border-noorix-border bg-noorix-bg-page text-noorix-muted'
          }`}
          title={title}
          aria-pressed={active}
        >
          {label}
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      onClick={() => onUpdate(index, 'isTaxable', !active)}
      className={`w-full text-[11px] font-bold whitespace-nowrap py-[5px] px-1 rounded-[5px] border ${
        active
          ? 'border-noorix-amber bg-[var(--noorix-amber-8)] text-noorix-amber'
          : 'border-noorix-border bg-noorix-bg-page text-noorix-muted'
      }`}
      title={title}
      aria-pressed={active}
    >
      {label}
    </Button>
  );
}
