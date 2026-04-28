/**
 * Financial insight thresholds — Settings → Companies → edit company (separate section).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { PERMISSIONS, hasPermission } from '../../../constants/permissions';
import { useTranslation } from '../../../i18n/useTranslation';
import type { CompanyInsightThresholdsPayload } from '../../../services/reportingInsightThresholdsApi';
import { Button, Input, Spinner } from '../../../ui';
import { useCompanyInsightThresholds } from '../hooks/useCompanyInsightThresholds';
import {
  validateInsightThresholdPercents,
  type InsightThresholdPercentFields,
} from '../utils/companyInsightThresholdsForm';

function thresholdsToPercentFields(t: CompanyInsightThresholdsPayload): InsightThresholdPercentFields {
  return {
    purchaseWarningPct: t.purchaseToSales.warning * 100,
    purchaseCriticalPct: t.purchaseToSales.critical * 100,
    expenseWarningPct: t.expenseToSales.warning * 100,
    expenseCriticalPct: t.expenseToSales.critical * 100,
    netProfitWarningBelowPct: t.netProfitMargin.warningBelow * 100,
  };
}

function validationMessage(code: string | null, t: (k: string) => string): string | null {
  if (!code) return null;
  if (code === 'range') return t('financialInsightValidationRange');
  if (code === 'purchaseOrder') return t('financialInsightValidationPurchaseOrder');
  if (code === 'expenseOrder') return t('financialInsightValidationExpenseOrder');
  return null;
}

export default function CompanyFinancialInsightThresholdsSection({
  companyId,
  userRole,
  userPermissions = [],
}: {
  companyId: string;
  userRole?: string;
  userPermissions?: string[];
}) {
  const { t } = useTranslation();
  const canView =
    hasPermission(userRole, PERMISSIONS.REPORTS_READ, userPermissions) ||
    hasPermission(userRole, PERMISSIONS.MANAGE_COMPANIES, userPermissions);
  const canEdit = hasPermission(userRole, PERMISSIONS.MANAGE_COMPANIES, userPermissions);

  const { query, patchMutation, resetMutation } = useCompanyInsightThresholds(companyId, {
    readEnabled: canView,
  });

  const [form, setForm] = useState<InsightThresholdPercentFields | null>(null);

  useEffect(() => {
    if (query.data) {
      setForm(thresholdsToPercentFields(query.data));
    }
  }, [query.data]);

  const validationCode = useMemo(() => (form ? validateInsightThresholdPercents(form) : null), [form]);
  const validationHint = validationMessage(validationCode, t);

  if (!canView) return null;

  const busy =
    query.isLoading ||
    query.isFetching ||
    patchMutation.isPending ||
    resetMutation.isPending;

  const inputsDisabled = !canEdit || busy;

  const updateField = <K extends keyof InsightThresholdPercentFields>(key: K, raw: string) => {
    const n = parseFloat(raw);
    setForm((prev) => {
      const base =
        prev ??
        (query.data ? thresholdsToPercentFields(query.data) : null);
      if (!base) return prev;
      return { ...base, [key]: Number.isFinite(n) ? n : base[key] };
    });
  };

  const handleSave = () => {
    if (!form || validationCode || !canEdit) return;
    patchMutation.mutate({
      companyId,
      purchaseToSales: {
        warning: form.purchaseWarningPct / 100,
        critical: form.purchaseCriticalPct / 100,
      },
      expenseToSales: {
        warning: form.expenseWarningPct / 100,
        critical: form.expenseCriticalPct / 100,
      },
      netProfitMargin: {
        warningBelow: form.netProfitWarningBelowPct / 100,
      },
    });
  };

  const handleReset = () => {
    if (!canEdit) return;
    if (!window.confirm(t('financialInsightThresholdsResetConfirm'))) return;
    resetMutation.mutate(companyId);
  };

  return (
    <div className="rounded-xl border border-noorix-border bg-noorix-bg-muted/40 p-4 mt-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h4 className="m-0 text-[15px] font-semibold text-noorix-text">
            {t('financialInsightThresholdsSectionTitle')}
          </h4>
          <p className="m-0 mt-1.5 text-[13px] text-noorix-muted leading-relaxed max-w-[52ch]">
            {t('financialInsightThresholdsHelper')}
          </p>
        </div>
        {query.isLoading && !query.data ? (
          <Spinner size="sm" color="muted" />
        ) : null}
      </div>

      {!canEdit && (
        <p className="mt-2 mb-0 text-[12px] text-noorix-muted">{t('financialInsightThresholdsReadOnly')}</p>
      )}

      {query.isError && (
        <p className="mt-2 mb-0 text-[13px] text-noorix-red">{t('financialInsightThresholdsLoadError')}</p>
      )}

      {form && (
        <>
          <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
            <Input
              type="number"
              step={0.1}
              min={0}
              max={100}
              label={t('financialInsightPurchaseWarn')}
              value={String(form.purchaseWarningPct)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                updateField('purchaseWarningPct', e.target.value)
              }
              disabled={inputsDisabled}
            />
            <Input
              type="number"
              step={0.1}
              min={0}
              max={100}
              label={t('financialInsightPurchaseCrit')}
              value={String(form.purchaseCriticalPct)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                updateField('purchaseCriticalPct', e.target.value)
              }
              disabled={inputsDisabled}
            />
            <Input
              type="number"
              step={0.1}
              min={0}
              max={100}
              label={t('financialInsightExpenseWarn')}
              value={String(form.expenseWarningPct)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                updateField('expenseWarningPct', e.target.value)
              }
              disabled={inputsDisabled}
            />
            <Input
              type="number"
              step={0.1}
              min={0}
              max={100}
              label={t('financialInsightExpenseCrit')}
              value={String(form.expenseCriticalPct)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                updateField('expenseCriticalPct', e.target.value)
              }
              disabled={inputsDisabled}
            />
            <Input
              type="number"
              step={0.1}
              min={0}
              max={100}
              label={t('financialInsightNetMarginWarn')}
              value={String(form.netProfitWarningBelowPct)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                updateField('netProfitWarningBelowPct', e.target.value)
              }
              disabled={inputsDisabled}
              className="[grid-column:1/-1]"
            />
          </div>

          {validationHint && (
            <p className="mt-2 mb-0 text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {validationHint}
            </p>
          )}

          {canEdit && (
            <div className="nx-toolbar mt-4 flex-wrap">
              <Button
                type="button"
                variant="primary"
                onClick={handleSave}
                disabled={inputsDisabled || !!validationCode}
              >
                {patchMutation.isPending ? t('financialInsightThresholdsSaving') : t('financialInsightThresholdsSave')}
              </Button>
              <Button type="button" onClick={handleReset} disabled={inputsDisabled}>
                {resetMutation.isPending ? t('financialInsightThresholdsResetting') : t('financialInsightThresholdsReset')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
