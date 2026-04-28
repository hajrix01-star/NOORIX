import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { expenseKeys } from '../../../services/queryKeys';
import type { Dispatch, SetStateAction } from 'react';
import type { ChatMessageInput, ExpenseMode } from '../types';

/**
 * نفس سلوك onSaved لنوافذ المصروفات في SmartChat (إبطال الاستعلامات + toast + رسالة مساعد).
 */
export function useSmartChatExpenseModalHandlers({
  isAr,
  showToast,
  addMessage,
  setExpenseMode,
  setExpenseEditLine,
}: {
  isAr: boolean;
  showToast: (msg: string, type?: string) => void;
  addMessage: (msg: ChatMessageInput) => void;
  setExpenseMode: Dispatch<SetStateAction<ExpenseMode>>;
  setExpenseEditLine: Dispatch<SetStateAction<unknown>>;
}) {
  const qc = useQueryClient();

  return useMemo(
    () => ({
      onAddLineSaved: () => {
        invalidateOnFinancialMutation(qc);
        void qc.invalidateQueries({ queryKey: expenseKeys.linesRoot() });
        setExpenseMode(null);
        showToast(isAr ? 'تمت إضافة بند المصروف' : 'Expense line added', 'success');
        addMessage({
          role: 'assistant',
          textAr: 'النوع: إضافة بند مصروف\nالحالة: تمت الإضافة بنجاح',
          textEn: 'Type: Add expense line\nStatus: Added successfully',
        });
      },
      onPaySaved: () => {
        invalidateOnFinancialMutation(qc);
        setExpenseMode(null);
        showToast(isAr ? 'تم تسجيل المصروف' : 'Expense recorded', 'success');
        addMessage({
          role: 'assistant',
          textAr: 'النوع: سداد مصروف\nالحالة: تم التسجيل بنجاح',
          textEn: 'Type: Expense payment\nStatus: Recorded successfully',
        });
      },
      onEditLineSaved: () => {
        invalidateOnFinancialMutation(qc);
        void qc.invalidateQueries({ queryKey: expenseKeys.linesRoot() });
        setExpenseEditLine(undefined);
        setExpenseMode(null);
        showToast(isAr ? 'تم تعديل بند المصروف' : 'Expense line updated', 'success');
        addMessage({
          role: 'assistant',
          textAr: 'النوع: تعديل بند مصروف\nالحالة: تم التعديل بنجاح',
          textEn: 'Type: Edit expense line\nStatus: Updated successfully',
        });
      },
    }),
    [addMessage, isAr, qc, setExpenseEditLine, setExpenseMode, showToast],
  );
}
