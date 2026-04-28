import React from 'react';

export interface DashboardCalendarEmptyCompanyProps {
  t: (key: string, ...args: unknown[]) => string;
}

export default function DashboardCalendarEmptyCompany({ t }: DashboardCalendarEmptyCompanyProps) {
  return <div className="noorix-surface-card text-center text-noorix-muted p-6">{t('pleaseSelectCompany')}</div>;
}
