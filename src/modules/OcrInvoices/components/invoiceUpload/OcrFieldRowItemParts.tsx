import { Button, Input } from '../../../../ui';
import { CONFIDENCE_COLOR, STATUS_BADGE } from './ocrInvoiceUploadUtils';

export function FieldRow({ label, value, confidence, match }: { label: any; value: any; confidence?: any; match?: any }) {
  return (
    <div className="flex gap-2 border-b border-noorix-border items-start py-1.5">
      <span className="text-[13px] text-noorix-muted min-w-[100px]">{label}</span>
      <div className="flex-1 min-w-0">
        <span className="text-[14px] font-semibold text-noorix-text">{value || '—'}</span>
        {match && (
          <div className="text-[11px] mt-[2px]">
            <span
              className="py-px px-1.5 rounded"
              style={{
                background: match.status === 'auto' ? '#dcfce7' : '#fef3c7',
                color:
                  match.status === 'auto' ? 'var(--noorix-accent-green)' : 'var(--noorix-accent-amber)',
              }}
            >
              ↳ {match.nameAr} ({Math.round(match.score * 100)}%)
            </span>
          </div>
        )}
      </div>
      {confidence !== undefined && (
        <span className="text-[11px] font-bold" style={{ color: CONFIDENCE_COLOR(confidence) }}>
          {Math.round(confidence * 100)}%
        </span>
      )}
    </div>
  );
}

function EditableNumber({ value, onChange, warn }: any) {
  return (
    <Input
      type="number"
      value={value ?? ''}
      onChange={(e: any) => onChange(e.target.value)}
      step="any"
      className="w-[72px] py-[3px] px-1.5 rounded-md text-[13px] font-bold text-center"
      style={{
        border: `1px solid ${warn ? 'var(--color-noorix-amber)' : 'var(--noorix-border)'}`,
        background: warn ? 'var(--noorix-yellow-8)' : 'var(--noorix-bg-surface)',
        color: 'var(--noorix-text)',
        outline: 'none',
        fontFamily: 'inherit',
      }}
    />
  );
}

export function ItemRow({ item, index, language, t, onUpdate, onApplySuggestion }: any) {
  const match = item.itemMatch;
  const statusInfo = match
    ? (STATUS_BADGE as Record<string, (typeof STATUS_BADGE)['new']>)[String(match.status)]
    : STATUS_BADGE.new;
  const hasMathWarn = !!item.mathWarning;
  const hasPriceWarn = !!item.priceWarning;

  const displayName = [item.nameAr, item.nameEn].filter(Boolean).join(' / ') || item.name || '—';
  const sizeLabel = item.size ? `${item.size}${item.sizeUnit || ''}` : null;

  return (
    <div
      className="py-[10px] px-3 rounded-[10px]"
      style={{
        background: hasMathWarn ? 'var(--noorix-yellow-6)' : 'var(--noorix-bg-surface)',
        border: `1px solid ${hasMathWarn ? 'var(--noorix-yellow-40)' : 'var(--noorix-border)'}`,
      }}
    >
      <div className="flex gap-2 flex flex-wrap mb-2 justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[14px]">{displayName}</div>
          {sizeLabel && (
            <span className="text-[11px] font-semibold bg-noorix-bg-muted text-noorix-muted inline-block mt-[3px] py-px px-2 rounded">
              {sizeLabel}
            </span>
          )}
          {item.name && item.name !== displayName && (
            <div className="text-[11px] text-noorix-muted mt-[2px]">OCR: {item.name}</div>
          )}
          {match && (
            <div className="text-[11px] text-noorix-muted mt-[2px]">
              ↳ {match.nameAr}
              {match.nameEn ? ` / ${match.nameEn}` : ''}
              {match.hasSizes && (
                <span className="ms-1" style={{ color: 'var(--noorix-accent-violet)' }}>
                  • متعدد الأحجام
                </span>
              )}
            </div>
          )}
        </div>
        <span
          className="text-[11px] font-bold py-[3px] px-2 rounded-md shrink-0"
          style={{ background: statusInfo.bg, color: statusInfo.color }}
        >
          {language === 'ar' ? statusInfo.label.ar : statusInfo.label.en}
        </span>
      </div>

      <div className="flex items-center gap-10 flex-wrap">
        <div className="flex flex-col items-center gap-[2px]">
          <span className="text-noorix-muted text-[10px]">الكمية</span>
          <EditableNumber
            value={item.quantity}
            warn={hasMathWarn}
            onChange={(v: any) => onUpdate(index, 'quantity', v)}
          />
        </div>
        <span className="text-noorix-muted text-[13px] self-end mb-1">×</span>
        <div className="flex flex-col items-center gap-[2px]">
          <span className="text-noorix-muted text-[10px]">السعر</span>
          <EditableNumber
            value={item.unitPrice}
            warn={hasMathWarn}
            onChange={(v: any) => onUpdate(index, 'unitPrice', v)}
          />
        </div>
        <span className="text-noorix-muted text-[13px] self-end mb-1">=</span>
        <div className="flex flex-col items-center gap-[2px]">
          <span className="text-noorix-muted text-[10px]">الإجمالي</span>
          <EditableNumber
            value={item.totalPrice}
            warn={hasMathWarn}
            onChange={(v: any) => onUpdate(index, 'totalPrice', v)}
          />
        </div>
        {item.confidence != null && (
          <span
            className="text-[11px] self-end mb-1"
            style={{ color: CONFIDENCE_COLOR(item.confidence) }}
          >
            {Math.round(item.confidence * 100)}%
          </span>
        )}
      </div>

      {hasMathWarn && (
        <div
          className="flex items-center justify-between gap-2 mt-2 rounded-lg py-1.5 px-[10px]"
          style={{
            background: 'var(--noorix-yellow-12)',
            border: '1px solid var(--noorix-yellow-30)',
          }}
        >
          <div className="text-[12px]" style={{ color: 'var(--noorix-accent-amber)' }}>
            {item.mathWarning.message}
          </div>
          {(item.mathWarning.suggestedQuantity !== undefined ||
            item.mathWarning.suggestedUnitPrice !== undefined) && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onApplySuggestion(index)}
              className="whitespace-nowrap shrink-0"
            >
              تصحيح تلقائي
            </Button>
          )}
        </div>
      )}

      {hasPriceWarn && (
        <div
          className="text-[12px] rounded-lg mt-1.5 py-1.5 px-[10px]"
          style={{
            background: 'var(--noorix-blue-8)',
            border: '1px solid var(--noorix-blue-25)',
            color: 'var(--noorix-accent-blue)',
          }}
        >
          السعر المعتاد في آخر 90 يوم: <strong>
            {item.priceWarning.avg} <span className="nx-sar">SR</span>
          </strong>{' '}
          — انحراف {item.priceWarning.deviation}%
        </div>
      )}
    </div>
  );
}
