import React from 'react';
import { Badge } from '../../ui';

export type GlobalTableConceptRow = {
  id: string;
  document: string;
  account: string;
  owner: string;
  status: 'posted' | 'review' | 'draft';
  risk: 'low' | 'medium' | 'high';
  channel: string;
  net: number;
  tax: number;
  total: number;
  date: string;
};

export const GLOBAL_TABLE_ROWS: GlobalTableConceptRow[] = [
  {
    id: '1',
    document: 'INV-2026-001',
    account: 'Revenue / Daily sales',
    owner: 'Operations',
    status: 'posted',
    risk: 'low',
    channel: 'Bank',
    net: 1000,
    tax: 150,
    total: 1150,
    date: '2026-07-08',
  },
  {
    id: '2',
    document: 'PUR-2026-014',
    account: 'Purchases / Food',
    owner: 'Procurement',
    status: 'review',
    risk: 'medium',
    channel: 'Vault',
    net: 2000,
    tax: 300,
    total: 2300,
    date: '2026-07-08',
  },
  {
    id: '3',
    document: 'EXP-2026-008',
    account: 'Fixed expenses',
    owner: 'Accounting',
    status: 'posted',
    risk: 'low',
    channel: 'Bank',
    net: 500,
    tax: 75,
    total: 575,
    date: '2026-07-07',
  },
  {
    id: '4',
    document: 'AST-2026-002',
    account: 'Assets register',
    owner: 'Finance',
    status: 'draft',
    risk: 'high',
    channel: 'Bank',
    net: 4500,
    tax: 675,
    total: 5175,
    date: '2026-07-06',
  },
];

export function amount(value: number) {
  return (
    <span dir="ltr" className="nx-cell-num font-extrabold tracking-normal">
      {value.toLocaleString('en')} <span className="nx-sar">SR</span>
    </span>
  );
}

export function StatusBadge({ status, isArabic }: { status: GlobalTableConceptRow['status']; isArabic: boolean }) {
  const color = status === 'posted' ? 'green' : status === 'review' ? 'amber' : 'gray';
  const label = isArabic
    ? status === 'posted' ? 'مرحل' : status === 'review' ? 'مراجعة' : 'مسودة'
    : status === 'posted' ? 'Posted' : status === 'review' ? 'Review' : 'Draft';

  return <Badge color={color} size="sm" dot>{label}</Badge>;
}

export function RiskBadge({ risk, isArabic }: { risk: GlobalTableConceptRow['risk']; isArabic: boolean }) {
  const color = risk === 'low' ? 'green' : risk === 'medium' ? 'amber' : 'red';
  const label = isArabic
    ? risk === 'low' ? 'منخفض' : risk === 'medium' ? 'متوسط' : 'عال'
    : risk === 'low' ? 'Low' : risk === 'medium' ? 'Medium' : 'High';

  return <Badge color={color} size="sm">{label}</Badge>;
}

export function PrincipleCard({
  title,
  body,
  accent,
}: {
  title: string;
  body: string;
  accent: 'blue' | 'green' | 'amber' | 'violet';
}) {
  const accentClass = {
    blue: 'from-noorix-blue/15 to-transparent border-noorix-blue/25',
    green: 'from-noorix-green/15 to-transparent border-noorix-green/25',
    amber: 'from-noorix-amber/15 to-transparent border-noorix-amber/30',
    violet: 'from-noorix-violet/15 to-transparent border-noorix-violet/25',
  }[accent];

  return (
    <div className={`rounded-xl border bg-gradient-to-b ${accentClass} px-4 py-3`}>
      <div className="text-[12px] font-extrabold text-noorix-text">{title}</div>
      <div className="mt-1 text-[11px] leading-5 text-noorix-muted">{body}</div>
    </div>
  );
}

export function CommandMetric({ label, value, tone }: { label: string; value: string; tone: 'green' | 'blue' | 'amber' }) {
  const colorClass = tone === 'green' ? 'text-noorix-green' : tone === 'amber' ? 'text-noorix-amber' : 'text-noorix-blue';
  return (
    <div className="rounded-xl border border-white/55 bg-white/72 px-4 py-3 shadow-sm backdrop-blur">
      <div className="text-[11px] font-bold text-noorix-muted">{label}</div>
      <div className={`mt-1 text-[20px] font-black ${colorClass}`}>{value}</div>
    </div>
  );
}

export function FilterChip({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <span
      className={[
        'inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-extrabold',
        active
          ? 'border-noorix-blue bg-noorix-blue text-white shadow-sm'
          : 'border-noorix-border bg-white text-noorix-muted',
      ].join(' ')}
    >
      {label}
    </span>
  );
}
