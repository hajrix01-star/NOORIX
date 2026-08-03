/**
 * HAJRI TAX — إطار القسم بنمط المرجع (تبويبات فرعية) وهوية نووريكس
 */
import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { ScreenShell, ScreenTitle, cn } from '../../ui';

const HAJRI_TABS = [
  { to: '/hajri-tax', end: true, labelKey: 'hajriTaxTabRegistry' },
  { to: '/hajri-tax/quarters', labelKey: 'hajriTaxTabQuarters' },
] as const;

export default function HajriTaxLayout() {
  const { t } = useTranslation();

  return (
    <ScreenShell variant="report">
      <div className="mb-1">
        <ScreenTitle>{t('hajriTax')}</ScreenTitle>
        <p className="mt-1.5 text-[13px] text-noorix-muted max-w-3xl">{t('reportVatRegistryDesc')}</p>
      </div>

      <div className="noorix-surface-card p-0 overflow-hidden">
        <div className="noorix-tab-bar flex gap-2 overflow-x-auto border-b border-noorix-border bg-noorix-bg-muted p-2 [-webkit-overflow-scrolling:touch]">
          {HAJRI_TABS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={'end' in link ? link.end : undefined}
              className={({ isActive }) =>
                cn(
                  'm-0 shrink-0 whitespace-nowrap rounded-lg border px-[18px] py-2.5 text-[14px] no-underline shadow-sm transition-colors',
                  isActive
                    ? 'border-noorix-green bg-noorix-green font-extrabold text-white'
                    : 'border-noorix-border bg-noorix-surface font-bold text-noorix-muted hover:border-noorix-blue hover:text-noorix-text',
                )
              }
            >
              {t(link.labelKey)}
            </NavLink>
          ))}
        </div>
        <div className="p-6">
          <Outlet />
        </div>
      </div>
    </ScreenShell>
  );
}
