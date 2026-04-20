/**
 * إطار قسم الضرائب الموحّد — جميع الشركات بنفس المنطق، بدون iframe.
 */
import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { ScreenShell, ScreenTitle, cn } from '../../ui';

const TAX_HUB_LINKS = [
  { to: '/hajri-tax', labelKey: 'taxHubNavCompanies', end: true },
  { to: '/reports/tax', labelKey: 'taxHubNavDisclosure', end: false },
];

export default function TaxHubLayout() {
  const { t } = useTranslation();

  return (
    <ScreenShell>
      <div className="flex flex-col gap-2 min-w-0">
        <ScreenTitle>{t('taxHubTitle')}</ScreenTitle>
        <p className="text-sm text-[var(--noorix-text-muted)] m-0 max-w-[52rem]">{t('taxHubIntro')}</p>
      </div>

      <div className="noorix-surface-card p-0 overflow-hidden mt-3">
        <div className="flex gap-0 border-b border-[var(--noorix-border)] overflow-x-auto [-webkit-overflow-scrolling:touch]">
          {TAX_HUB_LINKS.map((link) => (
            <NavLink
              key={link.to + (link.end ? '-e' : '')}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                cn(
                  'm-0 shrink-0 whitespace-nowrap rounded-none border-0 border-b-2 px-[18px] py-3 text-[14px] no-underline transition-colors',
                  isActive
                    ? 'border-b-[var(--noorix-blue)] bg-[var(--noorix-blue-7)] font-bold text-[var(--noorix-blue)]'
                    : 'border-b-transparent bg-transparent font-medium text-[var(--noorix-text-muted)] hover:text-[var(--noorix-text)]',
                )
              }
            >
              {t(link.labelKey)}
            </NavLink>
          ))}
        </div>
        <div className="p-4 sm:p-6">
          <Outlet />
        </div>
      </div>
    </ScreenShell>
  );
}
