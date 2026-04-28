import React from 'react';
import type { ChatAssistantMessage, ChatMessage, ChatUserMessage } from '../types';
import { SmartChatReportCard } from './SmartChatReportCard';

export type SmartChatMessageBubbleProps = {
  message: ChatMessage;
  isAr: boolean;
};

export function SmartChatMessageBubble({ message, isAr }: SmartChatMessageBubbleProps) {
  if (message.role === 'user') {
    const m = message as ChatUserMessage;
    return (
      <div className="noorix-chat-msg-row noorix-chat-msg-row--user">
        <div className="noorix-chat-bubble--user">{m.text}</div>
      </div>
    );
  }
  const m = message as ChatAssistantMessage;
  return (
    <div className="noorix-chat-msg-row noorix-chat-msg-row--assistant">
      <div className="noorix-chat-bubble-assistant">
        <SmartChatReportCard
          text={(isAr ? m.textAr : m.textEn) || m.textAr || ''}
          isAr={isAr}
          createdAt={m.createdAt}
          extras={m.extras}
        />
      </div>
    </div>
  );
}
