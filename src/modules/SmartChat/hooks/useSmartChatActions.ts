import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { chatQuery, createCustomAllowance, throwIfApiFailed } from '../../../services/api';
import type { ExpenseLineRecord } from '../../../types/api';
import type { ChatMessage, ChatMessageInput, EntryMode, ExpenseMode, HrRecordedPayload } from '../types';

type CreateEmployeeMutate = {
  mutate: (
    body: unknown,
    opts?: {
      onSuccess?: (res: unknown, empBody: unknown) => void | Promise<void>;
      onError?: (e: unknown) => void;
    },
  ) => void;
};

export type UseSmartChatActionsParams = {
  activeCompanyId: string | undefined;
  isAr: boolean;
  loading: boolean;
  t: (k: string) => string;
  showToast: (msg: string, type?: string) => void;
  input: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  setInput: Dispatch<SetStateAction<string>>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setCommandsOpen: Dispatch<SetStateAction<boolean>>;
  setFaqOpen: (v: boolean) => void;
  setMobileToolsOpen: (v: boolean) => void;
  addMessage: (msg: ChatMessageInput) => void;
  setAddEmployeeOpen: (v: boolean) => void;
  setEntryMode: (v: EntryMode | null) => void;
  setExpenseMode: (v: ExpenseMode) => void;
  setExpenseEditLine: (v: ExpenseLineRecord | null | undefined) => void;
  create: CreateEmployeeMutate;
};

/**
 * إرسال الرسالة، الأوامر، وHR — نفس الاستدعاءات والسلوك السابق.
 */
export function useSmartChatActions({
  activeCompanyId,
  isAr,
  loading,
  t,
  showToast,
  input,
  inputRef,
  setInput,
  setMessages,
  setLoading,
  setCommandsOpen,
  setFaqOpen,
  setMobileToolsOpen,
  addMessage,
  setAddEmployeeOpen,
  setEntryMode,
  setExpenseMode,
  setExpenseEditLine,
  create,
}: UseSmartChatActionsParams) {
  const handleSend = useCallback(
    async (text?: string) => {
      const q = (text ?? input ?? '').trim();
      if (!q || loading) return;

      if (!activeCompanyId) {
        setMessages((prev) => [
          ...prev,
          { role: 'user', text: q },
          {
            role: 'assistant',
            textAr: 'يرجى اختيار شركة أولاً.',
            textEn: 'Please select a company first.',
          },
        ]);
        return;
      }

      setInput('');
      setMessages((prev) => [...prev, { role: 'user', text: q }]);
      setLoading(true);
      setCommandsOpen(false);
      setFaqOpen(false);
      setMobileToolsOpen(false);
      try {
        const res = await chatQuery(q);
        if (res?.success && res?.data) {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              textAr: res.data.answerAr,
              textEn: res.data.answerEn,
              ...(res.data.extras ? { extras: res.data.extras } : {}),
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              textAr: res?.error || 'حدث خطأ.',
              textEn: res?.error || 'An error occurred.',
            },
          ]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', textAr: 'فشل الاتصال.', textEn: 'Connection failed.' },
        ]);
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
    },
    [
      activeCompanyId,
      loading,
      input,
      inputRef,
      setCommandsOpen,
      setFaqOpen,
      setInput,
      setLoading,
      setMessages,
      setMobileToolsOpen,
    ],
  );

  const handleCommand = useCallback(
    (cmd: string) => {
      setCommandsOpen(false);
      setMobileToolsOpen(false);
      if (cmd === 'addEmployee') {
        setAddEmployeeOpen(true);
      } else if (cmd === 'addExpenseLine') {
        setExpenseEditLine(null);
        setExpenseMode('addLine');
      } else if (cmd === 'payExpense') {
        setExpenseMode('pay');
      } else if (cmd === 'editExpenseLine') {
        setExpenseEditLine(undefined);
        setExpenseMode('editLine');
      } else if (['advance', 'leave', 'deduction', 'increase'].includes(cmd)) {
        setEntryMode(cmd as EntryMode);
      }
    },
    [setAddEmployeeOpen, setCommandsOpen, setEntryMode, setExpenseEditLine, setExpenseMode, setMobileToolsOpen],
  );

  const onHrRecorded = useCallback(
    (o: HrRecordedPayload) => {
      if (o?.textAr || o?.textEn) {
        addMessage({
          role: 'assistant',
          textAr: o.textAr || o.textEn,
          textEn: o.textEn || o.textAr,
        });
      }
    },
    [addMessage],
  );

  const handleSaveEmployee = useCallback(
    (payload: unknown) => {
      const p = payload as {
        employeeBody?: unknown;
        customAllowances?: Array<{ nameAr: string; amount: number }>;
      };
      const emptyAllowances: Array<{ nameAr: string; amount: number }> = [];
      const { employeeBody, customAllowances = emptyAllowances } = p?.employeeBody
        ? p
        : { employeeBody: payload, customAllowances: emptyAllowances };

      create.mutate(employeeBody, {
        onSuccess: async (res: unknown, empBody: unknown) => {
          try {
            const r = res as { data?: { id?: string }; id?: string };
            const empId = r?.data?.id || r?.id;
            for (const row of customAllowances) {
              if (row.nameAr && row.amount > 0) {
                const allowRes = await createCustomAllowance({
                  companyId: activeCompanyId,
                  employeeId: empId,
                  nameAr: row.nameAr,
                  amount: row.amount,
                });
                throwIfApiFailed(allowRes, t('saveFailed'));
              }
            }
            showToast(t('employeeAdded'), 'success');
            setAddEmployeeOpen(false);
            const eb = (empBody || employeeBody) as {
              name?: string;
              nameAr?: string;
              nameEn?: string;
              jobTitle?: string;
              basicSalary?: number;
            };
            const empName = eb?.name || eb?.nameAr || eb?.nameEn || '—';
            const salary = Number(eb?.basicSalary ?? 0);
            addMessage({
              role: 'assistant',
              textAr: `النوع: إضافة موظف\nالاسم: ${empName}\nالمسمى: ${eb?.jobTitle || '—'}\nالراتب: ${salary.toLocaleString('en')} SR`,
              textEn: `Type: Add employee\nName: ${empName}\nTitle: ${eb?.jobTitle || '—'}\nSalary: ${salary.toLocaleString('en')} SAR`,
            });
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : t('saveFailed');
            showToast(msg, 'error');
          }
        },
        onError: (e: unknown) =>
          showToast(
            (e instanceof Error ? e.message : undefined) || (isAr ? 'فشل الإضافة' : 'Add failed'),
            'error',
          ),
      });
    },
    [activeCompanyId, addMessage, create, isAr, setAddEmployeeOpen, showToast, t],
  );

  return { handleSend, handleCommand, onHrRecorded, handleSaveEmployee };
}
