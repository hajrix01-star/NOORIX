import React from 'react';
import { Button, AdaptiveSheet } from '../../../ui';
import type { ExpenseLineRecord } from '../../../types/api';

export type SmartChatExpenseLinePickSheetProps = {
  open: boolean;
  title: string;
  isAr: boolean;
  narrow: boolean;
  expenseLines: ExpenseLineRecord[];
  onClose: () => void;
  onPickLine: (line: ExpenseLineRecord) => void;
};

export function SmartChatExpenseLinePickSheet({
  open,
  title,
  isAr,
  narrow,
  expenseLines,
  onClose,
  onPickLine,
}: SmartChatExpenseLinePickSheetProps) {
  return (
    <AdaptiveSheet
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      side={narrow ? 'bottom' : 'start'}
      className="smartchat-expense-pick-drawer"
    >
      <div className="flex flex-col gap-2">
        {expenseLines
          .filter((l) => l.isActive !== false)
          .map((line) => (
            <Button
              key={line.id}
              className={`w-full justify-start py-3 px-[14px] ${isAr ? 'text-right' : 'text-left'}`}
              onClick={() => onPickLine(line)}
            >
              {line.nameAr || line.nameEn || line.name || '—'}
            </Button>
          ))}
      </div>
    </AdaptiveSheet>
  );
}
