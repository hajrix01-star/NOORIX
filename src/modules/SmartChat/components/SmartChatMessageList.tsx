import React from 'react';
import { Button } from '../../../ui';
import type { ChatMessage } from '../types';
import { SmartChatMessageBubble } from './SmartChatMessageBubble';
import { SmartChatEmptyState } from './SmartChatEmptyState';

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
}: SmartChatMessageListProps) {
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
      {displayedMessages.length === 0 &&
        (dateFilter ? (
          <div className="text-noorix-muted text-[14px] text-center p-6">{emptyFilteredHint}</div>
        ) : (
          <SmartChatEmptyState narrow={narrow} isAr={isAr} />
        ))}
      {displayedMessages.map((m, i) => (
        <SmartChatMessageBubble key={i} message={m} isAr={isAr} />
      ))}
      {loading && (
        <div className="noorix-chat-msg-row noorix-chat-msg-row--assistant">
          <div className="noorix-chat-skeleton-card" aria-hidden>
            <div className="noorix-chat-skeleton-line noorix-chat-skeleton-line--sm" />
            <div className="noorix-chat-skeleton-line" />
            <div className="noorix-chat-skeleton-line noorix-chat-skeleton-line--lg" />
          </div>
          <div className="sr-only">{isAr ? 'جاري البحث…' : 'Searching…'}</div>
        </div>
      )}
    </div>
  );
}
