/**
 * SmartChatScreen — حاوية المحادثة الذكية (منطق الصفحة في hooks ومكوّنات فرعية).
 */
import React, { useMemo, useState, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from '../../i18n/useTranslation';
import { getStoredUser } from '../../services/authStore';
import { hasPermission } from '../../constants/permissions';
import { HrQuickEntrySheet } from '../HR/components/HrQuickEntrySheet';
import { StaffFormModal } from '../HR/components/StaffFormModal';
import { useEmployees } from '../../hooks/useEmployees';
import ExpenseLineFormModal from '../Expenses/components/ExpenseLineFormModal';
import ExpenseFormModal from '../Expenses/components/ExpenseFormModal';
import './SmartChatScreen.css';
import { AdaptiveSheet, useAdaptiveSheetNarrow } from '../../ui';
import { PERMANENT_QUESTIONS } from './utils/smartChatConstants';
import { filterCommandGroups, filterVisibleFaqQuestions, canUseChatPresetFaq } from './utils/smartChatGuards';
import type { EntryMode, ExpenseMode } from './types';
import { useSmartChatMessages } from './hooks/useSmartChatMessages';
import { useSmartChatUploads } from './hooks/useSmartChatUploads';
import { useSmartChatComposer } from './hooks/useSmartChatComposer';
import { useSmartChatActions } from './hooks/useSmartChatActions';
import { useSmartChatExpenseModalHandlers } from './hooks/useSmartChatExpenseModalHandlers';
import { useSmartChatUsage } from './hooks/useSmartChatUsage';
import { SmartChatMessageList } from './components/SmartChatMessageList';
import { SmartChatComposer } from './components/SmartChatComposer';
import { SmartChatQuickActions } from './components/SmartChatQuickActions';
import { SmartChatMobileToolsBody } from './components/SmartChatMobileTools';
import { SmartChatFaqList } from './components/SmartChatFaqList';
import { SmartChatMobileStickyHeader } from './components/SmartChatMobileStickyHeader';
import { SmartChatCommandsPanel } from './components/SmartChatCommandsPanel';
import { SmartChatExpenseLinePickSheet, type ExpenseLineRow } from './components/SmartChatExpenseLinePickSheet';
import { SmartChatWelcome } from './components/SmartChatWelcome';
import { SmartChatTypingIndicator } from './components/SmartChatTypingIndicator';
import { SmartChatReplyChips } from './components/SmartChatReplyChips';

export default function SmartChatScreen() {
  const { activeCompanyId } = useApp();
  const { t, lang } = useTranslation();
  const { showToast } = useToast();
  const narrow = useAdaptiveSheetNarrow();

  const u = getStoredUser();
  const userName = u?.nameAr || u?.nameEn || u?.email || '';
  const userId = u?.id;
  const isAr = lang === 'ar';

  const [faqOpen, setFaqOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<EntryMode | null>(null);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const [expenseMode, setExpenseMode] = useState<ExpenseMode>(null);
  const [expenseEditLine, setExpenseEditLine] = useState<unknown>(null);

  const can = useMemo(
    () => (p: string) => hasPermission(u?.role, p, u?.permissions || []),
    [u?.role, u?.permissions],
  );

  const showFaq = canUseChatPresetFaq(can);
  const visibleFaqQuestions = filterVisibleFaqQuestions(showFaq, PERMANENT_QUESTIONS, can);
  const filteredGroups = useMemo(() => filterCommandGroups(can), [can]);

  const { recordUsage, getSortedQuestions } = useSmartChatUsage(activeCompanyId, userId);
  const topWelcomeChips = useMemo(() => getSortedQuestions(can, isAr), [getSortedQuestions, can, isAr]);

  const {
    setMessages,
    setLoading,
    dateFilter,
    setDateFilter,
    loading,
    messagesScrollRef,
    displayedMessages,
    olderHiddenCount,
    handleLoadMoreMessages,
    addMessage,
  } = useSmartChatMessages(activeCompanyId, userName, userId);

  const { expenseLines } = useSmartChatUploads(activeCompanyId, expenseMode);
  const { create } = useEmployees(activeCompanyId || '', { fetchEnabled: false });
  const { input, setInput, onChange, inputRef } = useSmartChatComposer();

  const { handleSend, handleCommand, onHrRecorded, handleSaveEmployee } = useSmartChatActions({
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
  });

  // دالة مغلّفة تسجّل الاستخدام قبل الإرسال
  const handleSendTracked = useCallback(
    async (text?: string) => {
      const q = (text ?? input ?? '').trim();
      if (q) recordUsage(q);
      await handleSend(text);
    },
    [handleSend, input, recordUsage],
  );

  // chips متابعة سياقية بعد الرد (تُحسب من آخر سؤال)
  const replyChips = useMemo(() => {
    if (!activeCompanyId) return [];
    const lastUser = [...displayedMessages].reverse().find((m) => m.role === 'user') as any;
    if (!lastUser) return [];
    const q: string = (lastUser.text || '').toLowerCase();
    if (q.includes('مبيعات اليوم') || q.includes('today')) {
      return [
        { label: isAr ? 'أمس' : 'Yesterday', text: isAr ? 'كم مبيعات أمس؟' : 'What are yesterday\'s sales?' },
        { label: isAr ? 'هذا الشهر' : 'This month', text: isAr ? 'كم مبيعات هذا الشهر؟' : 'What are this month\'s sales?' },
        { label: isAr ? 'مقارنة الشهر' : 'Month compare', text: isAr ? 'مبيعات الشهر الحالي مقابل الماضي (نفس الفترة)' : 'This month vs last month sales (aligned partial months).' },
      ];
    }
    if (q.includes('مبيعات') || q.includes('sale')) {
      return [
        { label: isAr ? 'أرصدة الخزائن' : 'Vault balances', text: isAr ? 'ما أرصدة الخزائن؟' : 'What are vault balances?' },
        { label: isAr ? 'ملخص الربح' : 'P&L', text: isAr ? 'أعطني ملخص الربح والخسارة' : 'Give me P&L summary' },
      ];
    }
    if (q.includes('خزائن') || q.includes('vault')) {
      return [
        { label: isAr ? 'مبيعات اليوم' : 'Today\'s sales', text: isAr ? 'كم مبيعات اليوم؟' : 'What are today\'s sales?' },
        { label: isAr ? 'ملخص الربح' : 'P&L', text: isAr ? 'أعطني ملخص الربح والخسارة' : 'Give me P&L summary' },
      ];
    }
    return [];
  }, [displayedMessages, isAr, activeCompanyId]);

  const { onAddLineSaved, onPaySaved, onEditLineSaved } = useSmartChatExpenseModalHandlers({
    isAr,
    showToast,
    addMessage,
    setExpenseMode,
    setExpenseEditLine,
  });

  const expenseLinesRows = expenseLines as ExpenseLineRow[];

  return (
    <div className="noorix-smart-chat-root">
      {!activeCompanyId && (
        <div className="noorix-surface-card text-center text-noorix-muted p-6 m-4">{t('pleaseSelectCompany')}</div>
      )}

      {activeCompanyId && narrow && (
        <SmartChatMobileStickyHeader
          isAr={isAr}
          dateFilter={dateFilter}
          title={t('smartChat')}
          filterByDateLabel={t('chatFilterByDate')}
          toolsLabel={t('chatToolsMenu')}
          onOpenTools={() => setMobileToolsOpen(true)}
        />
      )}

      {activeCompanyId && !narrow && (
        <SmartChatQuickActions
          filteredGroups={filteredGroups}
          showFaq={showFaq}
          commandsOpen={commandsOpen}
          loading={loading}
          isAr={isAr}
          narrow={narrow}
          onToggleCommands={() => setCommandsOpen((o) => !o)}
          onOpenFaq={() => setFaqOpen(true)}
          commandsLabel={t('chatCommands')}
          suggestedLabel={isAr ? 'أسئلة جاهزة' : 'Suggested'}
          headerTitle={t('smartChat')}
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
          filterDateInputTitle={isAr ? 'تصفية بالتاريخ' : 'Filter by date'}
          clearFilterLabel={t('chatClearFilter')}
        />
      )}

      {activeCompanyId && (
        <div className="noorix-smart-chat-card">
          <SmartChatMessageList
            displayedMessages={displayedMessages}
            olderHiddenCount={olderHiddenCount}
            onLoadMore={handleLoadMoreMessages}
            loading={loading}
            isAr={isAr}
            narrow={narrow}
            dateFilter={dateFilter}
            emptyFilteredHint={t('chatNoMessagesOnDate')}
            loadMoreLabel={t('chatLoadMoreCount', String(olderHiddenCount))}
            scrollRef={messagesScrollRef}
            userName={userName}
            topWelcomeChips={topWelcomeChips}
            onChipPick={(text) => void handleSendTracked(text)}
            replyChips={replyChips}
          />
          <SmartChatComposer
            input={input}
            onChange={onChange}
            onSend={() => void handleSendTracked()}
            loading={loading}
            disabledNoCompany={!activeCompanyId}
            placeholder={t('chatInputPlaceholder')}
            inputAriaLabel={t('chatInputPlaceholder')}
            sendTitle={isAr ? 'إرسال' : 'Send'}
            sendAriaLabel={isAr ? 'إرسال' : 'Send'}
            inputRef={inputRef}
          />
        </div>
      )}

      {!narrow && faqOpen && (
        <AdaptiveSheet
          open
          onClose={() => setFaqOpen(false)}
          title={isAr ? 'أسئلة جاهزة' : 'Suggested questions'}
          size="md"
          side="start"
          className="smartchat-faq-drawer"
        >
          <SmartChatFaqList
            visibleFaqQuestions={visibleFaqQuestions}
            isAr={isAr}
            onPickQuestion={(text) => {
              void handleSendTracked(text);
              setFaqOpen(false);
            }}
          />
        </AdaptiveSheet>
      )}

      {entryMode && activeCompanyId && (
        <HrQuickEntrySheet
          key={entryMode}
          mode={entryMode}
          companyId={activeCompanyId}
          onClose={() => setEntryMode(null)}
          onRecorded={onHrRecorded}
          variant="modal"
        />
      )}

      {addEmployeeOpen && activeCompanyId && (
        <StaffFormModal
          employee={null}
          companyId={activeCompanyId}
          onSave={handleSaveEmployee}
          onClose={() => setAddEmployeeOpen(false)}
          isSaving={create.isPending}
        />
      )}

      {expenseMode === 'addLine' && activeCompanyId && (
        <ExpenseLineFormModal
          companyId={activeCompanyId}
          editing={null}
          onClose={() => setExpenseMode(null)}
          onSaved={onAddLineSaved}
        />
      )}

      {expenseMode === 'pay' && activeCompanyId && (
        <ExpenseFormModal
          companyId={activeCompanyId}
          onClose={() => setExpenseMode(null)}
          onSaved={onPaySaved}
        />
      )}

      {expenseMode === 'editLine' && activeCompanyId && expenseEditLine === undefined ? (
        <SmartChatExpenseLinePickSheet
          open
          title={t('chatEditFixedExpense')}
          isAr={isAr}
          narrow={narrow}
          expenseLines={expenseLinesRows}
          onClose={() => setExpenseMode(null)}
          onPickLine={(line) => setExpenseEditLine(line)}
        />
      ) : null}

      {expenseMode === 'editLine' && activeCompanyId && expenseEditLine !== undefined ? (
        <ExpenseLineFormModal
          companyId={activeCompanyId}
          editing={expenseEditLine}
          onClose={() => {
            setExpenseEditLine(undefined);
            setExpenseMode(null);
          }}
          onSaved={onEditLineSaved}
        />
      ) : null}

      <AdaptiveSheet
        open={!!(activeCompanyId && !narrow && commandsOpen && filteredGroups.length > 0)}
        onClose={() => setCommandsOpen(false)}
        title={isAr ? 'أوامر المحادثة' : 'Chat commands'}
        size="md"
        side="start"
        className="smartchat-commands-drawer"
      >
        <SmartChatCommandsPanel filteredGroups={filteredGroups} isAr={isAr} onCommand={handleCommand} />
      </AdaptiveSheet>

      {activeCompanyId && narrow && (
        <AdaptiveSheet
          open={mobileToolsOpen}
          onClose={() => setMobileToolsOpen(false)}
          title={t('chatToolsSheetTitle')}
          size="lg"
          side="bottom"
          className="smartchat-mobile-tools-sheet"
        >
          <SmartChatMobileToolsBody
            isAr={isAr}
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            t={t}
            filteredGroups={filteredGroups}
            showFaq={showFaq}
            visibleFaqQuestions={visibleFaqQuestions}
            handleCommand={handleCommand}
            handleSend={handleSendTracked}
            onCloseSheet={() => setMobileToolsOpen(false)}
          />
        </AdaptiveSheet>
      )}
    </div>
  );
}
