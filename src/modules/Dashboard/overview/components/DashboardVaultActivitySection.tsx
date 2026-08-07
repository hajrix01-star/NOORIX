import React from 'react';
import { FmtNum, SimpleTable } from '../../../../ui';
import { cn } from '../../../../ui/cn';
import type { SimpleTableColumn } from '../../../../ui/SimpleTable';
import type { DashboardVaultActivity, DashboardVaultActivityRow } from '../../../../types/api/domains/dashboard';

type Props = {
  activity: DashboardVaultActivity;
  lang: string;
  t: (key: string) => string;
};

type ActivityTableRow = DashboardVaultActivityRow & { isTotal?: boolean };

function Money({ value, className }: { value: string | number; className?: string }) {
  return (
    <span dir="ltr" className={cn('inline-flex items-baseline justify-center gap-1 nx-font-numbers font-bold', className)}>
      <FmtNum n={value} maxDecimals={1} />
      <span className="nx-sar">SR</span>
    </span>
  );
}

function ResultMoney({ value }: { value: string | number }) {
  const numeric = Number(value || 0);
  return (
    <Money
      value={numeric}
      className={numeric > 0 ? 'text-noorix-green' : numeric < 0 ? 'text-[color:var(--noorix-accent-red)]' : 'text-noorix-text'}
    />
  );
}

export function DashboardVaultActivitySection({ activity, lang, t }: Props) {
  const rows = activity.rows ?? [];
  const displayName = (row: DashboardVaultActivityRow) =>
    (lang === 'ar' ? row.nameAr : row.nameEn || row.nameAr) || t('notSpecified');
  const tableRows: ActivityTableRow[] = rows.length === 0
    ? []
    : [
        ...rows,
        {
          vaultId: '__total__',
          nameAr: t('total'),
          nameEn: t('total'),
          type: 'total',
          isArchived: false,
          inflow: activity.totalInflow,
          outflow: activity.totalOutflow,
          periodResult: activity.periodResult,
          inflowSharePct: Number(activity.totalInflow || 0) === 0 ? null : 100,
          isTotal: true,
        },
      ];
  const columns: SimpleTableColumn<ActivityTableRow>[] = [
    {
      key: 'nameAr',
      label: t('dashboardVault'),
      minWidth: 150,
      align: 'center',
      render: (_value, row) => (
        <span className="font-semibold">
          {row.isTotal ? t('total') : displayName(row)}
          {!row.isTotal && row.isArchived ? (
            <span className="ms-1 text-[11px] font-normal text-noorix-muted">({t('archived')})</span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'inflow', label: t('dashboardInflow'), numeric: true, align: 'center', minWidth: 130,
      render: (value) => <Money value={String(value ?? 0)} className="text-nx-sales" />,
    },
    {
      key: 'inflowSharePct', label: t('dashboardInflowShare'), numeric: true, align: 'center', minWidth: 115,
      render: (value) => (
        <span dir="ltr" className="nx-font-numbers font-bold">
          {value == null ? '—' : `${Number(value).toFixed(1)}%`}
        </span>
      ),
    },
    {
      key: 'outflow', label: t('dashboardOutflow'), numeric: true, align: 'center', minWidth: 130,
      render: (value) => <Money value={String(value ?? 0)} />,
    },
    {
      key: 'periodResult', label: t('dashboardPeriodResult'), numeric: true, align: 'center', minWidth: 140,
      render: (value) => <ResultMoney value={String(value ?? 0)} />,
    },
  ];

  return (
    <section className="noorix-surface-card min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-noorix-border px-4 py-4 sm:px-5">
        <div>
          <h2 className="m-0 text-[16px] font-bold text-noorix-text">{t('dashboardVaultActivityTitle')}</h2>
          <p className="m-0 mt-1 text-[12px] text-noorix-muted">{t('dashboardVaultActivityDesc')}</p>
        </div>
        <div className="grid w-full grid-cols-3 gap-2 sm:w-auto sm:min-w-[420px]">
          <div className="rounded-lg bg-noorix-bg-muted px-2 py-2 text-center">
            <div className="text-[11px] text-noorix-muted">{t('dashboardInflow')}</div>
            <Money value={activity.totalInflow} className="mt-1 text-[14px] text-nx-sales" />
          </div>
          <div className="rounded-lg bg-noorix-bg-muted px-2 py-2 text-center">
            <div className="text-[11px] text-noorix-muted">{t('dashboardOutflow')}</div>
            <Money value={activity.totalOutflow} className="mt-1 text-[14px] text-noorix-text" />
          </div>
          <div className="rounded-lg bg-noorix-bg-muted px-2 py-2 text-center">
            <div className="text-[11px] text-noorix-muted">{t('dashboardPeriodResult')}</div>
            <div className="mt-1 text-[14px]"><ResultMoney value={activity.periodResult} /></div>
          </div>
        </div>
      </div>

      <SimpleTable<ActivityTableRow>
        columns={columns}
        data={tableRows}
        tableMinWidth={720}
        compact={false}
        emptyMessage={t('dashboardNoVaultActivity')}
        frameClassName="rounded-none border-x-0 border-t-0"
        getRowClassName={(row) => row.isTotal ? 'bg-noorix-bg-muted font-bold' : undefined}
      />

      <p className="m-0 border-t border-noorix-border px-4 py-3 text-center text-[11px] text-noorix-muted sm:px-5">
        {t('dashboardVaultActivityNote')}
      </p>
    </section>
  );
}
