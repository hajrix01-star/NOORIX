/**
 * ReportsScreen — التقرير العام (ربح وخسارة شهري)
 */
import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { exportTableToPdf, exportToExcel } from '../../utils/exportUtils';
import { openPrintWindow } from '../../utils/printUtils';
import { useReportsGeneralProfitLoss } from '../../hooks/useReports';
import ReportsDetailModal from './ReportsDetailModal';
import { Button, Input, ScreenTabs, ScreenShell, cn, MetricCard } from '../../ui';
import { useIsNarrow700 } from '../../hooks/useMediaQuery';
import { KPI_CARD_SPARKLINE_COLORS } from '../../constants/kpiCardTheme';
import {
  EN_MONTHS,
  PERCENT_COLOR,
  amountText,
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
  const { activeCompanyId, companies } = useApp();
  const { t, lang } = useTranslation();
  const currentYear = new Date().getUTCFullYear();
  const [year, setYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [detailState, setDetailState] = useState<any>(null);
  const [collapsedGroups, setCollapsedGroups] = useState({
    sales: false,
    purchases: false,
    expenses: false,
  });
  const company = companies?.find((item: any) => item.id === activeCompanyId);
  const companyName = lang === 'en' ? (company?.nameEn || company?.nameAr || '') : (company?.nameAr || company?.nameEn || '');

  const { data: report, isLoading, error, isFetching, isPlaceholderData } = useReportsGeneralProfitLoss({
    companyId: activeCompanyId,
    year,
  });

  const flatRows = useMemo(() => buildFlatRows(report, collapsedGroups), [report, collapsedGroups]);
  const visibleRows = useMemo(() => buildVisibleRows(flatRows, collapsedGroups), [flatRows, collapsedGroups]);
  const exportRows = useMemo(() => buildExportRows(report, lang, t, selectedMonth ? Number(selectedMonth) : null), [report, lang, t, selectedMonth]);
  const yearOptions = useMemo(() => Array.from({ length: 6 }, (_: any, index: any) => currentYear - index), [currentYear]);
  const selectedMonthNumber = selectedMonth ? Number(selectedMonth) : null;

  const mobileMonthTabItems = useMemo(() => {
    const names = lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN;
    return [
      { id: '', label: t('allMonths') },
      ...names.map((name: any, i: any) => ({ id: String(i + 1), label: name })),
    ];
  }, [t, lang]);

  const isMobile = useIsNarrow700();

  function toggleGroup(collapseKey: any) {
    setCollapsedGroups((prev: any) => ({ ...prev, [collapseKey]: !prev[collapseKey] }));
  }

  function getCardValue(key: any) {
    if (!report) return '0';
    if (!selectedMonthNumber) return report.cards[key] || '0';
    if (key === 'grossProfit' || key === 'netProfit') {
      return report.summaryRows.find((row: any) => row.key === key)?.months[selectedMonthNumber - 1] || '0';
    }
    return report.groups.find((row: any) => row.key === key)?.months[selectedMonthNumber - 1] || '0';
  }

  function getCardProfitPercent(key: any) {
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
      companyName: companyName || t('reports'),
      title: `${t('reportGeneral')} — ${year}${selectedMonthNumber ? ` — ${EN_MONTHS[selectedMonthNumber - 1]}` : ''}`,
      filename: `general-profit-loss-${year}${selectedMonthNumber ? `-m${selectedMonthNumber}` : ''}.pdf`,
      landscape: true,
      data: exportRows,
    });
  }

  function handlePrint() {
    const printRows = buildFlatRows(report, {});
    const head = `${selectedMonthNumber ? `<th>${(t('selectedMonth') || '').replace(/</g, '&lt;')}</th><th>${(t('reportSalesShare') || '').replace(/</g, '&lt;')}</th>` : ''}${EN_MONTHS.map((month: any) => `<th>${month}</th>`).join('')}<th>${(t('reportAnnualTotal') || '').replace(/</g, '&lt;')}</th><th>${(t('reportSalesShare') || '').replace(/</g, '&lt;')}</th>`;
    const bodyRows = printRows.map((row: any) => {
      const firstCell = (displayLabel(row, lang) || '').replace(/</g, '&lt;');
      const contextCells = selectedMonthNumber ? `<td>${amountText(getContextAmount(row, selectedMonthNumber))}</td><td>${percentText(getContextPercent(row, selectedMonthNumber))}</td>` : '';
      const monthsCells = (row.months ?? []).map((value: any) => `<td>${amountText(value)}</td>`).join('');
      return `<tr><td>${firstCell}</td>${contextCells}${monthsCells}<td>${amountText(row.total)}</td><td>${percentText(row.percentOfSalesYear)}</td></tr>`;
    }).join('');
    const subtitle = `${t('reportGeneral')} — ${year}${selectedMonthNumber ? ` — ${EN_MONTHS[selectedMonthNumber - 1]}` : ''}`;
    openPrintWindow({
      title: t('reportGeneral'),
      companyName: companyName || t('reports'),
      subtitle,
      landscape: true,
      body: `<table><thead><tr><th>${(t('reportItem') || '').replace(/</g, '&lt;')}</th>${head}</tr></thead><tbody>${bodyRows}</tbody></table>`,
    });
  }

  return (
    <ScreenShell>
      <ReportsDetailModal state={detailState} onClose={() => setDetailState(null)} companyId={activeCompanyId} year={year} t={t} lang={lang} />

      <div className="flex flex-col gap-4">
      <div className="nx-page-header">
        <div className="flex-1 min-w-0">
          <h2 className="font-bold m-0 text-[18px]">{t('reportGeneral')}</h2>
        </div>
        <div className="flex items-end flex-wrap gap-2 flex-[0_1_auto]">
          <Input type="select" label={t('reportYear')} value={year} onChange={(e: any) => setYear(Number(e.target.value))}>
            {yearOptions.map((option: any) => <option key={option} value={option}>{option}</option>)}
          </Input>
          {!isMobile && (
            <Input type="select" label={t('reportMonth')} value={selectedMonth} onChange={(e: any) => setSelectedMonth(e.target.value)}>
              <option value="">{t('allMonths')}</option>
              {EN_MONTHS.map((month: any, index: any) => <option key={month} value={index + 1}>{month}</option>)}
            </Input>
          )}
          <div className="nx-toolbar">
            <Button size="sm" onClick={handleExportExcel} disabled={!report}>{t('exportExcel')}</Button>
            <Button size="sm" onClick={handleExportPdf} disabled={!report}>طباعة / PDF</Button>
            <Button size="sm" onClick={handlePrint} disabled={!report}>{t('print')}</Button>
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

          {report && (
            <div
              className={cn(
                'nx-kpi-container mt-1 transition-opacity duration-200',
                isFetching && isPlaceholderData && 'pointer-events-none opacity-55',
              )}
            >
              <div className="nx-kpi-grid">
                {[
                  { key: 'sales', label: selectedMonthNumber ? `${(lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN)[selectedMonthNumber - 1]} — ${t('revenueGroup')}` : t('annualSales') },
                  { key: 'purchases', label: selectedMonthNumber ? `${(lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN)[selectedMonthNumber - 1]} — ${t('purchasesGroup')}` : t('annualPurchases') },
                  { key: 'expenses', label: selectedMonthNumber ? `${(lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN)[selectedMonthNumber - 1]} — ${t('expensesGroup')}` : t('annualExpenses') },
                  { key: 'grossProfit', label: t('annualGrossProfit') },
                  { key: 'netProfit', label: t('annualNetProfit') },
                ].map((card: any) => {
                  const profitPct = (card.key === 'grossProfit' || card.key === 'netProfit') ? getCardProfitPercent(card.key) : null;
                  const val = Number(getCardValue(card.key) || 0);
                  const isProfitCard = card.key === 'grossProfit' || card.key === 'netProfit';
                  const accentColor =
                    (KPI_CARD_SPARKLINE_COLORS as Record<string, string>)[String(card.key)] || KPI_CARD_SPARKLINE_COLORS.sales;
                  const periodLabel = selectedMonthNumber
                    ? `${(lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN)[selectedMonthNumber - 1]} · ${year}`
                    : String(year);
                  const valueNegative = isProfitCard && val < 0;
                  return (
                    <MetricCard
                      key={`${year}-${selectedMonth || 'all'}-${card.key}`}
                      color={accentColor}
                      className="min-h-[120px]"
                    >
                      <MetricCard.Header label={card.label} />
                      <MetricCard.Value
                        value={amountText(getCardValue(card.key))}
                        currency="SR"
                        color={valueNegative ? 'var(--noorix-accent-red)' : undefined}
                      />
                      <MetricCard.Spark data={[]} color={accentColor} grow />
                      <MetricCard.Footer className="mt-3 border-t border-noorix-border pt-3 pb-3">
                        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-noorix-muted">{periodLabel}</span>
                        {profitPct != null && (
                          <span
                            className={cn(
                              'inline-flex max-w-[min(100%,140px)] shrink-0 truncate rounded px-2 py-0.5 text-[11px] font-bold',
                              Number(profitPct) > 0 && 'bg-[#eaf3de] text-[#3B6D11]',
                              Number(profitPct) < 0 && 'bg-[#FCEBEB] text-[#A32D2D]',
                              Number(profitPct) === 0 && 'bg-noorix-bg-muted text-noorix-muted',
                            )}
                          >
                            {t('reportProfitMargin')}: {profitPct}%
                          </span>
                        )}
                      </MetricCard.Footer>
                    </MetricCard>
                  );
                })}
              </div>
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
              <div className="noorix-surface-card overflow-hidden p-0">
                {isMobile && (
                  <ScreenTabs
                    variant="underline"
                    items={mobileMonthTabItems}
                    value={selectedMonth}
                    onChange={setSelectedMonth}
                    barClassName="border-b border-noorix-border"
                  />
                )}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: isMobile ? (selectedMonthNumber ? 320 : 240) : (selectedMonthNumber ? 1120 : 1060), borderCollapse: 'collapse', tableLayout: isMobile ? 'auto' : 'fixed' }}>
                    <colgroup>
                      <col style={{ width: isMobile ? 130 : 220 }} />
                      {selectedMonthNumber && <col style={{ width: isMobile ? undefined : 76 }} />}
                      {!isMobile && (report?.months ?? []).map((m: any) => <col key={m.index} style={{ width: 66 }} />)}
                      <col style={{ width: isMobile ? 100 : 100 }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'right', padding: isMobile ? '7px 8px' : '8px 12px', borderBottom: '2px solid var(--noorix-border)', position: 'sticky', [lang === 'en' ? 'left' : 'right']: 0, background: 'var(--noorix-bg-surface)', zIndex: 2, fontSize: isMobile ? 12 : 13, fontWeight: 700, fontFamily: 'var(--noorix-font-primary)', color: 'var(--noorix-text)', width: isMobile ? 130 : 220, minWidth: isMobile ? 130 : 220, maxWidth: isMobile ? 130 : 280 }}>{t('reportItem')}</th>
                        {selectedMonthNumber && (
                          <th style={{ textAlign: 'center', padding: '8px 6px', borderBottom: '2px solid var(--noorix-border)', background: 'var(--noorix-blue-6)', fontSize: 13, fontWeight: 700 }}>{(lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN)[selectedMonthNumber - 1]}</th>
                        )}
                        {!isMobile && (report?.months ?? []).map((month: any) => (
                          <th key={month.index} style={{ textAlign: 'center', padding: '8px 4px', borderBottom: '2px solid var(--noorix-border)', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600, background: selectedMonthNumber === month.index ? 'var(--noorix-blue-10)' : undefined }}>{month.label}</th>
                        ))}
                        <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '2px solid var(--noorix-border)', background: 'var(--noorix-table-header-bg)', borderInlineStart: '2px solid var(--noorix-navy-12)', fontWeight: 800, fontSize: 13 }}>{t('reportAnnualTotal')}</th>
                      </tr>
                    </thead>
                  <tbody>
                    {visibleRows.map((row: any) => {
                      const isGroup = row.rowType === 'group';
                      const isCategory = row.rowType === 'category';
                      const isSummary = row.rowType === 'summary';
                      const canOpenItem = row.rowType === 'item';
                      const collapseKey = isGroup ? row.groupKey : row.collapseKey;
                      const isCollapsed = !!collapseKey && !!(collapsedGroups as Record<string, boolean>)[String(collapseKey)];
                      const canCollapse = isGroup || isCategory;
                      const indent = (row.depth || 0) * 22;
                      const rowTone = getRowTone(row);
                      const rowPaddingV = isGroup ? (isMobile ? '8px' : '10px') : isSummary ? (isMobile ? '7px' : '9px') : isCategory ? (isMobile ? '6px' : '8px') : (isMobile ? '5px' : '7px');
                      return (
                        <tr
                          key={`${row.groupKey}-${row.itemKey || row.rowType}-${row.depth ?? 0}`}
                          className="report-table-row"
                          style={{
                            background: rowTone.bg,
                            borderTop: rowTone.borderTop || undefined,
                          }}
                        >
                          <td style={{ padding: `${rowPaddingV} ${isMobile ? '8px' : '12px'}`, borderBottom: '1px solid var(--noorix-border)', position: 'sticky', [lang === 'en' ? 'left' : 'right']: 0, background: rowTone.stickyBg, fontSize: isMobile ? (isGroup ? 13 : 12) : (isGroup ? 14 : isCategory ? 13 : isSummary ? 14 : 13), fontFamily: 'var(--noorix-font-primary)', lineHeight: 1.35, width: isMobile ? 130 : 220, minWidth: isMobile ? 130 : 220, maxWidth: isMobile ? 130 : 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                                  fontWeight: isCategory ? 700 : 800,
                                  fontSize: isMobile ? (isGroup ? 13 : 12) : (isGroup ? 14 : 13),
                                  fontFamily: 'var(--noorix-font-primary)',
                                  textAlign: lang === 'en' ? 'left' : 'right',
                                }}
                                title={`${displayLabel(row, lang)} — ${isCollapsed ? (t('expand') || 'توسيع') : (t('collapse') || 'طي')}`}
                              >
                                <span style={{ fontSize: isGroup ? 13 : 11, width: 14, flexShrink: 0, textAlign: 'center', fontFamily: 'var(--noorix-font-primary)', opacity: 0.75, transition: 'transform 0.15s' }}>{isCollapsed ? '▶' : '▼'}</span>
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
                                  paddingInlineStart: indent + (row.rowType === 'item' ? 20 : 0),
                                  cursor: canOpenItem ? 'pointer' : 'default',
                                  color: isSummary ? rowTone.accent : (row.groupKey === 'purchases' || row.groupKey === 'expenses' ? rowTone.accent : 'var(--noorix-text)'),
                                  fontWeight: isSummary ? 800 : 500,
                                  fontSize: isMobile ? 12 : (isSummary ? 14 : 13),
                                  fontFamily: 'var(--noorix-font-primary)',
                                  textAlign: lang === 'en' ? 'left' : 'right',
                                }}
                                title={canOpenItem ? `${displayLabel(row, lang)} — ${t('reportOpenTrend')}` : displayLabel(row, lang)}
                              >
                                {row.rowType === 'item' && <span style={{ width: 12, flexShrink: 0, color: 'var(--noorix-text-muted)', fontFamily: 'var(--noorix-font-primary)', fontSize: 14, lineHeight: 1 }}>–</span>}
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayLabel(row, lang)}</span>
                              </Button>
                            )}
                          </td>

                          {selectedMonthNumber && (
                            <td style={{ padding: `${rowPaddingV} 8px`, borderBottom: '1px solid var(--noorix-border)', textAlign: 'center', background: `${row.groupKey === 'purchases' ? 'var(--noorix-red-7)' : row.groupKey === 'expenses' ? 'var(--noorix-amber-7)' : 'var(--noorix-blue-4)'}`, fontWeight: 700, fontFamily: 'var(--noorix-font-numbers)', color: isSummary ? (Number(getContextAmount(row, selectedMonthNumber) || 0) >= 0 ? 'var(--noorix-accent-blue)' : 'var(--noorix-accent-red)') : (row.groupKey === 'purchases' || row.groupKey === 'expenses' ? rowTone.accent : 'inherit') }}>
                              <Button
                                onClick={() => setDetailState({ month: selectedMonthNumber, groupKey: row.groupKey, itemKey: row.itemKey, showTrend: row.rowType === 'item' })}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'block', width: '100%', padding: 0 }}
                              >
                                <div style={{ fontSize: 13 }}>{amountText(getContextAmount(row, selectedMonthNumber))}</div>
                                <div style={{ fontSize: 11, marginTop: 2, color: PERCENT_COLOR }}>{percentText(getContextPercent(row, selectedMonthNumber))}</div>
                              </Button>
                            </td>
                          )}

                          {!isMobile && (row.months ?? []).map((value: any, index: any) => (
                            <td key={`${row.groupKey}-${index}`} style={{ padding: `${rowPaddingV} 4px`, borderBottom: '1px solid var(--noorix-border)', textAlign: 'center', background: selectedMonthNumber === index + 1 ? 'var(--noorix-blue-6)' : undefined }}>
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
                                  fontWeight: isSummary || isGroup ? 800 : isCategory ? 700 : 600,
                                  fontFamily: 'var(--noorix-font-numbers)',
                                }}
                              >
                                <div style={{ fontSize: isGroup || isSummary ? 13 : 12 }}>{amountText(value)}</div>
                                <div style={{ fontSize: 11, marginTop: 2, color: PERCENT_COLOR }}>{percentText(row.percentOfSalesMonths?.[index])}</div>
                              </Button>
                            </td>
                          ))}

                          <td style={{ padding: `${rowPaddingV} 12px`, borderBottom: '1px solid var(--noorix-border)', textAlign: 'right', fontWeight: 800, fontFamily: 'var(--noorix-font-numbers)', color: isSummary ? (Number(row.total || 0) >= 0 ? 'var(--noorix-accent-blue)' : 'var(--noorix-accent-red)') : (row.groupKey === 'purchases' || row.groupKey === 'expenses' ? rowTone.accent : 'inherit'), background: 'var(--noorix-table-header-bg)', borderInlineStart: '2px solid var(--noorix-navy-12)' }}>
                            <div style={{ fontSize: isGroup || isSummary ? 14 : 13 }}>{amountText(row.total)}</div>
                            <div style={{ fontSize: 11, marginTop: 2, color: PERCENT_COLOR }}>{percentText(row.percentOfSalesYear)}</div>
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
    </ScreenShell>
  );
}
