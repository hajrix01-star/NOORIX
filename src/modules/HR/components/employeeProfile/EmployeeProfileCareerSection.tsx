import { formatSaudiDate } from '../../../../utils/saudiDate';
import { Button, KebabMenu, SmartTable } from '../../../../ui';
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
            render: (value: unknown) => (
              <span className="nx-cell-ellipsis text-[13px]" title={String(value || '')}>
                {String(value || '-')}
              </span>
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
          ...(showActions
            ? [
                {
                  key: 'actions',
                  label: t('actions'),
                  kind: 'actions' as const,
                  minWidth: 72,
                  render: (_: unknown, row: CareerTableRow) =>
                    row.movementType === 'raise' ? (
                      <KebabMenu
                        ariaLabel={t('actions')}
                        items={[
                          { key: 'edit', label: t('edit'), style: { color: 'var(--noorix-accent-green)' }, onClick: () => onEditRaise?.(row) },
                          { key: 'delete', label: t('delete'), style: { color: 'var(--noorix-accent-red)' }, onClick: () => onDeleteRaise?.(row) },
                        ]}
                      />
                    ) : (
                      <span className="text-noorix-muted text-[12px]">-</span>
                    ),
                },
              ]
            : []),
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
          </div>
        )}
        renderMobileCard={(row: CareerTableRow) => (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12px] text-noorix-muted">{formatSaudiDate(row.effectiveDate || '')}</span>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-noorix-text">{row.typeLabel}</span>
                {showActions && row.movementType === 'raise' ? (
                  <KebabMenu
                    ariaLabel={t('actions')}
                    items={[
                      { key: 'edit', label: t('edit'), style: { color: 'var(--noorix-accent-green)' }, onClick: () => onEditRaise?.(row) },
                      { key: 'delete', label: t('delete'), style: { color: 'var(--noorix-accent-red)' }, onClick: () => onDeleteRaise?.(row) },
                    ]}
                  />
                ) : null}
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
          </div>
        )}
      />
    </div>
  );
}
