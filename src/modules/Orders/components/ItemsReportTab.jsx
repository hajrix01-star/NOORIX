/**
 * ItemsReportTab — تقارير الأصناف والفئات
 * فلاتر، رسوم بيانية، تاريخ الشراء، تصدير
 */
import React, { useState, useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useOrdersItemsReport, useProductPurchaseHistory, useCategoryPurchaseHistory } from '../../../hooks/useOrders';
import { fmt } from '../../../utils/format';
import { formatSaudiDate } from '../../../utils/saudiDate';
import DateFilterBar from '../../../shared/components/DateFilterBar';
import { exportToExcel, exportTableToPdf } from '../../../utils/exportUtils';
import Toast from '../../../components/Toast';
import { Button, Input, AdaptiveSheet } from '../../../ui';

const CHART_COLORS = ['var(--noorix-accent-blue)', 'var(--noorix-accent-green)', 'var(--noorix-accent-amber)', 'var(--noorix-accent-red)', 'var(--noorix-accent-violet)', '#0891b2'];

function BarChart({ data, maxVal, labelKey, valueKey, color = 'var(--noorix-accent-blue)' }) {
  const m = maxVal > 0 ? maxVal : 1;
  const getLabel = (r) => r[labelKey] || r.productNameEn || r.categoryNameEn || '—';
  return (
    <div className="flex flex-col gap-1.5">
      {data.slice(0, 10).map((r, i) => (
        <div key={i} className="flex items-center gap-8">
          <span className="text-[12px] truncate" style={{ minWidth: 80 }} title={getLabel(r)}>
            {getLabel(r)}
          </span>
          <div className="flex-1 min-w-0 bg-noorix-bg-muted overflow-hidden" style={{ height: 20, borderRadius: 4 }}>
            <div
              style={{
                width: `${Math.min(100, (Number(r[valueKey]) / m) * 100)}%`,
                height: '100%',
                background: color,
                borderRadius: 4,
                transition: 'width 300ms',
              }}
            />
          </div>
          <span className="text-[12px]" style={{ fontFamily: 'var(--noorix-font-numbers)', minWidth: 60, textAlign: 'left' }}>
            {fmt(r[valueKey], 2)}
          </span>
        </div>
      ))}
    </div>
  );
}

