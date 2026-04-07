/**
 * ReportsScreen — التقرير العام (ربح وخسارة شهري)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PERMISSIONS } from '../../constants/permissions';
import { useTranslation } from '../../i18n/useTranslation';
import { exportTableToPdf, exportToExcel } from '../../utils/exportUtils';
import { useReportsGeneralProfitLoss } from '../../hooks/useReports';
import ReportsDetailModal from './ReportsDetailModal';
import PeriodAnalyticsStrip from './PeriodAnalyticsStrip';
import { Button, Input } from '../../ui';
import {
  EN_MONTHS,
  CARD_COLORS,
  PERCENT_COLOR,
  amountText,
  moneyText,
  percentText,
  displayLabel,
  getContextAmount,
  getContextPercent,
  getRowTone,
  buildFlatRows,
  buildVisibleRows,
  buildExportRows,
} from './reportHelpers';

const MONTH_NAMES_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTH_NAMES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function ReportsScreen() {
  const { activeCompanyId, companies, userPermissions } = useApp();
  const canPeriodAnalytics = (userPermissions || []).includes(PERMISSIONS.REPORTS_READ);
  const { t, lang } = useTranslation();
  const currentYear = new Date().getUTCFullYear();
  const [year, setYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [detailState, setDetailState] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState({
    sales: false,
    purchases: false,
    expenses: false,
  });
  const company = companies?.find((item) => item.id === activeCompanyId);
  const companyName = lang === 'en' ? (company?.nameEn || company?.nameAr || '') : (company?.nameAr || company?.nameEn || '');

  const { data: report, isLoading, error } = useReportsGeneralProfitLoss({
    companyId: activeCompanyId,
    year,
  });

  const flatRows = useMemo(() => buildFlatRows(report, collapsedGroups), [report, collapsedGroups]);
  const visibleRows = useMemo(() => buildVisibleRows(flatRows, collapsedGroups), [flatRows, collapsedGroups]);
  const exportRows = useMemo(() => buildExportRows(report, lang, t, selectedMonth ? Number(selectedMonth) : null), [report, lang, t, selectedMonth]);
  const yearOptions = useMemo(() => Array.from({ length: 6 }, (_, index) => currentYear - index), [currentYear]);
  const selectedMonthNumber = selectedMonth ? Number(selectedMonth) : null;

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 700);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 700);
    window.addEventListener('resize', handler, { passive: true });
    return () => window.removeEventListener('resize', handler);
  }, []);

  function toggleGroup(collapseKey) {
    setCollapsedGroups((prev) => ({ ...prev, [collapseKey]: !prev[collapseKey] }));
  }

  function getCardValue(key) {
    if (!report) return '0';
    if (!selectedMonthNumber) return report.cards[key] || '0';
    if (key === 'grossProfit' || key === 'netProfit') {
      return report.summaryRows.find((row) => row.key === key)?.months[selectedMonthNumber - 1] || '0';
    }
    return report.groups.find((row) => row.key === key)?.months[selectedMonthNumber - 1] || '0';
  }

  function getCardProfitPercent(key) {
    if (!report || (key !== 'grossProfit' && key !== 'netProfit')) return null;
    const sales = Number(getCardValue('sales') || 0);
    if (!sales || sales < 0.0000001) return null;
    const profit = Number(getCardValue(key) || 0);
    return ((profit / sales) * 100).toFixed(1);
  }

  function handleExportExcel() {
    exportToExcel(exportRows, `general-profit-loss-${year}${selectedMonthNumber ? `-m${selectedMonthNumber}` : ''}.xlsx`);
  }

  function handleExportPdf() {
    exportTableToPdf({
      title: `${companyName || t('reports')} - ${t('reportGeneral')} - ${year}${selectedMonthNumber ? ` - ${EN_MONTHS[selectedMonthNumber - 1]}` : ''}`,
      filename: `general-profit-loss-${year}${selectedMonthNumber ? `-m${selectedMonthNumber}` : ''}.pdf`,
      data: exportRows,
    });
  }

  function handlePrint() {
    const printRows = buildFlatRows(report, {});
    const head = `${selectedMonthNumber ? `<th>${(t('selectedMonth') || '').replace(/</g, '&lt;')}</th><th>${(t('reportSalesShare') || '').replace(/</g, '&lt;')}</th>` : ''}${EN_MONTHS.map((month) => `<th>${month}</th>`).join('')}<th>${(t('reportAnnualTotal') || '').replace(/</g, '&lt;')}</th><th>${(t('reportSalesShare') || '').replace(/</g, '&lt;')}</th>`;
    const body = printRows.map((row) => {
      const firstCell = (displayLabel(row, lang) || '').replace(/</g, '&lt;');
      const contextCells = selectedMonthNumber ? `<td>${amountText(getContextAmount(row, selectedMonthNumber))}</td><td>${percentText(getContextPercent(row, selectedMonthNumber))}</td>` : '';
      const monthsCells = (row.months ?? []).map((value) => `<td>${amountText(value)}</td>`).join('');
      return `<tr><td>${firstCell}</td>${contextCells}${monthsCells}<td>${amountText(row.total)}</td><td>${percentText(row.percentOfSalesYear)}</td></tr>`;
    }).join('');
    const html = `<!DOCTYPE html><html dir="${lang === 'en' ? 'ltr' : 'rtl'}" lang="${lang}"><head><meta charset="utf-8"><title>${(t('reportGeneral') || '').replace(/</g, '&lt;')}</title><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet"><style>@page{size:A4 landscape;margin:12mm}body{font-family:'Cairo',Arial,sans-serif;padding:20px;color:#111;line-height:1.6}table{width:100%;border-collapse:collapse;font-size:14px}th,td{border:1px solid #d5d7da;padding:6px 8px;text-align:right}th{background:#2563eb;color:#fff;font-size:13px}h1{margin:0 0 6px;font-size:24px}.sub{margin:0 0 18px;color:#555}</style></head><body><h1>${(companyName || t('reports')).replace(/</g, '&lt;')}</h1><p class="sub">${(t('reportGeneral') || '').replace(/</g, '&lt;')} - ${year}${selectedMonthNumber ? ` - ${EN_MONTHS[selectedMonthNumber - 1]}` : ''}</p><table><thead><tr><th>${(t('reportItem') || '').replace(/</g, '&lt;')}</th>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = () => setTimeout(() => win.print(), 300);
  }

  return (
    <div className="flex flex-col gap-4">
      <ReportsDetailModal state={detailState} onClose={() => setDetailState(null)} companyId={activeCompanyId} year={year} t={t} lang={lang} />

      <div className="flex flex-col gap-4">
      <div className="nx-page-header">
        <div className="flex-1 min-w-0">
          <h2 className="font-bold m-0 text-[18px]">{t('reportGeneral')}</h2>
        </div>
        <div className="flex items-center flex-wrap gap-2 flex-[0_1_auto]">
          <Input type="select" label={t('reportYear')} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {yearOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </Input>
          {!isMobile && (
            <Input type="select" label={t('reportMonth')} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
              <option value="">{t('allMonths')}</option>
              {EN_MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
            </Input>
          )}
          <div className="nx-toolbar">
            <Button onClick={handleExportExcel} disabled={!report}>{t('exportExcel')}</Button>
            <Button onClick={handleExportPdf} disabled={!report}>{t('exportPdf')}</Button>
            <Button onClick={handlePrint} disabled={!report}>{t('print')}</Button>
          </div>
        </div>
      </div>

      {!activeCompanyId && (
        <div className="noorix-surface-card p-5 text-center text-noorix-muted">
          {t('pleaseSelectCompany')}
        </div>
      )}

      {activeCompanyId && (
        <>
          <div className="noorix-surface-card p-4 text-noorix-muted text-[13px]">
            {t('reportClickHint')}
            {selectedMonthNumber && <div className="mt-2">{t('reportFocusedMonthDesc')}</div>}
          </div>

          <PeriodAnalyticsStrip
            companyId={activeCompanyId}
            year={year}
            month={selectedMonthNumber}
            enabled={canPeriodAnalytics}
          />

          {report && (
            <div className="grid gap-3 mt-1" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              {[
                { key: 'sales', label: selectedMonthNumber ? `${(lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN)[selectedMonthNumber - 1]} — ${t('revenueGroup')}` : t('annualSales') },
                { key: 'purchases', label: selectedMonthNumber ? `${(lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN)[selectedMonthNumber - 1]} — ${t('purchasesGroup')}` : t('annualPurchases') },
                { key: 'expenses', label: selectedMonthNumber ? `${(lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN)[selectedMonthNumber - 1]} — ${t('expensesGroup')}` : t('annualExpenses') },
                { key: 'grossProfit', label: t('annualGrossProfit') },
                { key: 'netProfit', label: t('annualNetProfit') },
              ].map((card) => {
                const profitPct = (card.key === 'grossProfit' || card.key === 'netProfit') ? getCardProfitPercent(card.key) : null;
                const val = Number(getCardValue(card.key) || 0);
                const isProfitCard = card.key === 'grossProfit' || card.key === 'netProfit';
                const c = CARD_COLORS[card.key];
                const accent = isProfitCard ? (val >= 0 ? c.accent : c.accentLoss) : c.accent;
                return (
                  <div
                    key={card.key}
                    style={{
                      borderRadius: 14,
                      border: '1px solid var(--noorix-border)',
                      background: 'var(--noorix-bg-surface)',
                      overflow: 'hidden',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    }}
                  >
                    <div style={{ height: 3, background: accent }} />
                    <div className="p-4 bg-noorix-surface">
                      <div style={{ fontSize: 12, color: accent, marginBottom: 8, fontWeight: 700 }}>{card.label}</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: accent, fontFamily: 'var(--noorix-font-numbers)' }}>
                        {moneyText(getCardValue(card.key))}
                      </div>
                      {profitPct != null && (
                        <div style={{ fontSize: 12, color: accent, marginTop: 6, opacity: 0.9 }}>
                          {t('reportProfitMargin')}: {profitPct}%
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isLoading && (
            <div className="noorix-surface-card text-center text-noorix-muted p-6">
              {t('loading')}
            </div>
          )}

          {error && (
            <div className="noorix-surface-card p-5 text-noorix-red" style={{ background: 'var(--noorix-red-8)' }}>
              {error.message}
            </div>
          )}

          {!isLoading && !error && report && flatRows.length === 0 && (
            <div className="noorix-surface-card text-center text-noorix-muted p-6">
              {t('reportNoData')}
            </div>
          )}

          {!isLoading && !error && report && visibleRows.length > 0 && (
            <div className="max-w-[min(100%,1400px)] mx-auto">
              <div className="noorix-surface-card overflow-hidden rounded-xl p-0" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                {isMobile && (
                  <div className="nx-tab-bar overflow-x-auto flex-nowrap border-b border-noorix-border">
                    <Button type="button" className={`nx-tab-btn${!selectedMonth ? ' nx-tab-btn--active' : ''}`} onClick={() => setSelectedMonth('')}>{t('allMonths')}</Button>
                    {(lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN).map((name, index) => (
                      <Button key={index} type="button" className={`nx-tab-btn${selectedMonthNumber === index + 1 ? ' nx-tab-btn--active' : ''}`} onClick={() => setSelectedMonth(String(index + 1))}>{name}</Button>
                    ))}
                  </div>
                )}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: isMobile ? (selectedMonthNumber ? 300 : 220) : (selectedMonthNumber ? 1280 : 1200), borderCollapse: 'collapse', tableLayout: isMobile ? 'auto' : 'fixed' }}>
                    <colgroup>
                      <col style={{ width: isMobile ? 120 : 200 }} />
                      {selectedMonthNumber && <col style={{ width: isMobile ? undefined : 72 }} />}
                      {!isMobile && (report?.months ?? []).map((m) => <col key={m.index} style={{ width: 72 }} />)}
                      <col style={{ width: isMobile ? 100 : 110 }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'right', padding: isMobile ? '6px 8px' : '8px 12px', borderBottom: '1px solid var(--noorix-border)', position: 'sticky', [lang === 'en' ? 'left' : 'right']: 0, background: 'var(--noorix-bg-surface)', zIndex: 2, fontSize: isMobile ? 11 : 13, fontWeight: 700, fontFamily: 'var(--noorix-font-primary)', color: 'var(--noorix-text)', width: isMobile ? 120 : 200, minWidth: isMobile ? 120 : 200, maxWidth: isMobile ? 120 : 300 }}>{t('reportItem')}</th>
                        {selectedMonthNumber && (
                          <th style={{ textAlign: 'center', padding: '8px 12px', borderBottom: '1px solid var(--noorix-border)', background: 'var(--noorix-blue-6)' }}>{(lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN)[selectedMonthNumber - 1]}</th>
                        )}
                        {!isMobile && (report?.months ?? []).map((month) => (
                          <th key={month.index} style={{ textAlign: 'center', padding: '8px 12px', borderBottom: '1px solid var(--noorix-border)', whiteSpace: 'nowrap', background: selectedMonthNumber === month.index ? 'var(--noorix-blue-10)' : undefined }}>{month.label}</th>
                        ))}
                        <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '1px solid var(--noorix-border)', background: 'var(--noorix-table-header-bg)', borderInlineStart: '2px solid var(--noorix-navy-12)', fontWeight: 800 }}>{t('reportAnnualTotal')}</th>
                      </tr>
                    </thead>
                  <tbody>
                    {visibleRows.map((row) => {
                      const isGroup = row.rowType === 'group';
                      const isCategory = row.rowType === 'category';
                      const isSummary = row.rowType === 'summary';
                      const canOpenItem = row.rowType === 'item';
                      const collapseKey = isGroup ? row.groupKey : row.collapseKey;
                      const isCollapsed = !!collapseKey && !!collapsedGroups[collapseKey];
                      const canCollapse = isGroup || isCategory;
                      const indent = (row.depth || 0) * 18;
                      const rowTone = getRowTone(row);
                      return (
                        <tr
                          key={`${row.groupKey}-${row.itemKey || row.rowType}-${row.depth ?? 0}`}
                          className="report-table-row"
                          style={{
                            background: rowTone.bg,
                            borderTop: rowTone.borderTop || undefined,
                          }}
                        >
                          <td style={{ padding: isMobile ? '5px 8px' : '6px 12px', borderBottom: '1px solid var(--noorix-border)', position: 'sticky', [lang === 'en' ? 'left' : 'right']: 0, background: rowTone.stickyBg, fontSize: isMobile ? 11 : 13, fontFamily: 'var(--noorix-font-primary)', lineHeight: 1.35, width: isMobile ? 120 : 200, minWidth: isMobile ? 120 : 200, maxWidth: isMobile ? 120 : 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {canCollapse ? (
                              <Button
                                onClick={() => toggleGroup(collapseKey)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  width: '100%',
                                  minWidth: 0,
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  paddingInlineStart: indent,
                                  cursor: 'pointer',
                                  color: rowTone.accent,
                                  fontWeight: isCategory ? 800 : 900,
                                  fontSize: 13,
                                  fontFamily: 'var(--noorix-font-primary)',
                                  textAlign: lang === 'en' ? 'left' : 'right',
                                }}
                                title={`${displayLabel(row, lang)} — ${isCollapsed ? (t('expand') || 'توسيع') : (t('collapse') || 'طي')}`}
                              >
                                <span style={{ fontSize: 13, width: 14, flexShrink: 0, textAlign: 'center', fontFamily: 'var(--noorix-font-primary)' }}>{isCollapsed ? '▸' : '▾'}</span>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayLabel(row, lang)}</span>
                              </Button>
                            ) : (
                              <Button
                                onClick={() => canOpenItem && setDetailState({ month: selectedMonthNumber, groupKey: row.groupKey, itemKey: row.itemKey, showTrend: true })}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  width: '100%',
                                  minWidth: 0,
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  paddingInlineStart: indent + (row.rowType === 'item' ? 22 : 0),
                                  cursor: canOpenItem ? 'pointer' : 'default',
                                  color: isSummary ? rowTone.accent : (row.groupKey === 'purchases' || row.groupKey === 'expenses' ? rowTone.accent : 'var(--noorix-text)'),
                                  fontWeight: isSummary ? 800 : 500,
                                  fontSize: 13,
                                  fontFamily: 'var(--noorix-font-primary)',
                                  textAlign: lang === 'en' ? 'left' : 'right',
                                }}
                                title={canOpenItem ? `${displayLabel(row, lang)} — ${t('reportOpenTrend')}` : displayLabel(row, lang)}
                              >
                                {row.rowType === 'item' && <span style={{ width: 10, flexShrink: 0, color: 'var(--noorix-text-muted)', fontFamily: 'var(--noorix-font-primary)' }}>•</span>}
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayLabel(row, lang)}</span>
                              </Button>
                            )}
                          </td>

                          {selectedMonthNumber && (
                            <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--noorix-border)', textAlign: 'center', background: `${row.groupKey === 'purchases' ? 'var(--noorix-red-7)' : row.groupKey === 'expenses' ? 'var(--noorix-red-7)' : 'var(--noorix-blue-4)'}`, fontWeight: 700, fontFamily: 'var(--noorix-font-numbers)', color: isSummary ? (Number(getContextAmount(row, selectedMonthNumber) || 0) >= 0 ? 'var(--noorix-accent-blue)' : 'var(--noorix-accent-red)') : (row.groupKey === 'purchases' || row.groupKey === 'expenses' ? rowTone.accent : 'inherit') }}>
                              <Button
                                onClick={() => setDetailState({ month: selectedMonthNumber, groupKey: row.groupKey, itemKey: row.itemKey, showTrend: row.rowType === 'item' })}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'block', width: '100%', padding: 0 }}
                              >
                                <div>{amountText(getContextAmount(row, selectedMonthNumber))}</div>
                                <div style={{ fontSize: 11, marginTop: 1, color: PERCENT_COLOR }}>{percentText(getContextPercent(row, selectedMonthNumber))}</div>
                              </Button>
                            </td>
                          )}

                          {!isMobile && (row.months ?? []).map((value, index) => (
                            <td key={`${row.groupKey}-${index}`} style={{ padding: '6px 12px', borderBottom: '1px solid var(--noorix-border)', textAlign: 'center', background: selectedMonthNumber === index + 1 ? 'var(--noorix-blue-6)' : undefined }}>
                              <Button
                                onClick={() => setDetailState({ month: index + 1, groupKey: row.groupKey, itemKey: row.itemKey, showTrend: row.rowType === 'item' })}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'block',
                                  width: '100%',
                                  padding: 0,
                                  color: isSummary ? (Number(value || 0) >= 0 ? 'var(--noorix-accent-blue)' : 'var(--noorix-accent-red)') : (Number(value || 0) < 0 ? 'var(--noorix-accent-red)' : (row.groupKey === 'purchases' || row.groupKey === 'expenses' ? rowTone.accent : 'var(--noorix-text)')),
                                  fontWeight: isSummary || isGroup || isCategory ? 800 : 600,
                                  fontFamily: 'var(--noorix-font-numbers)',
                                }}
                              >
                                <div>{amountText(value)}</div>
                                <div style={{ fontSize: 11, marginTop: 1, color: PERCENT_COLOR }}>{percentText(row.percentOfSalesMonths?.[index])}</div>
                              </Button>
                            </td>
                          ))}

                          <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--noorix-border)', textAlign: 'right', fontWeight: 800, fontFamily: 'var(--noorix-font-numbers)', color: isSummary ? (Number(row.total || 0) >= 0 ? 'var(--noorix-accent-blue)' : 'var(--noorix-accent-red)') : (row.groupKey === 'purchases' || row.groupKey === 'expenses' ? rowTone.accent : 'inherit'), background: 'var(--noorix-table-header-bg)', borderInlineStart: '2px solid var(--noorix-navy-12)' }}>
                            <div>{amountText(row.total)}</div>
                            <div style={{ fontSize: 11, marginTop: 1, color: PERCENT_COLOR }}>{percentText(row.percentOfSalesYear)}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}
