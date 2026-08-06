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
      <SummaryBar
        className="mt-5"
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
