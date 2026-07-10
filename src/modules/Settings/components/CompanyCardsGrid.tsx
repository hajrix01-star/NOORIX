import React, { type KeyboardEvent, type MouseEvent } from 'react';
import { Button } from '../../../ui';
import type { SettingsCompany, SettingsMutationLike } from '../settingsTypes';
import type { CompanyUpdateVariables } from '../companyTabModel';

type CompanyCardsGridProps = {
  companies: SettingsCompany[];
  updateMutation: SettingsMutationLike<CompanyUpdateVariables>;
  onOpenEdit: (company: SettingsCompany, event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => void;
};

export function CompanyCardsGrid({ companies, updateMutation, onOpenEdit }: CompanyCardsGridProps) {
  return (
    <div className="noorix-exec-card-grid">
      {companies.map((company) => (
        <div
          key={company.id}
          role="button"
          tabIndex={0}
          onClick={(event: MouseEvent<HTMLDivElement>) => onOpenEdit(company, event)}
          onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
            if (event.key === 'Enter' || event.key === ' ') onOpenEdit(company, event);
          }}
          className={`noorix-exec-card noorix-exec-card--inbound cursor-pointer ${company.isArchived ? 'opacity-75' : ''}`}
        >
          <div className="noorix-exec-card__stripe" />
          <div className="noorix-exec-card__header">
            <div className="noorix-exec-card__icon">
              {company.logoUrl ? (
                <img src={company.logoUrl} alt="" className="w-9 h-9 rounded-[9px] object-cover" />
              ) : (
                <span className="text-noorix-muted text-[18px]">-</span>
              )}
            </div>
            <span className="noorix-exec-card__title">{company.nameAr}</span>
          </div>
          <div className="noorix-exec-card__total">
            <span className="noorix-exec-card__amount text-[18px]">{company.nameEn || company.nameAr}</span>
            <span className="noorix-exec-card__currency text-[12px]">{company.taxNumber ? `الرقم الضريبي: ${company.taxNumber}` : ''}</span>
          </div>
          <div className="noorix-exec-card__divider" />
          <div className="noorix-exec-card__footer">
            <div className="noorix-exec-card__stat">
              <span className="noorix-exec-card__stat-label">الهاتف</span>
              <span className="noorix-exec-card__stat-value">{company.phone || '-'}</span>
            </div>
            <div className="noorix-exec-card__stat">
              <span className="noorix-exec-card__stat-label">البريد</span>
              <span className="noorix-exec-card__stat-value nx-cell-ellipsis text-[11px]">{company.email || '-'}</span>
            </div>
            <div className="noorix-exec-card__stat">
              <span className="noorix-exec-card__stat-label">الحالة</span>
              <span className="noorix-exec-card__stat-value">{company.isArchived ? 'مؤرشفة' : 'نشطة'}</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 pt-2 px-[18px] pb-[14px]">
            <span className="text-[12px] text-noorix-muted">اضغط للتعديل</span>
            {company.isArchived ? (
              <Button
                type="button"
                size="sm"
                variant="primary"
                className="text-[12px] shrink-0"
                disabled={updateMutation.isPending}
                aria-label={`إعادة تفعيل الشركة ${company.nameAr || ''}`}
                onClick={(event: MouseEvent<HTMLButtonElement>) => {
                  event.stopPropagation();
                  updateMutation.mutate({ id: company.id, body: { isArchived: false } });
                }}
              >
                إعادة التفعيل
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
