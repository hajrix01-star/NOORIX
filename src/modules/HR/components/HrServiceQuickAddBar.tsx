/**
 * HrServiceQuickAddBar — اختصارات إضافة خدمة موظف بنوع مُحدَّد مسبقاً
 */
import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button } from '../../../ui';
import {
  HR_SERVICE_QUICK_ADD,
  HR_SERVICE_CATEGORY_LABEL_KEYS,
} from '../constants/employeeHrServiceCategories';

type HrServiceQuickAddBarProps = {
  onSelectCategory: (category: string) => void;
  /** إخفاء تسمية القسم (مثلاً داخل ملف الموظف حيث العنوان واضح) */
  hideLabel?: boolean;
  className?: string;
};

export function HrServiceQuickAddBar({ onSelectCategory, hideLabel = false, className = '' }: HrServiceQuickAddBarProps) {
  const { t } = useTranslation();

  return (
    <div className={`flex flex-col gap-2 ${className}`.trim()}>
      {!hideLabel && (
        <span className="text-[12px] font-semibold text-noorix-muted">{t('hrServiceQuickAdd')}</span>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {HR_SERVICE_QUICK_ADD.map((cat) => (
          <Button
            key={cat}
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-9 shrink-0 border border-noorix-border bg-noorix-bg-muted/50 hover:bg-noorix-surface"
            onClick={() => onSelectCategory(cat)}
          >
            + {t(HR_SERVICE_CATEGORY_LABEL_KEYS[cat])}
          </Button>
        ))}
      </div>
    </div>
  );
}
