import React from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { Button } from '../../../../ui';

export function CatalogTypeSegment({
  value,
  onChange,
}: {
  value: 'order' | 'sale';
  onChange: (v: 'order' | 'sale') => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="inline-flex p-1 gap-0.5 rounded-xl border border-noorix-border bg-noorix-bg-muted/50"
      role="tablist"
      aria-label={t('ordersCatalogTab')}
    >
      {(['order', 'sale'] as const).map((id) => (
        <Button
          key={id}
          type="button"
          variant="raw"
          size="auto"
          role="tab"
          aria-selected={value === id}
          onClick={() => onChange(id)}
          className={`rounded-lg px-4 py-2 text-[13px] transition-colors ${
            value === id
              ? 'bg-noorix-surface font-bold text-noorix-text shadow-sm ring-1 ring-noorix-border'
              : 'font-medium text-noorix-muted hover:text-noorix-text'
          }`}
        >
          {id === 'order' ? t('ordersProducts') : t('salesProducts')}
        </Button>
      ))}
    </div>
  );
}
