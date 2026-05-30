import { formatSaudiDate } from '../../../../utils/saudiDate';
import { Button, KebabMenu, SmartTable } from '../../../../ui';

export function EmployeeProfileCareerSection({
  t,
  careerTableRows,
  canShowCareerActions,
  canEditRaise,
  onOpenPromotion,
  onOpenRaise,
  onEditRaise,
  onDeleteRaise,
}: any) {
  const showActions = !!canEditRaise;

  return (
    <div className="noorix-surface-card overflow-hidden employee-profile-layout__wide">
      <div className="nx-section-header">
        <span className="nx-section-header__title">{t('careerRecordTitle')}</span>
        <div className="nx-section-header__actions flex flex-wrap items-center gap-2">
          {canShowCareerActions && (
            <>
              <Button size="sm" onClick={onOpenPromotion}>
                {t('movementTypePromotion')}
              </Button>
              <Button size="sm" variant="primary" onClick={onOpenRaise}>
                {t('movementTypeRaise')}
              </Button>
            </>
          )}
        </div>
      </div>
      <SmartTable
        compact
        showRowNumbers
        rowNumberWidth="1%"
        innerPadding={8}
        columns={[
          {
            key: 'effectiveDate',
            label: t('careerEffectiveDate'),
            width: showActions ? '12%' : '14%',
            render: (v: any) => <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span>,
          },
          {
            key: 'typeLabel',
            label: t('movementTypeLabel'),
            width: showActions ? '14%' : '16%',
            render: (v: any) => v,
          },
          {
            key: 'changeSummary',
            label: t('careerChangeSummary'),
            width: showActions ? '28%' : '32%',
            render: (v: any) => (
              <span className="nx-cell-ellipsis text-[13px]" title={v || ''}>
                {v || '—'}
              </span>
            ),
          },
          {
            key: 'notes',
            label: t('invoiceNotesColumn'),
            width: showActions ? '30%' : '36%',
            render: (v: any) => (
              <span className="nx-cell-ellipsis" title={v || ''}>
                {v || '—'}
              </span>
            ),
          },
          ...(showActions
            ? [
                {
                  key: 'actions',
                  label: t('actions'),
                  width: '10%',
                  minWidth: 72,
                  render: (_: unknown, row: { id?: string; movementType?: string }) =>
                    row.movementType === 'raise' ? (
                      <KebabMenu
                        ariaLabel={t('actions')}
                        items={[
                          {
                            key: 'edit',
                            label: t('edit'),
                            style: { color: 'var(--noorix-accent-green)' },
                            onClick: () => onEditRaise?.(row),
                          },
                          {
                            key: 'delete',
                            label: t('delete'),
                            style: { color: 'var(--noorix-accent-red)' },
                            onClick: () => onDeleteRaise?.(row),
                          },
                        ]}
                      />
                    ) : (
                      <span className="text-noorix-muted text-[12px]">—</span>
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
        renderCompactRow={(row: any) => (
          <div>
            <div className="nx-cr__line1">
              <span className="nx-cr__name">{row.typeLabel}</span>
              <span className="nx-cr__meta">{formatSaudiDate(row.effectiveDate)}</span>
            </div>
            <div className="nx-cr__line2">
              <div className="nx-cr__line2-start">
                <span className="nx-cr__sub">{row.changeSummary || '—'}</span>
              </div>
            </div>
          </div>
        )}
        renderMobileCard={(row: any) => (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12px] text-noorix-muted">{formatSaudiDate(row.effectiveDate)}</span>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-noorix-text">{row.typeLabel}</span>
                {showActions && row.movementType === 'raise' ? (
                  <KebabMenu
                    ariaLabel={t('actions')}
                    items={[
                      {
                        key: 'edit',
                        label: t('edit'),
                        style: { color: 'var(--noorix-accent-green)' },
                        onClick: () => onEditRaise?.(row),
                      },
                      {
                        key: 'delete',
                        label: t('delete'),
                        style: { color: 'var(--noorix-accent-red)' },
                        onClick: () => onDeleteRaise?.(row),
                      },
                    ]}
                  />
                ) : null}
              </div>
            </div>
            <div>
              <div className="nx-mc__stat-label">{t('careerChangeSummary')}</div>
              <div className="text-[13px] text-noorix-text break-words">{row.changeSummary || '—'}</div>
            </div>
            <div>
              <div className="nx-mc__stat-label">{t('invoiceNotesColumn')}</div>
              <div className="text-[12px] text-noorix-muted break-words">{row.notes || '—'}</div>
            </div>
          </div>
        )}
      />
    </div>
  );
}
