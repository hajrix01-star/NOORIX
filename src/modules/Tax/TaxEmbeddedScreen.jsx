import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { apiGet } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../ui';
import {
  buildHajriTaxEmbeddedUrl,
  resolveTaxHajriSegment,
} from './taxEmbeddedUrl';

const HAJRI_TAX_FALLBACK = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_HAJRI_TAX_URL)
  ? String(import.meta.env.VITE_HAJRI_TAX_URL).replace(/\/$/, '')
  : 'https://hajrix.com/tax';

const ALLOWED_TAX_PATHS = new Set(['/tax', '/tax/form', '/tax/reports']);

export default function TaxEmbeddedScreen() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { pathname } = useLocation();
  const segment = useMemo(() => resolveTaxHajriSegment(pathname), [pathname]);

  const { data, isPending, isError, refetch, isFetching, isSuccess } = useQuery({
    queryKey: ['hajri-tax-launch-url'],
    queryFn: async () => {
      const res = await apiGet('/api/v1/owner/hajri-tax/launch-url');
      if (!res?.success) {
        showToast(res?.error || t('hajriTaxLaunchFailed'), 'error');
        return { url: `${HAJRI_TAX_FALLBACK}/` };
      }
      return { url: res.data?.url || `${HAJRI_TAX_FALLBACK}/` };
    },
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });

  const iframeSrc = useMemo(() => {
    const base = data?.url || `${HAJRI_TAX_FALLBACK}/`;
    return buildHajriTaxEmbeddedUrl(base, segment);
  }, [data?.url, segment]);

  const openExternal = () => {
    window.open(iframeSrc, '_blank', 'noopener,noreferrer');
  };

  const normalizedPath = pathname.replace(/\/$/, '') || '/tax';
  const invalidSubpath = normalizedPath.startsWith('/tax') && !ALLOWED_TAX_PATHS.has(normalizedPath);
  if (invalidSubpath) {
    return <Navigate to="/tax" replace />;
  }

  return (
    <div className="flex flex-col gap-3 w-full min-h-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-[var(--noorix-border)] bg-[var(--noorix-bg-surface)] px-4 py-3 shadow-sm">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-[var(--noorix-text)] m-0">
            {t('hajriTaxEmbedTitle')}
          </h1>
          <p className="text-sm text-[var(--noorix-text-muted)] m-0 mt-1">
            {t('hajriTaxEmbedHint')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="default"
            className="inline-flex items-center gap-2"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <span className={`inline-block ${isFetching ? 'animate-spin' : ''}`} aria-hidden>↻</span>
            {t('refresh')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="inline-flex items-center gap-2 border border-[var(--noorix-border)]"
            onClick={openExternal}
          >
            <span aria-hidden>↗</span>
            {t('hajriTaxOpenInNewTab')}
          </Button>
        </div>
      </div>

      <div className="relative w-full flex-1 min-h-[min(85vh,920px)] rounded-xl border border-[var(--noorix-border)] bg-[var(--noorix-bg)] overflow-hidden shadow-inner">
        {(isPending || isError) && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[var(--noorix-bg)]/90 backdrop-blur-[2px]"
            role="status"
            aria-busy={isPending}
          >
            {isPending && (
              <>
                <div className="w-10 h-10 border-4 border-[var(--noorix-border)] border-t-[var(--noorix-blue)] rounded-full animate-spin" />
                <span className="text-sm text-[var(--noorix-text-muted)]">{t('loading')}</span>
              </>
            )}
            {isError && !isPending && (
              <>
                <p className="text-sm text-[var(--noorix-text-muted)] text-center px-4">{t('loadingError')}</p>
                <Button type="button" variant="primary" onClick={() => refetch()}>
                  {t('retry')}
                </Button>
              </>
            )}
          </div>
        )}
        {isSuccess && data && (
          <iframe
            key={iframeSrc}
            title={t('hajriTaxEmbedTitle')}
            src={iframeSrc}
            className="absolute inset-0 w-full h-full border-0 bg-white"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}
      </div>
    </div>
  );
}
