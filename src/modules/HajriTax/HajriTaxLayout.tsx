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
];

export default function HajriTaxLayout() {
  const { t } = useTranslation();

  return (
    <ScreenShell>
      <div className="mb-1">
        <ScreenTitle>{t('hajriTax')}</ScreenTitle>
        <p className="mt-1.5 text-[13px] text-noorix-muted max-w-3xl">{t('reportVatRegistryDesc')}</p>
      </div>

      <div className="noorix-surface-card p-0 overflow-hidden">
        <div className="noorix-tab-bar flex gap-0 border-b border-noorix-border overflow-x-auto [-webkit-overflow-scrolling:touch]">
          {HAJRI_TABS.map((link: any) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }: any) =>
                cn(
                  'm-0 shrink-0 whitespace-nowrap rounded-none border-0 border-b-2 px-[18px] py-3 text-[14px] no-underline transition-colors',
                  isActive
                    ? 'border-b-noorix-blue bg-[var(--noorix-blue-7)] font-bold text-noorix-blue'
                    : 'border-b-transparent bg-transparent font-medium text-noorix-muted hover:text-noorix-text',
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
