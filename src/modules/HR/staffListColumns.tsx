import type { NavigateFunction } from 'react-router-dom';
import { Badge, Button, FmtNum } from '../../ui';
import { formatSaudiDate } from '../../utils/saudiDate';
import { employeeDisplayName } from '../../utils/employeeDisplayName';
import type { HrEmployee } from '../../types/api';

export type HrStaffTableRow = HrEmployee & {
  totalSalary?: number | null;
  terminationReason?: string;
  terminationClause?: string;
  terminationDate?: string;
};

type StaffListColumnsParams = {
  t: (key: string) => string;
  lang: string;
  statusMap: Parameters<typeof Badge.fromStatus>[1];
  viewMode: string;
  navigate: NavigateFunction;
};

export function buildStaffListColumns({
  t,
  lang,
  statusMap,
  viewMode,
  navigate,
}: StaffListColumnsParams) {
  return [
    {
      key: 'employeeSerial',
      label: t('employeeSerial'),
      sortable: true,
      width: 120,
      render: (value: unknown) => (
        <span className="nx-cell-num nx-cell-bold nx-cell-ellipsis text-[13px]" title={String(value || '')}>
          {String(value || '—')}
        </span>
      ),
    },
    {
      key: 'name',
      label: t('employeeName'),
      sortable: true,
      width: 200,
      render: (_: unknown, row: HrStaffTableRow) => (
        <Button
          variant="raw"
          size="auto"
          className="nx-cell-bold text-[13px] text-noorix-blue hover:underline cursor-pointer p-0 bg-transparent text-start"
          onClick={() => navigate(`/hr/employee/${row.id}`)}
        >
          {employeeDisplayName(row, lang)}
        </Button>
      ),
    },
    {
      key: 'jobTitle',
      label: t('jobTitle'),
      sortable: true,
      width: 170,
      align: 'center',
      render: (value: unknown) => <span className="nx-cell-muted block text-center">{String(value || '—')}</span>,
    },
    {
      key: 'joinDate',
      label: t('joinDate'),
      sortable: true,
      width: 125,
      render: (value: unknown) => <span className="nx-cell-muted-sm">{formatSaudiDate(String(value || ''))}</span>,
    },
    {
      key: 'totalSalary',
      label: t('totalSalary'),
      numeric: true,
      sortable: true,
      width: 140,
      align: 'center',
      render: (_: unknown, row: HrStaffTableRow) =>
        Number.isFinite(Number(row.totalSalary)) ? (
          <FmtNum n={Number(row.totalSalary)} className="nx-cell-num block text-center text-[13px]" />
        ) : (
          <span className="nx-cell-muted">—</span>
        ),
    },
    {
      key: 'status',
      label: t('status'),
      width: 110,
      render: (value: unknown) => <Badge {...Badge.fromStatus(String(value || ''), statusMap)} size="sm" />,
    },
    ...(viewMode === 'terminated' || viewMode === 'archived'
      ? [
          {
            key: 'terminationReason',
            label: t('terminationReason'),
            width: 190,
            render: (value: unknown) => <span className="nx-cell-muted">{String(value || '—')}</span>,
          },
          {
            key: 'terminationClause',
            label: t('terminationClause'),
            width: 140,
            render: (value: unknown) => <span className="nx-cell-muted">{String(value || '—')}</span>,
          },
        ]
      : []),
  ];
}
