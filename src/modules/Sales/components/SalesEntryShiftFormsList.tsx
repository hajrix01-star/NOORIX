import React from 'react';
import { SalesShiftEntryCard } from './SalesShiftEntryCard';
import type { SalesInputVaultRef } from '../../../types/api/domains/sales';
import type { SalesShiftValue } from '../constants/salesShift';
import { emptyShiftEntryForm, type ShiftEntryFormState } from '../constants/salesShiftEntry';
import type { SalesEntryTranslate } from './SalesEntryModalTypes';

type SalesEntryShiftFormsListProps = {
  activeShifts: SalesShiftValue[];
  shiftForms: Partial<Record<SalesShiftValue, ShiftEntryFormState>>;
  setShiftForms: React.Dispatch<React.SetStateAction<Partial<Record<SalesShiftValue, ShiftEntryFormState>>>>;
  salesChannels: SalesInputVaultRef[];
  salesChannelsLoading: boolean;
  salesChannelsError: string;
  lang: string;
  vatEnabled: boolean;
  vatRate: number;
  t: SalesEntryTranslate;
};

export function SalesEntryShiftFormsList({
  activeShifts,
  shiftForms,
  setShiftForms,
  salesChannels,
  salesChannelsLoading,
  salesChannelsError,
  lang,
  vatEnabled,
  vatRate,
  t,
}: SalesEntryShiftFormsListProps) {
  return (
    <div className="flex flex-col gap-4">
      {activeShifts.map((shift) => {
        const form = shiftForms[shift] ?? emptyShiftEntryForm();
        const canCopyFromMorning = shift === 'evening' && activeShifts.includes('morning') && !!shiftForms.morning;

        return (
          <SalesShiftEntryCard
            key={shift}
            shift={shift}
            form={form}
            onChange={(next) => setShiftForms((prev) => ({ ...prev, [shift]: next }))}
            salesChannels={salesChannels}
            salesChannelsLoading={salesChannelsLoading}
            salesChannelsError={salesChannelsError}
            lang={lang}
            vatEnabled={vatEnabled}
            vatRate={vatRate}
            t={t}
            showCopyFromMorning={shift === 'evening' && activeShifts.includes('morning')}
            onCopyFromMorning={
              canCopyFromMorning
                ? () => {
                    const morning = shiftForms.morning!;
                    setShiftForms((prev) => ({
                      ...prev,
                      evening: {
                        ...form,
                        channelAmounts: { ...morning.channelAmounts },
                      },
                    }));
                  }
                : undefined
            }
          />
        );
      })}
    </div>
  );
}
