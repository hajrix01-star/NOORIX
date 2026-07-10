import { formatSaudiDate } from '../../../../utils/saudiDate';
import { Button, SmartTable } from '../../../../ui';
import type { CareerTableRow } from './employeeProfileModel';

type TranslationFn = (key: string, ...args: unknown[]) => string;

type EmployeeProfileCareerSectionProps = {
  t: TranslationFn;
  careerTableRows: CareerTableRow[];
  canShowCareerActions: boolean;
  canEditRaise: boolean;
  onOpenPromotion: () => void;
  onOpenRaise: () => void;
  onEditRaise?: (row: CareerTableRow) => void;
  onDeleteRaise?: (row: CareerTableRow) => void;
};

export function EmployeeProfileCareerSection({
  t,
  careerTableRows,
  canShowCareerActions,
  canEditRaise,
  onOpenPromotion,
  onOpenRaise,
  onEditRaise,
  onDeleteRaise,
}: EmployeeProfileCareerSectionProps) {
  const showActions = !!canEditRaise;

  return (
    <div className="noorix-surface-card overflow-hidden employee-profile-layout__wide">
      <div className="nx-section-header">
        <span className="nx-section-header__title">{t('careerRecordTitle')}</span>
        <div className="nx-section-header__actions flex flex-wrap items-center gap-2">
          {canShowCareerActions ? (
            <>
              <Button size="sm" onClick={onOpenPromotion}>
                {t('movementTypePromotion')}
              </Button>
              <Button size="sm" variant="primary" onClick={onOpenRaise}>
                {t('movementTypeRaise')}
              </Button>
            </>
          ) : null}
        </div>
      </div>
      <SmartTable
        compact
        showRowNumbers
        innerPadding={8}
        columns={[
          {
            key: 'effectiveDate',
            label: t('careerEffectiveDate'),
            size: 'date',
            render: (value: unknown) => <span className="nx-cell-muted-sm">{formatSaudiDate(String(value || ''))}</span>,
          },
          {
            key: 'typeLabel',
            label: t('movementTypeLabel'),
            kind: 'status',
          },
          {
            key: 'changeSummary',
            label: t('careerChangeSummary'),
            size: 'name',
            render: (value: unknown, row: CareerTableRow) => (
              <div className="flex flex-col gap-1.5">
                <span className="nx-cell-ellipsis text-[13px]" title={String(value || '')}>
                  {String(value || '-')}
                </span>
                {showActions && row.movementType === 'raise' ? (
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Button size="sm" className="h-6 px-2" variant="ghost" onClick={() => onEditRaise?.(row)}>{t('edit')}</Button>
                    <Button size="sm" className="h-6 px-2" variant="danger" onClick={() => onDeleteRaise?.(row)}>{t('delete')}</Button>
                  </span>
                ) : null}
              </div>
            ),
          },
          {
            key: 'notes',
            label: t('invoiceNotesColumn'),
            size: 'name',
            render: (value: unknown) => (
              <span className="nx-cell-ellipsis" title={String(value || '')}>
                {String(value || '-')}
              </span>
            ),
          },
        ]}
        data={careerTableRows}
        total={careerTableRows.length}
        page={1}
        pageSize={50}
        emptyMessage={t('noDataInPeriod')}
        renderCompactRow={(row: CareerTableRow) => (
          <div>
            <div className="nx-cr__line1">
              <span className="nx-cr__name">{row.typeLabel}</span>
              <span className="nx-cr__meta">{formatSaudiDate(row.effectiveDate || '')}</span>
            </div>
            <div className="nx-cr__line2">
              <div className="nx-cr__line2-start">
                <span className="nx-cr__sub">{row.changeSummary || '-'}</span>
              </div>
            </div>
            {showActions && row.movementType === 'raise' ? (
              <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                <Button size="sm" className="h-6 px-2" variant="ghost" onClick={() => onEditRaise?.(row)}>{t('edit')}</Button>
                <Button size="sm" className="h-6 px-2" variant="danger" onClick={() => onDeleteRaise?.(row)}>{t('delete')}</Button>
              </div>
            ) : null}
          </div>
        )}
        renderMobileCard={(row: CareerTableRow) => (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12px] text-noorix-muted">{formatSaudiDate(row.effectiveDate || '')}</span>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-noorix-text">{row.typeLabel}</span>
              </div>
            </div>
            <div>
              <div className="nx-mc__stat-label">{t('careerChangeSummary')}</div>
              <div className="text-[13px] text-noorix-text break-words">{row.changeSummary || '-'}</div>
            </div>
            <div>
              <div className="nx-mc__stat-label">{t('invoiceNotesColumn')}</div>
              <div className="text-[12px] text-noorix-muted break-words">{row.notes || '-'}</div>
            </div>
            {showActions && row.movementType === 'raise' ? (
              <div className="flex flex-wrap justify-end gap-1.5 border-t border-noorix-border pt-2">
                <Button size="sm" className="h-6 px-2" variant="ghost" onClick={() => onEditRaise?.(row)}>{t('edit')}</Button>
                <Button size="sm" className="h-6 px-2" variant="danger" onClick={() => onDeleteRaise?.(row)}>{t('delete')}</Button>
              </div>
            ) : null}
          </div>
        )}
      />
    </div>
  );
}
