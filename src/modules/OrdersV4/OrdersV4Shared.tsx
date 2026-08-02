import React from 'react';
import { InlineSelect, Spinner } from '../../ui';

export function OrdersV4Panel({ title, action, children }: { title: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="noorix-surface-card min-w-0 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-noorix-border px-4 py-3">
        <h3 className="m-0 text-[14px] font-bold text-noorix-text">{title}</h3>
        {action}
      </div>
      <div className="min-w-0 p-3 sm:p-4">{children}</div>
    </section>
  );
}

export function OrdersV4Kpi({ label, value, tone = 'blue' }: { label: string; value: React.ReactNode; tone?: 'blue' | 'green' | 'amber' | 'red' }) {
  const toneClass = tone === 'green' ? 'text-emerald-700 bg-emerald-50' : tone === 'amber' ? 'text-amber-700 bg-amber-50' : tone === 'red' ? 'text-red-700 bg-red-50' : 'text-blue-700 bg-blue-50';
  return (
    <div className="noorix-surface-card min-w-0 p-4">
      <div className="text-[11px] font-medium text-noorix-muted">{label}</div>
      <div className={`mt-2 inline-flex rounded-lg px-2 py-1 text-[20px] font-extrabold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

export function OrdersV4Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <InlineSelect {...props} className={`h-9 rounded-lg px-3 text-[13px] ${props.className || ''}`} />;
}

export function OrdersV4Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 text-[11px] font-medium text-noorix-muted ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function OrdersV4QueryState({ loading, error }: { loading: boolean; error?: Error | null }) {
  if (loading) return <div className="flex min-h-40 items-center justify-center"><Spinner /></div>;
  if (error) return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">{error.message}</div>;
  return null;
}

export function v4Number(value: unknown, digits = 2): string {
  const number = Number(value ?? 0);
  return Number.isFinite(number)
    ? new Intl.NumberFormat('ar-SA', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(number)
    : '0';
}

export function v4Date(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ar-SA-u-ca-gregory').format(date);
}
