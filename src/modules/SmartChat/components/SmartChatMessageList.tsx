import React from 'react';
import { Button } from '../../../ui';
import type { ChatMessage, PermanentQuestion } from '../types';
import { SmartChatMessageBubble } from './SmartChatMessageBubble';
import { SmartChatEmptyState } from './SmartChatEmptyState';
import { SmartChatWelcome } from './SmartChatWelcome';
import { SmartChatTypingIndicator } from './SmartChatTypingIndicator';
import { SmartChatReplyChips } from './SmartChatReplyChips';

export type SmartChatMessageListProps = {
  displayedMessages: ChatMessage[];
  olderHiddenCount: number;
  onLoadMore: () => void;
  loading: boolean;
  isAr: boolean;
  narrow: boolean;
  dateFilter: string;
  emptyFilteredHint: string;
  loadMoreLabel: string;
  scrollRef: React.Ref<HTMLDivElement>;
  userName: string;
  topWelcomeChips: PermanentQuestion[];
  onChipPick: (text: string) => void;
  replyChips: Array<{ label: string; text: string }>;
};

export function SmartChatMessageList({
  displayedMessages,
  olderHiddenCount,
  onLoadMore,
  loading,
  isAr,
  narrow,
  dateFilter,
  emptyFilteredHint,
  loadMoreLabel,
  scrollRef,
  userName,
  topWelcomeChips,
  onChipPick,
  replyChips,
}: SmartChatMessageListProps) {
  const isEmpty = displayedMessages.length === 0;
  const showWelcome = isEmpty && !dateFilter;
  const lastIsAssistant =
    displayedMessages.length > 0 &&
    displayedMessages[displayedMessages.length - 1].role === 'assistant';

  return (
    <div
      className="noorix-smart-chat-messages"
      ref={scrollRef}
      data-chat-scroll
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-busy={loading}
    >
      {olderHiddenCount > 0 && (
        <Button className="noorix-smart-chat-load-more" onClick={onLoadMore}>
          {loadMoreLabel}
        </Button>
      )}

      {/* ترحيب عند فتح محادثة فارغة */}
      {showWelcome && (
        <SmartChatWelcome
          userName={userName}
          isAr={isAr}
          loading={loading}
          topQuestions={topWelcomeChips}
          onPick={onChipPick}
        />
      )}

      {/* رسالة «لا رسائل لهذا التاريخ» */}
      {isEmpty && dateFilter && (
        <div className="text-noorix-muted text-[14px] text-center p-6">{emptyFilteredHint}</div>
      )}

      {/* الرسائل */}
      {displayedMessages.map((m, i) => (
        <SmartChatMessageBubble key={i} message={m} isAr={isAr} />
      ))}

      {/* مؤشر الكتابة أثناء الانتظار */}
      {loading && <SmartChatTypingIndicator isAr={isAr} />}

      {/* chips متابعة بعد آخر رد من البوت */}
      {!loading && lastIsAssistant && replyChips.length > 0 && (
        <div className="noorix-chat-msg-row noorix-chat-msg-row--assistant">
          <SmartChatReplyChips chips={replyChips} loading={loading} onPick={onChipPick} />
        </div>
      )}
    </div>
  );
}
