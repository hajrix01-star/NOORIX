import { ItemRow } from './OcrFieldRowItemParts';

export function OcrWarningStrip({ warningCount, extracted, isAr }: any) {
  if (warningCount <= 0) return null;
  return (
    <div
      className="flex items-center gap-8 text-[13px] rounded-lg py-[10px] px-[14px]"
      style={{
        background: 'var(--noorix-yellow-8)',
        border: '1px solid var(--noorix-yellow-25)',
      }}
    >
      <div>
        <div className="font-semibold" style={{ color: 'var(--noorix-accent-amber)' }}>
          {warningCount} {isAr ? 'تحذير — راجع الأرقام قبل الحفظ' : 'warning(s) — review before saving'}
        </div>
        {extracted.invoiceTotalWarning && (
          <div className="text-[12px] mt-[2px]" style={{ color: 'var(--noorix-accent-amber)' }}>
            {extracted.invoiceTotalWarning}
          </div>
        )}
      </div>
    </div>
  );
}

export function OcrLineItemsList({ t, language, activeItems, onUpdateItem, onApplySuggestion }: any) {
  if (activeItems.length === 0) return null;
  return (
    <div className="noorix-surface-card p-4">
      <div className="font-semibold text-[14px] mb-3">
        {t('ocrItems')} ({activeItems.length})
      </div>
      <div className="flex flex-col gap-2">
        {activeItems.map((item: any, i: any) => (
          <ItemRow
            key={i}
            item={item}
            index={i}
            language={language}
            t={t}
            onUpdate={onUpdateItem}
            onApplySuggestion={onApplySuggestion}
          />
        ))}
      </div>
    </div>
  );
}