function PurchaseHistoryModal({ companyId, year, month, product, category, onClose, t }) {
  const isProduct = !!product;
  const productId = product?.id ?? product?.productId;
  const categoryId = category?.id;

  const { data: productHistory = [], isLoading: productLoading } = useProductPurchaseHistory(
    companyId, productId, year, month, isProduct,
  );
  const { data: categoryHistory = [], isLoading: categoryLoading } = useCategoryPurchaseHistory(
    companyId, categoryId, year, month, !isProduct,
  );

  const history = isProduct ? productHistory : categoryHistory;
  const isLoading = isProduct ? productLoading : categoryLoading;
  const title = isProduct ? (product?.productNameAr || product?.nameAr || product?.productNameEn || product?.nameEn || productId) : (category?.nameAr || category?.nameEn || categoryId);

  return (
    <AdaptiveSheet
      open
      onClose={onClose}
      title={`${t('ordersPurchaseHistory')} — ${title}`}
      size="md"
      side="start"
      className="orders-purchase-history-drawer"
    >
      {isLoading ? (
        <div className="text-center text-noorix-muted" style={{ padding: 40 }}>{t('loading')}</div>
      ) : history.length === 0 ? (
        <div className="text-center text-noorix-muted" style={{ padding: 40 }}>{t('ordersNoPurchaseHistory')}</div>
      ) : (
        <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--noorix-border)' }}>
              <th className="font-bold" style={{ textAlign: 'right', padding: '8px 10px' }}>{t('orderNumber')}</th>
              <th className="font-bold" style={{ textAlign: 'right', padding: '8px 10px' }}>{t('orderDate')}</th>
              <th className="font-bold" style={{ textAlign: 'right', padding: '8px 10px' }}>{t('quantity')}</th>
              <th className="font-bold" style={{ textAlign: 'right', padding: '8px 10px' }}>{t('unitPrice')}</th>
              <th className="font-bold" style={{ textAlign: 'right', padding: '8px 10px' }}>{t('total')}</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h, i) => (
              <tr key={i} className="border-b border-noorix-border">
                <td style={{ padding: '8px 10px' }}>{h.orderNumber}</td>
                <td style={{ padding: '8px 10px' }}>{formatSaudiDate(h.orderDate)}</td>
                <td style={{ padding: '8px 10px' }} className="nx-cell-num">{fmt(h.quantity, 2)}</td>
                <td style={{ padding: '8px 10px' }} className="nx-cell-num">{fmt(h.unitPrice, 2)}</td>
                <td style={{ padding: '8px 10px' }} className="nx-cell-num nx-cell-num--green">{fmt(h.amount, 2)} ﷼</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdaptiveSheet>
  );
}

export function ItemsReportTab({ companyId, year, month, dateFilter }) {
  const { t } = useTranslation();
  const [filterMode, setFilterMode] = useState('all'); // all | top | bottom
  const [filterCount, setFilterCount] = useState(10);
  const [historyModal, setHistoryModal] = useState(null); // { product } or { category }
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  const { data: report = [], isLoading } = useOrdersItemsReport(companyId, year, month);

  const filtered = useMemo(() => {
    if (filterMode === 'all') return report;
    const sorted = [...report].sort((a, b) => (b.orderCount ?? 0) - (a.orderCount ?? 0));
    if (filterMode === 'top') return sorted.slice(0, filterCount);
    return sorted.slice(-filterCount).reverse();
  }, [report, filterMode, filterCount]);

  const totals = useMemo(() => {
    const qty = filtered.reduce((s, r) => s + Number(r.quantity ?? 0), 0);
    const amt = filtered.reduce((s, r) => s + Number(r.amount ?? 0), 0);
    return { quantity: qty, amount: amt };
  }, [filtered]);

  const maxAmount = useMemo(() => Math.max(...filtered.map((r) => Number(r.amount ?? 0)), 1), [filtered]);

  const handleExportExcel = async () => {
    try {
      const rows = filtered.map((r) => ({
        [t('product')]: r.productNameAr || r.productNameEn || '—',
        [t('category')]: r.categoryNameAr || r.categoryNameEn || '—',
        [t('unit')]: r.unit || '—',
        [t('quantity')]: fmt(r.quantity ?? 0, 2),
        [t('total')]: fmt(r.amount ?? 0, 2),
        [t('ordersOrderCount')]: r.orderCount ?? 0,
      }));
      await exportToExcel(rows, `orders-items-report-${year}-${month}.xlsx`);
      setToast({ visible: true, message: t('exportSuccess'), type: 'success' });
    } catch (e) {
      setToast({ visible: true, message: e?.message || t('exportFailed'), type: 'error' });
    }
  };

  const handleExportPdf = async () => {
    try {
      const cols = [t('product'), t('category'), t('quantity'), t('total'), t('ordersOrderCount')];
      const data = filtered.map((r) => ({
        [t('product')]: r.productNameAr || r.productNameEn || '—',
        [t('category')]: r.categoryNameAr || r.categoryNameEn || '—',
        [t('quantity')]: fmt(r.quantity ?? 0, 2),
        [t('total')]: fmt(r.amount ?? 0, 2),
        [t('ordersOrderCount')]: r.orderCount ?? 0,
      }));
      await exportTableToPdf({ columns: cols, data, title: `${t('ordersItemsReportTab')} — ${year}/${month}`, filename: `orders-items-${year}-${month}.pdf` });
      setToast({ visible: true, message: t('exportSuccess'), type: 'success' });
    } catch (e) {
      setToast({ visible: true, message: e?.message || t('exportFailed'), type: 'error' });
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />

      <div className="noorix-print-hide nx-page-header nx-page-header--filter-row">
        <DateFilterBar filter={dateFilter} />
        <div className="nx-toolbar">
          <Input
            type="select"
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
          >
            <option value="all">{t('ordersFilterAll')}</option>
            <option value="top">{t('ordersFilterTop')}</option>
            <option value="bottom">{t('ordersFilterBottom')}</option>
          </Input>
          {(filterMode === 'top' || filterMode === 'bottom') && (
            <Input
              type="number"
              min={1}
              max={50}
              value={filterCount}
              onChange={(e) => setFilterCount(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 5)))}
              style={{ width: 80 }}
            />
          )}
          <Button type="button" className="noorix-print-hide" onClick={() => window.print()} disabled={filtered.length === 0}>{t('print')}</Button>
          <Button type="button" className="noorix-print-hide" onClick={handleExportExcel} disabled={filtered.length === 0}>Excel</Button>
          <Button type="button" className="noorix-print-hide" onClick={handleExportPdf} disabled={filtered.length === 0}>PDF</Button>
        </div>
      </div>

      {/* كروت الإجمالي */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
        <div className="bg-noorix-bg-muted rounded-xl border border-noorix-border" style={{ padding: '14px 16px' }}>
          <div className="text-[11px] text-noorix-muted mb-1">{t('ordersTotalItems')}</div>
          <div className="text-[18px] font-extrabold" style={{ fontFamily: 'var(--noorix-font-numbers)' }}>{filtered.length}</div>
        </div>
        <div className="bg-noorix-bg-muted rounded-xl border border-noorix-border" style={{ padding: '14px 16px' }}>
          <div className="text-[11px] text-noorix-muted mb-1">{t('ordersTotalQuantity')}</div>
          <div className="text-[18px] font-extrabold" style={{ fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(totals.quantity, 2)}</div>
        </div>
        <div className="bg-noorix-bg-muted rounded-xl border border-noorix-border" style={{ padding: '14px 16px' }}>
          <div className="text-[11px] text-noorix-muted mb-1">{t('ordersTotalAmount')}</div>
          <div className="text-[18px] font-extrabold text-noorix-green" style={{ fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(totals.amount, 2)} ﷼</div>
        </div>
      </div>

      {/* رسم بياني */}
      {filtered.length > 0 && (
        <div className="noorix-surface-card p-5">
          <div className="text-[13px] font-bold mb-4 text-noorix-muted">
            {filterMode === 'top' ? t('ordersChartTop') : filterMode === 'bottom' ? t('ordersChartBottom') : t('ordersChartAll')}
          </div>
          <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            <div>
              <div className="text-[12px] mb-2 text-noorix-muted">{t('ordersChartByAmount')}</div>
              <BarChart data={filtered} maxVal={maxAmount} labelKey="productNameAr" valueKey="amount" color="#2563eb" />
            </div>
            <div>
              <div className="text-[12px] mb-2 text-noorix-muted">{t('ordersChartByOrders')}</div>
              <BarChart data={filtered} maxVal={Math.max(...filtered.map((r) => r.orderCount ?? 0), 1)} labelKey="productNameAr" valueKey="orderCount" color="#16a34a" />
            </div>
          </div>
        </div>
      )}

      {/* جدول */}
      <div className="noorix-surface-card overflow-auto">
        {isLoading ? (
          <div className="text-center text-noorix-muted" style={{ padding: 40 }}>{t('loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-noorix-muted" style={{ padding: 40 }}>{t('ordersNoItemsInPeriod')}</div>
        ) : (
            <div className="overflow-auto">
            <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--noorix-border)' }}>
                  <th className="font-bold" style={{ textAlign: 'right', padding: '10px 12px' }}>{t('product')}</th>
                  <th className="font-bold" style={{ textAlign: 'right', padding: '10px 12px' }}>{t('category')}</th>
                  <th className="font-bold" style={{ textAlign: 'right', padding: '10px 12px' }}>{t('unit')}</th>
                  <th className="font-bold" style={{ textAlign: 'right', padding: '10px 12px' }}>{t('quantity')}</th>
                  <th className="font-bold" style={{ textAlign: 'right', padding: '10px 12px' }}>{t('total')}</th>
                  <th className="font-bold" style={{ textAlign: 'right', padding: '10px 12px' }}>{t('ordersOrderCount')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.productId} className="border-b border-noorix-border">
                    <td style={{ padding: '10px 12px' }}>
                      <Button
                        variant="ghost"
                        type="button"
                        onClick={() => setHistoryModal({ product: { ...r, id: r.productId } })}
                        className="cursor-pointer text-[13px] font-semibold"
                        style={{ background: 'none', border: 'none', color: 'var(--noorix-accent-blue)', textDecoration: 'underline' }}
                      >
                        {r.productNameAr || r.productNameEn || '—'}
                      </Button>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {r.categoryId ? (
                        <Button
                          variant="ghost"
                          type="button"
                          onClick={() => setHistoryModal({ category: { id: r.categoryId, nameAr: r.categoryNameAr, nameEn: r.categoryNameEn } })}
                          className="cursor-pointer text-[13px]"
                          style={{ background: 'none', border: 'none', color: 'var(--noorix-accent-blue)', textDecoration: 'underline' }}
                        >
                          {r.categoryNameAr || r.categoryNameEn || '—'}
                        </Button>
                      ) : (
                        <span className="nx-cell-muted">—</span>
                      )}
                    </td>
                    <td className="nx-cell-muted" style={{ padding: '10px 12px' }}>{r.unit || '—'}</td>
                    <td className="nx-cell-num" style={{ padding: '10px 12px' }}>{fmt(r.quantity ?? 0, 2)}</td>
                    <td className="nx-cell-num nx-cell-num--green" style={{ padding: '10px 12px' }}>{fmt(r.amount ?? 0, 2)} ﷼</td>
                    <td className="nx-cell-num" style={{ padding: '10px 12px' }}>{r.orderCount ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {historyModal && (
        <PurchaseHistoryModal
          companyId={companyId}
          year={year}
          month={month}
          product={historyModal.product}
          category={historyModal.category}
          onClose={() => setHistoryModal(null)}
          t={t}
        />
      )}
    </div>
  );
}
