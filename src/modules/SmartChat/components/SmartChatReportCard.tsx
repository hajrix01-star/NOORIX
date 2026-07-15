/**
 * بطاقة تقرير الرد — عناوين، نقاط، جداول من أسطر tab، ومخططات مصغّرة.
 */
import React from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatSaudiDateTime } from '../../../utils/saudiDate';
import { fmt } from '../../../utils/format';
import { KPI_RECHARTS_COLORS } from '../../../constants/kpiCardTheme';
import type { ChatAnswerExtras } from '../types';
import type { ChatChartFinanceRatios, ChatChartMonthCompare } from '../../../types/api';
import { formatMiniChartTooltipValue, formatMiniChartYAxisTick } from '../utils/smartChatFormatters';
import { SimpleTable } from '../../../ui';
import type { SimpleTableColumn } from '../../../ui';

type ChatReportTableRow = { id: number } & Record<string, string | number>;

/** أسطر tab بنفس عدد الأعمدة (≥2) ولها صفّان على الأقل → جدول */
function tryParseTabularBlock(
  lines: string[],
  start: number,
): { rows: string[][]; endExclusive: number } | null {
  if (start >= lines.length) return null;
  const first = lines[start];
  if (!first.includes('\t')) return null;
  const headerCols = first.split('\t');
  const colCount = headerCols.length;
  if (colCount < 2) return null;
  const rows: string[][] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.includes('\t')) break;
    const cells = line.split('\t');
    if (cells.length !== colCount) break;
    rows.push(cells.map((c) => c.trim()));
    i += 1;
  }
  if (rows.length < 2) return null;
  return { rows, endExclusive: i };
}

function ReportDataTable({ rows, isAr }: { rows: string[][]; isAr: boolean }) {
  const [header, ...body] = rows;
  const cellNumericClass = (cell: string) =>
    /^[\d۰-۹٠-٩,.%\s—–-]+$/.test(cell.replace(/,/g, '')) ? 'nx-ltr tabular-nums' : '';

  const columns: SimpleTableColumn<ChatReportTableRow>[] = header.map((h, index) => ({
    key: `c${index}`,
    label: h,
    align: index > 0 ? 'center' : undefined,
    numeric: index > 0,
    cellClassName: index > 0 ? 'min-w-0 text-center tabular-nums' : 'min-w-0',
    render: (_value: unknown, row: ChatReportTableRow) => {
      const cell = String(row[`c${index}`] || '');
      return <span className={index > 0 ? cellNumericClass(cell) : undefined}>{cell}</span>;
    },
  }));
  const data: ChatReportTableRow[] = body.map((row, rowIndex) => ({
    id: rowIndex,
    ...Object.fromEntries(row.map((cell, cellIndex) => [`c${cellIndex}`, cell])),
  }));

  return (
    <div
      className="noorix-chat-report-table-wrap"
      dir={isAr ? 'rtl' : 'ltr'}
      role="region"
      aria-label={isAr ? 'جدول بيانات' : 'Data table'}
    >
      <SimpleTable
        columns={columns}
        data={data}
        tableClassName="noorix-chat-report-table"
        frameClassName="border-0 shadow-none"
      />
    </div>
  );
}

