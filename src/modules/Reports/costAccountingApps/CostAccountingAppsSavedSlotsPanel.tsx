import { formatUiDateTime } from '../../../utils/saudiDate';
import { Button, DialogActions, Modal } from '../../../ui';
import Card from '../../../ui/Card';
import type { CostAppsSavedSlot } from '../costAccountingAppsSavedSlots';

type TranslationFn = (key: string, vars?: Record<string, unknown>) => string;

type CostAccountingAppsSavedSlotsPanelProps = {
  t: TranslationFn;
  lang: string;
  activeCompanyId: string;
  savedSlots: CostAppsSavedSlot[];
  previewSlot: CostAppsSavedSlot | null;
  onPreviewSlot: (slot: CostAppsSavedSlot | null) => void;
  onSaveSlot: () => void;
  onImportSlot: (slot: CostAppsSavedSlot) => void;
  onDeleteSlot: (slotId: string) => void;
};

function formatScenarioPreview(slot: CostAppsSavedSlot) {
  try {
    return JSON.stringify(JSON.parse(slot.scenarioJson), null, 2);
  } catch {
    return slot.scenarioJson;
  }
}

export function CostAccountingAppsSavedSlotsPanel({
  t,
  lang,
  activeCompanyId,
  savedSlots,
  previewSlot,
  onPreviewSlot,
  onSaveSlot,
  onImportSlot,
  onDeleteSlot,
}: CostAccountingAppsSavedSlotsPanelProps) {
  return (
    <>
      <Card
        key={`cost-apps-saved-slots-${activeCompanyId}`}
        variant="surface"
        padding="none"
        className="noorix-print-hidden overflow-hidden border border-noorix-border shadow-sm print:hidden"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-noorix-border bg-[var(--noorix-surface-2)] px-4 py-3">
          <div className="min-w-0">
            <h2 className="m-0 text-[15px] font-bold">{t('reportCostAppsSavedSlotsTitle')}</h2>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={onSaveSlot}>
            {t('reportCostAppsSaveSlotBtn')}
          </Button>
        </div>
        <div className="overflow-x-auto p-3 sm:p-4">
          {savedSlots.length === 0 ? (
            <p className="m-0 px-2 py-8 text-center text-[13px] text-noorix-muted">{t('reportCostAppsSavedSlotsEmpty')}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {savedSlots.map((slot) => (
                <div
                  key={slot.id}
                  className="flex flex-col gap-3 rounded-xl border border-noorix-border bg-[var(--noorix-surface-1)] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0 flex-1 text-center sm:text-start">
                    <p className="m-0 truncate text-sm font-bold text-noorix-text" title={slot.label}>
                      {slot.label}
                    </p>
                    <p className="m-0 mt-1 text-center text-[12px] text-noorix-muted sm:text-start">
                      {formatUiDateTime(slot.savedAt, lang, 'detailed')}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-row flex-wrap items-center justify-center gap-2 sm:justify-end">
                    <Button type="button" variant="ghost" size="sm" className="min-h-9 min-w-[4.5rem] whitespace-nowrap px-3" onClick={() => onPreviewSlot(slot)}>
                      {t('reportCostAppsSavedView')}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="min-h-9 min-w-[5.5rem] whitespace-nowrap px-3"
                      onClick={() => onImportSlot(slot)}
                    >
                      {t('reportCostAppsSavedImport')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="min-h-9 min-w-[4.5rem] whitespace-nowrap px-3 text-noorix-red hover:bg-noorix-red/10"
                      onClick={() => onDeleteSlot(slot.id)}
                    >
                      {t('reportCostAppsSavedDelete')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Modal
        open={!!previewSlot}
        onClose={() => onPreviewSlot(null)}
        title={previewSlot?.label ?? ''}
        size="xl"
        footer={
          previewSlot ? (
            <DialogActions
              actions={[
                {
                  key: 'import-saved-slot',
                  label: t('reportCostAppsSavedImport'),
                  role: 'primary',
                  onClick: () => onImportSlot(previewSlot),
                },
              ]}
            />
          ) : undefined
        }
      >
        {previewSlot ? (
          <pre
            className="m-0 max-w-full overflow-x-auto font-mono text-[12px] leading-relaxed text-noorix-text whitespace-pre-wrap break-words"
            dir="ltr"
          >
            {formatScenarioPreview(previewSlot)}
          </pre>
        ) : null}
      </Modal>
    </>
  );
}
