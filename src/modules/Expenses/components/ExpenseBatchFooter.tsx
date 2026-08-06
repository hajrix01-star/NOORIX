import { Button, SummaryBar } from '../../../ui';
import { useTranslation } from '../../../i18n/useTranslation';
import type { ExpenseDraftSummary } from '../expenseModels';

type ExpenseBatchFooterProps = {
  summary: ExpenseDraftSummary;
  rowCount: number;
  hasVault: boolean;
  isSaving: boolean;
  onSave: () => void;
};

export function ExpenseBatchFooter({ summary, rowCount, hasVault, isSaving, onSave }: ExpenseBatchFooterProps) {
  const { t } = useTranslation();
  return (
    <>
      {summary.invalidCount > 0 ? (
        <div className="mt-4 rounded-lg border border-noorix-red/30 bg-noorix-red/10 px-3 py-2 text-[13px] font-semibold text-noorix-red" role="alert">
          {t('expenseBatchFixInvalidRows', summary.invalidCount)}
        </div>
      ) : null}
      {summary.draftCount > 0 ? <p className="mt-3 text-[12px] text-noorix-muted">{t('expenseBatchDraftTotalsHint')}</p> : null}
      <SummaryBar
        className="mt-6"
        items={[
          { key: 'rows', label: t('rows'), value: rowCount, tone: 'blue', helper: t('expenseBatchRowsStatus', summary.count, summary.invalidCount) },
          { key: 'net', label: t('expenseBatchDraftNet'), value: summary.totalNet, tone: 'green', currency: 'SR' },
          { key: 'tax', label: t('expenseBatchDraftVat'), value: summary.totalTax, tone: 'amber', currency: 'SR' },
          { key: 'total', label: t('expenseBatchDraftTotal'), value: summary.total, currency: 'SR' },
        ]}
      />
      <Button
        variant="primary"
        size="md"
        onClick={onSave}
        disabled={isSaving || summary.count === 0 || summary.invalidCount > 0 || !hasVault}
        className="mt-3 w-full min-h-[44px] sm:min-h-0"
      >
        {isSaving ? t('saving') : t('save')}
      </Button>
    </>
  );
}
