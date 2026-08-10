import React, { useMemo, useState } from 'react';
import {
  getDashboardLedgerReconciliation,
  unwrapApiData,
  type DashboardLedgerReconciliation,
} from '../../../../services/api';
import {
  DialogActions,
  FmtNum,
  Modal,
  SmartTable,
  Spinner,
  type SmartTableColumn,
} from '../../../../ui';

type Props = {
  open: boolean;
  onClose: () => void;
  companyId: string;
  startDate: string;
  endDate: string;
};

type ReconciliationRow = DashboardLedgerReconciliation['dimensions'][number];

const LABELS: Record<string, string> = {
  sales: 'الإيرادات',
  purchases: 'المشتريات',
  expenses: 'المصاريف والرواتب',
  operatingCosts: 'تكلفة التشغيل',
  operatingResult: 'النتيجة التشغيلية',
};

function Money({ value, className = '' }: { value: string; className?: string }) {
  return <><FmtNum n={Number(value)} className={`nx-cell-num ${className}`} /> <span className="nx-sar">ر.س</span></>;
}

export function DashboardLedgerReconciliationModal({
  open,
  onClose,
  companyId,
  startDate,
  endDate,
}: Props) {
  const [data, setData] = useState<DashboardLedgerReconciliation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const columns = useMemo<SmartTableColumn<ReconciliationRow>[]>(() => [
    {
      key: 'key',
      label: 'البند',
      size: 'name',
      render: (value) => <span className="font-medium">{LABELS[String(value)] ?? String(value)}</span>,
    },
    {
      key: 'currentValue',
      label: 'الحالي',
      size: 'money-md',
      numeric: true,
      render: (value) => <Money value={String(value)} />,
    },
    {
      key: 'ledgerValue',
      label: 'السجل',
      size: 'money-md',
      numeric: true,
      render: (value) => <Money value={String(value)} />,
    },
    {
      key: 'delta',
      label: 'الفرق',
      size: 'money-md',
      numeric: true,
      render: (value, row) => <Money value={String(value)} className={row.matches ? 'nx-cell-num--green' : 'text-red-600'} />,
    },
  ], []);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(unwrapApiData(
        await getDashboardLedgerReconciliation({ companyId, startDate, endDate }),
        'تعذر تشغيل فحص المطابقة',
      ));
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'تعذر تشغيل فحص المطابقة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="فحص مطابقة السجل المحاسبي"
      size="lg"
      footer={(
        <DialogActions
          actions={[
            { key: 'close', label: 'إغلاق', role: 'close', onClick: onClose },
            { key: 'run', label: 'تشغيل الفحص', role: 'primary', onClick: run, loading },
          ]}
        />
      )}
    >
      <p className="mb-4 text-sm text-noorix-muted">
        قراءة فقط للفترة {startDate} إلى {endDate}. لا يغيّر أي فاتورة أو قيد.
      </p>

      {!data && !loading && !error ? (
        <p className="text-sm text-noorix-muted">شغّل الفحص لمقارنة الأرقام الحالية بالسجل المحاسبي المصنف.</p>
      ) : null}
      {loading ? <div className="flex justify-center py-8"><Spinner /></div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {data ? (
        <div className="space-y-4">
          <div className={`rounded-xl border p-3 text-sm ${data.readyForCutover
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-amber-200 bg-amber-50 text-amber-900'}`}
          >
            {data.readyForCutover
              ? 'الأرقام متطابقة وجاهزة للمراجعة قبل التحويل.'
              : 'يوجد فرق أو قيود غير مصنفة؛ لا يتم تحويل لوحة التحكم قبل تفسيره.'}
          </div>

          <SmartTable
            columns={columns}
            data={data.dimensions}
            total={data.dimensions.length}
            pageSize={data.dimensions.length || 1}
            keyExtractor={(row) => row.key}
            emptyMessage="لا توجد بنود للفترة المحددة."
            mobileMode="table"
            tableId="dashboard-ledger-reconciliation"
          />

          <p className="text-xs text-noorix-muted">
            قيود غير مصنفة: {data.ledger.coverage.unclassifiedRowCount}
            {' · '}
            نسبة التغطية: {data.ledger.coverage.classifiedPct ?? 0}%
          </p>
        </div>
      ) : null}
    </Modal>
  );
}