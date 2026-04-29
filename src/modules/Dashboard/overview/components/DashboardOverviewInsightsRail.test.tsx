import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardOverviewInsightsRail } from './DashboardOverviewInsightsRail';
import type { DashboardInsightsUi } from '../types/dashboardInsightsDisplay';

function mkT(): Record<string, string> {
  return {
    dashboardInsightsSectionTitle: 'Smart Insights',
    dashboardInsightsLoadingHint: 'Loading…',
    dashboardInsightsEmptyTitle: 'No financial alerts',
    dashboardInsightsSeverityCritical: 'Critical',
    dashboardInsightsSeverityWarning: 'Warning',
    dashboardInsightsSeverityInfo: 'Info',
    dashboardInsightsBasisAccounting: 'P&L',
    dashboardInsightsBasisOperational: 'Ops',
    dashboardInsightsBasisInvoicePeriod: 'Inv',
  };
}

describe('DashboardOverviewInsightsRail', () => {
  const t = (k: string) => mkT()[k] ?? k;

  it('renders nothing when insights UI hidden (API error path)', () => {
    const ui: DashboardInsightsUi = { show: false };
    const { container } = render(<DashboardOverviewInsightsRail lang="en" insightsUi={ui} t={t} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows empty-state chip on success with no items', () => {
    const ui: DashboardInsightsUi = { show: true, state: 'empty' };
    render(<DashboardOverviewInsightsRail lang="en" insightsUi={ui} t={t} />);
    expect(screen.getByText('No financial alerts')).toBeTruthy();
  });

  it('shows at most 3 chips', () => {
    const mkItem = (id: string) => ({
      id,
      severity: 'warning' as const,
      metricBasis: 'accounting_pl' as const,
      titleAr: `ع${id}`,
      titleEn: `T${id}`,
      detailAr: 'د',
      detailEn: 'd',
    });
    const ui: DashboardInsightsUi = {
      show: true,
      state: 'ready',
      items: ['a', 'b', 'c', 'd'].map(mkItem),
    };
    render(<DashboardOverviewInsightsRail lang="en" insightsUi={ui} t={t} />);
    expect(screen.getByText('Ta')).toBeTruthy();
    expect(screen.getByText('Tb')).toBeTruthy();
    expect(screen.getByText('Tc')).toBeTruthy();
    expect(screen.queryByText('Td')).toBeNull();
  });

  it('uses Arabic titles when lang is ar', () => {
    const ui: DashboardInsightsUi = {
      show: true,
      state: 'ready',
      items: [
        {
          id: 'x',
          severity: 'info',
          metricBasis: 'accounting_pl',
          titleAr: 'عربي',
          titleEn: 'English',
          detailAr: '',
          detailEn: '',
        },
      ],
    };
    render(<DashboardOverviewInsightsRail lang="ar" insightsUi={ui} t={t} />);
    expect(screen.getByText('عربي')).toBeTruthy();
    expect(screen.queryByText('English')).toBeNull();
  });
});
