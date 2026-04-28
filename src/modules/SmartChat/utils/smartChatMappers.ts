import type { ChatAssistantMessage, ChatMessage, ChatMessageInput, ChatUserMessage } from '../types';

export function messageWithCreatedAt(msg: ChatMessageInput): ChatMessage {
  const createdAt = msg.createdAt || new Date().toISOString();
  if (msg.role === 'user') {
    const u = msg as ChatUserMessage;
    return { ...u, createdAt };
  }
  const a = msg as ChatAssistantMessage;
  return { ...a, createdAt };
}
