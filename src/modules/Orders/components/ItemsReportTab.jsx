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

const CHART_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

function BarChart({ data, maxVal, labelKey, valueKey, color = '#2563eb' }) {
  const m = maxVal > 0 ? maxVal : 1;
  const getLabel = (r) => r[labelKey] || r.productNameEn || r.categoryNameEn || '—';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {data.slice(0, 10).map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, minWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={getLabel(r)}>
            {getLabel(r)}
          </span>
          <div style={{ flex: 1, height: 20, background: 'var(--noorix-bg-muted)', borderRadius: 4, overflow: 'hidden' }}>
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
          <span style={{ fontSize: 12, fontFamily: 'var(--noorix-font-numbers)', minWidth: 60, textAlign: 'left' }}>
            {fmt(r[valueKey], 2)}
          </span>
        </div>
      ))}
    </div>
  );
}

function PurchaseHistoryModal({ companyId, year, month, product, category, onClose, t }) {
  const isProduct = !!product;
  const id = isProduct ? (product?.id ?? product?.productId) : category?.id;
  const { data: history = [], isLoading } = isProduct
    ? useProductPurchaseHistory(companyId, id, year, month)
    : useCategoryPurchaseHistory(companyId, id, year, month);
  const title = isProduct ? (product?.productNameAr || product?.nameAr || product?.productNameEn || product?.nameEn || id) : (category?.nameAr || category?.nameEn || id);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: 'var(--noorix-bg-surface)',
          borderRadius: 14,
          maxWidth: 560,
          width: '100%',
          maxHeight: '85vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--noorix-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{t('ordersPurchaseHistory')} — {title}</h3>
          <button type="button" className="noorix-btn-nav" onClick={onClose}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--noorix-text-muted)' }}>{t('loading')}</div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--noorix-text-muted)' }}>{t('ordersNoPurchaseHistory')}</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--noorix-border)' }}>
                  <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 700 }}>{t('orderNumber')}</th>
                  <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 700 }}>{t('orderDate')}</th>
                  <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 700 }}>{t('quantity')}</th>
                  <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 700 }}>{t('unitPrice')}</th>
                  <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 700 }}>{t('total')}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--noorix-border)' }}>
                    <td style={{ padding: '8px 10px' }}>{h.orderNumber}</td>
                    <td style={{ padding: '8px 10px' }}>{formatSaudiDate(h.orderDate)}</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(h.quantity, 2)}</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(h.unitPrice, 2)}</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'var(--noorix-font-numbers)', fontWeight: 600 }}>{fmt(h.amount, 2)} ﷼</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
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
    <div style={{ display: 'grid', gap: 16 }}>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />

      <div className="noorix-print-hide" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <DateFilterBar filter={dateFilter} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={filterMode} onChange={(e) => setFilterMode(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)', fontSize: 13 }}>
            <option value="all">{t('ordersFilterAll')}</option>
            <option value="top">{t('ordersFilterTop')}</option>
            <option value="bottom">{t('ordersFilterBottom')}</option>
          </select>
          {(filterMode === 'top' || filterMode === 'bottom') && (
            <input type="number" min={1} max={50} value={filterCount} onChange={(e) => setFilterCount(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 5)))} style={{ width: 60, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--noorix-border)', fontSize: 13 }} />
          )}
          <button type="button" className="noorix-btn-nav noorix-print-hide" onClick={() => window.print()} disabled={filtered.length === 0}>{t('print')}</button>
          <button type="button" className="noorix-btn-nav noorix-print-hide" onClick={handleExportExcel} disabled={filtered.length === 0}>📥 Excel</button>
          <button type="button" className="noorix-btn-nav noorix-print-hide" onClick={handleExportPdf} disabled={filtered.length === 0}>📄 PDF</button>
        </div>
      </div>

      {/* كروت الإجمالي */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        <div style={{ padding: '14px 16px', background: 'var(--noorix-bg-muted)', borderRadius: 12, border: '1px solid var(--noorix-border)' }}>
          <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginBottom: 4 }}>{t('ordersTotalItems')}</div>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--noorix-font-numbers)' }}>{filtered.length}</div>
        </div>
        <div style={{ padding: '14px 16px', background: 'var(--noorix-bg-muted)', borderRadius: 12, border: '1px solid var(--noorix-border)' }}>
          <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginBottom: 4 }}>{t('ordersTotalQuantity')}</div>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(totals.quantity, 2)}</div>
        </div>
        <div style={{ padding: '14px 16px', background: 'var(--noorix-bg-muted)', borderRadius: 12, border: '1px solid var(--noorix-border)' }}>
          <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginBottom: 4 }}>{t('ordersTotalAmount')}</div>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--noorix-font-numbers)', color: '#16a34a' }}>{fmt(totals.amount, 2)} ﷼</div>
        </div>
      </div>

      {/* رسم بياني */}
      {filtered.length > 0 && (
        <div className="noorix-surface-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: 'var(--noorix-text-muted)' }}>
            {filterMode === 'top' ? t('ordersChartTop') : filterMode === 'bottom' ? t('ordersChartBottom') : t('ordersChartAll')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            <div>
              <div style={{ fontSize: 12, marginBottom: 8, color: 'var(--noorix-text-muted)' }}>{t('ordersChartByAmount')}</div>
              <BarChart data={filtered} maxVal={maxAmount} labelKey="productNameAr" valueKey="amount" color="#2563eb" />
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 8, color: 'var(--noorix-text-muted)' }}>{t('ordersChartByOrders')}</div>
              <BarChart data={filtered} maxVal={Math.max(...filtered.map((r) => r.orderCount ?? 0), 1)} labelKey="productNameAr" valueKey="orderCount" color="#16a34a" />
            </div>
          </div>
        </div>
      )}

      {/* جدول */}
      <div className="noorix-surface-card" style={{ overflow: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>{t('loading')}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>{t('ordersNoItemsInPeriod')}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--noorix-border)' }}>
                  <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700 }}>{t('product')}</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700 }}>{t('category')}</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700 }}>{t('unit')}</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700 }}>{t('quantity')}</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700 }}>{t('total')}</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700 }}>{t('ordersOrderCount')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.productId} style={{ borderBottom: '1px solid var(--noorix-border)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <button
                        type="button"
                        onClick={() => setHistoryModal({ product: { ...r, id: r.productId } })}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--noorix-accent-blue)', textDecoration: 'underline', fontSize: 13, fontWeight: 600 }}
                      >
                        {r.productNameAr || r.productNameEn || '—'}
                      </button>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {r.categoryId ? (
                        <button
                          type="button"
                          onClick={() => setHistoryModal({ category: { id: r.categoryId, nameAr: r.categoryNameAr, nameEn: r.categoryNameEn } })}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--noorix-accent-blue)', textDecoration: 'underline', fontSize: 13 }}
                        >
                          {r.categoryNameAr || r.categoryNameEn || '—'}
                        </button>
                      ) : (
                        <span style={{ color: 'var(--noorix-text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--noorix-text-muted)' }}>{r.unit || '—'}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(r.quantity ?? 0, 2)}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--noorix-font-numbers)', fontWeight: 600 }}>{fmt(r.amount ?? 0, 2)} ﷼</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--noorix-font-numbers)' }}>{r.orderCount ?? 0}</td>
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