function ChatMiniChart({
  chart,
  isAr,
  variant = 'belowText',
}: {
  chart: ChatChartMonthCompare;
  isAr: boolean;
  /** highlight: أعلى الكرت — بدون خط علوي طويل وبلا عنوان فرعي */
  variant?: 'belowText' | 'highlight';
}) {
  const bars = chart?.bars;
  if (!Array.isArray(bars) || bars.length < 2) return null;
  const data = bars.map((b) => ({
    key: b.key,
    name: isAr ? b.labelAr : b.labelEn,
    value: Number(b.value),
  }));
  const isHighlight = variant === 'highlight';
  return (
    <div
      className={
        isHighlight
          ? 'noorix-chat-mini-chart noorix-chat-mini-chart--highlight mb-3 rounded-[10px] border border-noorix-border/70 bg-noorix-bg-muted/50 px-2.5 py-2'
          : 'noorix-chat-mini-chart mt-3 pt-3 border-t border-noorix-border'
      }
      role="img"
      aria-label={isAr ? 'مخطط مقارنة مبيعات الشهرين' : 'Bar chart comparing the two months'}
    >
      {!isHighlight ? (
        <div dir={isAr ? 'rtl' : 'ltr'} className="text-[11px] font-semibold text-noorix-muted mb-2">
          {isAr ? 'مقارنة بصرية' : 'Visual comparison'}
        </div>
      ) : null}
      <div className={`nx-ltr noorix-chat-mini-chart__canvas${isHighlight ? ' noorix-chat-mini-chart__canvas--highlight' : ''}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barCategoryGap="28%">
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--noorix-text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis
              width={44}
              tick={{ fontSize: 10, fill: 'var(--noorix-text-muted)' }}
              tickFormatter={(v: number) => formatMiniChartYAxisTick(v)}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value) => [
                formatMiniChartTooltipValue(typeof value === 'number' || typeof value === 'string' ? value : 0, isAr),
                isAr ? 'المبلغ' : 'Amount',
              ]}
              labelStyle={{ direction: isAr ? 'rtl' : 'ltr' }}
              contentStyle={{
                borderRadius: 8,
                border: '1px solid var(--noorix-border)',
                fontSize: 12,
              }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={42}>
              {data.map((_, i) => (
                <Cell
                  key={data[i].key}
                  fill={i === 0 ? KPI_RECHARTS_COLORS.purchases : KPI_RECHARTS_COLORS.sales}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ChatFinanceRatiosStrip({
  chart,
  isAr,
}: {
  chart: ChatChartFinanceRatios;
  isAr: boolean;
}) {
  const segments = chart?.segments;
  if (!Array.isArray(segments) || segments.length === 0) return null;
  const used = segments.reduce((a, s) => a + (Number(s.pct) || 0), 0);
  const remainder = Math.max(0, 100 - used);
  const fillFor = (key: string) =>
    key === 'purchases' ? KPI_RECHARTS_COLORS.purchases : KPI_RECHARTS_COLORS.expenses;
  const labelFor = (key: string) => {
    if (key === 'purchases') return isAr ? 'مشتريات' : 'Purchases';
    return isAr ? 'مصروفات' : 'Expenses';
  };
  return (
    <div
      className="noorix-chat-finance-ratios mt-3 pt-3 border-t border-noorix-border"
      role="img"
      aria-label={isAr ? 'شريط نسب الخارج التشغيلي من المبيعات' : 'Operating load as share of revenue'}
    >
      <div dir={isAr ? 'rtl' : 'ltr'} className="text-[11px] font-semibold text-noorix-muted mb-2">
        {isAr ? 'توزيع الخارج التشغيلي من الإيراد' : 'Operating load vs revenue'}
      </div>
      <div
        className="noorix-chat-finance-ratios__track nx-ltr flex h-[10px] rounded-full overflow-hidden border border-noorix-border/80 bg-noorix-bg-muted"
        aria-hidden
      >
        {segments.map((s: { key: string; pct: unknown }) => {
          const segmentStyle = {
            '--chat-ratio-width': `${Math.max(0, Math.min(100, Number(s.pct) || 0))}%`,
            '--chat-ratio-fill': fillFor(s.key),
          } as React.CSSProperties;
          return (
            <div
              key={s.key}
              className="noorix-chat-finance-ratios__seg h-full min-w-0 transition-[width] duration-300"
              style={segmentStyle}
              title={`${labelFor(s.key)}: ${fmt(Number(s.pct), 1)}%`}
            />
          );
        })}
        {remainder > 0.05 ? (
          <div className="noorix-chat-finance-ratios__remainder flex-1 min-w-0 h-full bg-noorix-bg-page/90" />
        ) : null}
      </div>
      <ul dir={isAr ? 'rtl' : 'ltr'} className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-noorix-muted list-none m-0 p-0">
        {segments.map((s: { key: string; pct: unknown }) => {
          const dotStyle = { '--chat-ratio-fill': fillFor(s.key) } as React.CSSProperties;
          return (
            <li key={s.key} className="inline-flex items-center gap-1.5">
              <span className="noorix-chat-finance-ratios__dot inline-block size-2 rounded-sm shrink-0" style={dotStyle} aria-hidden />
              <span>
                {labelFor(s.key)}: <span className="font-semibold text-noorix-text nx-ltr">{fmt(Number(s.pct), 1)}%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export type SmartChatReportCardProps = {
  text: string;
  isAr: boolean;
  createdAt?: string;
  extras?: ChatAnswerExtras;
};

const NUMBERED_SECTION = /^([٠-٩]+|\d+)[\).\]]\s+/;
const DEFINITION_LINE = /^(تعريف|Definition)\s*:/i;

/** رد يحوي أرقاماً/مبالغ/نسباً — يُبرز إطار الكرت لتمييزه عن الخلفية */
const LTR_VALUE_CLASS_NAME = 'nx-ltr [unicode-bidi:isolate]';

function answerLooksNumericOrMetrics(text: string): boolean {
  const s = String(text || '');
  if (!/[\d۰-۹]/.test(s)) return false;
  return /(?:SR|SAR|٪|%|\bvs\b)/i.test(s) || /\d{2,}/.test(s);
}

export function SmartChatReportCard({ text, isAr, createdAt, extras }: SmartChatReportCardProps) {
  const raw = String(text || '').trim();
  const lines = raw
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const monthCompareChart =
    extras?.chart?.kind === 'monthCompare' && extras.chart ? extras.chart : null;

  const renderKvLine = (line: string, i: number) => {
    const colonIdx = line.indexOf(':');
    const hasLabel = colonIdx > 0 && colonIdx < 50;
    const label = hasLabel ? line.slice(0, colonIdx).trim() : null;
    const value = hasLabel ? line.slice(colonIdx + 1).trim() : line;
    const isNumericValue = /^\d/.test(value) || /\d{4}-\d{2}-\d{2}/.test(value);
    const isPeriod = /^(الفترة|Period)\s*:/i.test(line);
    return (
      <div
        key={i}
        className={`noorix-chat-report-card__grid${isPeriod ? ' noorix-chat-report-card__grid--period' : ''}`}
        dir={isAr ? 'rtl' : 'ltr'}
      >
        {label ? (
          <>
            <span className="text-[13px] text-noorix-muted font-semibold">{label}:</span>
            <span className={isNumericValue ? LTR_VALUE_CLASS_NAME : undefined}>{value}</span>
          </>
        ) : (
          <span className={`noorix-chat-report-card__grid-full${isNumericValue ? ` ${LTR_VALUE_CLASS_NAME}` : ''}`}>{value || line}</span>
        )}
      </div>
    );
  };

  const renderBody = () => {
    const nodes: React.ReactNode[] = [];
    let i = 0;
    let k = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (DEFINITION_LINE.test(line)) {
        i += 1;
        continue;
      }
      if (/^##\s*/.test(line)) {
        const title = line.replace(/^##\s*/, '').trim();
        nodes.push(
          <h3
            key={`h-${k++}`}
            className="text-[15px] md:text-[16px] font-bold text-noorix-text tracking-tight border-b border-noorix-border pb-2 mb-0"
          >
            {title}
          </h3>,
        );
        i += 1;
        continue;
      }
      if (/^[•\-\*]\s*/.test(line)) {
        const bulletText = line.replace(/^[•\-\*]\s*/, '').trim();
        const isSummary = /^الخلاصة[:：]/i.test(bulletText) || /^Summary:/i.test(bulletText);
        nodes.push(
          <div
            key={`b-${k++}`}
            className={`noorix-chat-report-card__bullet flex gap-2 text-[14px] md:text-[15px] pe-1${isSummary ? ' noorix-chat-report-card__bullet--summary' : ''}`}
          >
            <span className="text-noorix-muted shrink-0" aria-hidden>
              •
            </span>
            <span className="min-w-0">{bulletText}</span>
          </div>,
        );
        i += 1;
        continue;
      }
      const table = tryParseTabularBlock(lines, i);
      if (table) {
        nodes.push(<ReportDataTable key={`t-${k++}`} rows={table.rows} isAr={isAr} />);
        i = table.endExclusive;
        continue;
      }
      if (NUMBERED_SECTION.test(line) && !line.includes('\t')) {
        nodes.push(
          <h4 key={`s-${k++}`} className="noorix-chat-report-card__section-title">
            {line}
          </h4>,
        );
        i += 1;
        continue;
      }
      nodes.push(renderKvLine(line, k++));
      i += 1;
    }
    return nodes;
  };

  const emphasizeDataCard =
    answerLooksNumericOrMetrics(raw) || Boolean(extras?.chart);

  return (
    <div
      className={`noorix-chat-report-card bg-noorix-surface text-noorix-text text-[14px] md:text-[15px] py-3.5 px-3 md:py-4 md:px-5 rounded-[14px] border border-noorix-border leading-[1.7] break-words w-full min-w-0 max-w-full${emphasizeDataCard ? ' noorix-chat-report-card--numeric' : ''}${monthCompareChart ? ' noorix-chat-report-card--month-compare' : ''}`}
    >
      {monthCompareChart ? <ChatMiniChart chart={monthCompareChart} isAr={isAr} variant="highlight" /> : null}
      {lines.length > 0 ? (
        <div
          className={`flex flex-col w-full min-w-0${monthCompareChart ? ' gap-2.5' : ' gap-3'}`}
        dir={isAr ? 'rtl' : 'ltr'}
        >
          {renderBody()}
        </div>
      ) : (
        <div className="whitespace-pre-wrap">{text}</div>
      )}
      {extras?.chart?.kind === 'financeRatios' && extras.chart ? (
        <ChatFinanceRatiosStrip chart={extras.chart} isAr={isAr} />
      ) : null}
      {createdAt && (
        <div className="text-[12px] text-noorix-muted border-t border-noorix-border nx-ltr mt-[14px] pt-3">
          {formatSaudiDateTime(createdAt)}
        </div>
      )}
    </div>
  );
}
