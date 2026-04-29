/**
 * بطاقة تقرير الرد — عناوين، نقاط، جداول من أسطر tab، ومخططات مصغّرة.
 */
import React from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatSaudiDateTime } from '../../../utils/saudiDate';
import { fmt } from '../../../utils/format';
import { KPI_RECHARTS_COLORS } from '../../../constants/kpiCardTheme';
import type { ChatAnswerExtras } from '../types';
import { formatMiniChartTooltipValue, formatMiniChartYAxisTick } from '../utils/smartChatFormatters';

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

  return (
    <div
      className="noorix-chat-report-table-wrap"
      dir={isAr ? 'rtl' : 'ltr'}
      role="region"
      aria-label={isAr ? 'جدول بيانات' : 'Data table'}
    >
      <table className="noorix-chat-report-table">
        <thead>
          <tr>
            {header.map((h, j) => (
              <th key={j} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className={ci > 0 ? `min-w-0 ${cellNumericClass(cell)}` : 'min-w-0'}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChatMiniChart({
  chart,
  isAr,
}: {
  chart: NonNullable<ChatAnswerExtras['chart']>;
  isAr: boolean;
}) {
  const bars = chart?.bars;
  if (!Array.isArray(bars) || bars.length < 2) return null;
  const data = bars.map((b) => ({
    key: b.key,
    name: isAr ? b.labelAr : b.labelEn,
    value: Number(b.value),
  }));
  return (
    <div
      className="noorix-chat-mini-chart mt-3 pt-3 border-t border-noorix-border"
      role="img"
      aria-label={isAr ? 'مخطط مقارنة مبيعات الشهرين' : 'Bar chart comparing the two months'}
    >
      <div className="text-[11px] font-semibold text-noorix-muted mb-2" style={{ direction: isAr ? 'rtl' : 'ltr' }}>
        {isAr ? 'مقارنة بصرية' : 'Visual comparison'}
      </div>
      <div className="nx-ltr" style={{ width: '100%', height: 132 }}>
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
  chart: NonNullable<ChatAnswerExtras['chart']>;
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
      <div className="text-[11px] font-semibold text-noorix-muted mb-2" style={{ direction: isAr ? 'rtl' : 'ltr' }}>
        {isAr ? 'توزيع الخارج التشغيلي من الإيراد' : 'Operating load vs revenue'}
      </div>
      <div
        className="noorix-chat-finance-ratios__track nx-ltr flex h-[10px] rounded-full overflow-hidden border border-noorix-border/80 bg-noorix-bg-muted"
        aria-hidden
      >
        {segments.map((s: { key: string; pct: unknown }) => (
          <div
            key={s.key}
            className="noorix-chat-finance-ratios__seg h-full min-w-0 transition-[width] duration-300"
            style={{ width: `${Math.max(0, Math.min(100, Number(s.pct) || 0))}%`, backgroundColor: fillFor(s.key) }}
            title={`${labelFor(s.key)}: ${fmt(Number(s.pct), 1)}%`}
          />
        ))}
        {remainder > 0.05 ? (
          <div className="noorix-chat-finance-ratios__remainder flex-1 min-w-0 h-full bg-noorix-bg-page/90" />
        ) : null}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-noorix-muted list-none m-0 p-0" style={{ direction: isAr ? 'rtl' : 'ltr' }}>
        {segments.map((s: { key: string; pct: unknown }) => (
          <li key={s.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-sm shrink-0" style={{ backgroundColor: fillFor(s.key) }} aria-hidden />
            <span>
              {labelFor(s.key)}: <span className="font-semibold text-noorix-text nx-ltr">{fmt(Number(s.pct), 1)}%</span>
            </span>
          </li>
        ))}
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

  const renderKvLine = (line: string, i: number) => {
    const colonIdx = line.indexOf(':');
    const hasLabel = colonIdx > 0 && colonIdx < 50;
    const label = hasLabel ? line.slice(0, colonIdx).trim() : null;
    const value = hasLabel ? line.slice(colonIdx + 1).trim() : line;
    const isNumericValue = /^\d/.test(value) || /\d{4}-\d{2}-\d{2}/.test(value);
    const valueStyle: React.CSSProperties = isNumericValue ? { direction: 'ltr', unicodeBidi: 'isolate' } : {};
    const isPeriod = /^(الفترة|Period)\s*:/i.test(line);
    return (
      <div
        key={i}
        className={`noorix-chat-report-card__grid${isPeriod ? ' noorix-chat-report-card__grid--period' : ''}`}
        style={{ direction: isAr ? 'rtl' : 'ltr' }}
      >
        {label ? (
          <>
            <span className="text-[13px] text-noorix-muted font-semibold">{label}:</span>
            <span style={valueStyle}>{value}</span>
          </>
        ) : (
          <span style={{ gridColumn: '1 / -1', ...valueStyle }}>{value || line}</span>
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
      className={`noorix-chat-report-card bg-noorix-surface text-noorix-text text-[14px] md:text-[15px] py-3.5 px-3 md:py-4 md:px-5 rounded-[14px] border border-noorix-border leading-[1.7] break-words w-full min-w-0 max-w-full${emphasizeDataCard ? ' noorix-chat-report-card--numeric' : ''}`}
      style={{
        boxShadow: emphasizeDataCard ? undefined : '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      {lines.length > 0 ? (
        <div className="flex flex-col gap-3 w-full min-w-0" style={{ direction: isAr ? 'rtl' : 'ltr' }}>
          {renderBody()}
        </div>
      ) : (
        <div className="whitespace-pre-wrap">{text}</div>
      )}
      {extras?.chart?.kind === 'monthCompare' && extras.chart ? (
        <ChatMiniChart chart={extras.chart} isAr={isAr} />
      ) : null}
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
