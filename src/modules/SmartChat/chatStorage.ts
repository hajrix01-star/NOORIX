import { toYmd } from '../../utils/saudiDate';
import type { ChatMessage } from './types';

const PREFIX = 'noorix-chat-';
const MAX_MESSAGES = 500;

export type StoredChat = {
  creatorName: string;
  creatorId: string;
  updatedAt: string;
  messages: ChatMessage[];
};

function safeStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

function key(companyId: string): string {
  return `${PREFIX}${companyId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!isRecord(value) || typeof value.role !== 'string') return false;
  if (value.role === 'user') return typeof value.text === 'string';
  if (value.role === 'assistant') {
    return (
      (value.textAr === undefined || typeof value.textAr === 'string') &&
      (value.textEn === undefined || typeof value.textEn === 'string')
    );
  }
  return false;
}

function normalizeMessage(value: unknown, fallbackDate: string): ChatMessage | null {
  if (!isChatMessage(value)) return null;
  return value.createdAt ? value : { ...value, createdAt: fallbackDate };
}

export function loadChat(companyId: string | undefined): StoredChat | null {
  const storage = safeStorage();
  if (!storage || !companyId) return null;
  try {
    const raw = storage.getItem(key(companyId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.messages)) return null;
    const updatedAt = typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString();
    const messages = parsed.messages
      .map((message) => normalizeMessage(message, updatedAt))
      .filter((message): message is ChatMessage => message !== null)
      .slice(-MAX_MESSAGES);
    return {
      creatorName: typeof parsed.creatorName === 'string' ? parsed.creatorName : '',
      creatorId: typeof parsed.creatorId === 'string' ? parsed.creatorId : '',
      updatedAt,
      messages,
    };
  } catch {
    return null;
  }
}

export function saveChat(
  companyId: string | undefined,
  { creatorName, creatorId, messages }: { creatorName: string; creatorId?: string; messages: ChatMessage[] },
): void {
  const storage = safeStorage();
  if (!storage || !companyId) return;
  try {
    const trimmed = messages.length > MAX_MESSAGES ? messages.slice(-MAX_MESSAGES) : messages;
    const data: StoredChat = {
      creatorName: creatorName || '',
      creatorId: creatorId || '',
      updatedAt: new Date().toISOString(),
      messages: trimmed,
    };
    storage.setItem(key(companyId), JSON.stringify(data));
  } catch {
    // Local chat history must never block the official backend-owned chat response.
  }
}

export function filterByDate(messages: ChatMessage[], dateStr: string): ChatMessage[] {
  if (!dateStr || !messages.length) return messages;
  const target = toYmd(dateStr);
  return messages.filter((message) => {
    const date = message.createdAt ? toYmd(message.createdAt) : '';
    return date === target;
  });
}
