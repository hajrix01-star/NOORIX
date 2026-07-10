import { beforeEach, describe, expect, it } from 'vitest';
import { filterByDate, loadChat, saveChat } from './chatStorage';
import type { ChatMessage } from './types';

describe('chatStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores and loads typed chat messages with createdAt metadata', () => {
    const messages: ChatMessage[] = [
      { role: 'user', text: 'sales today', createdAt: '2026-07-07T10:00:00.000Z' },
      { role: 'assistant', textAr: 'ok', textEn: 'ok', createdAt: '2026-07-07T10:00:01.000Z' },
    ];

    saveChat('company-1', { creatorName: 'Owner', creatorId: 'user-1', messages });

    expect(loadChat('company-1')).toEqual({
      creatorName: 'Owner',
      creatorId: 'user-1',
      updatedAt: expect.any(String),
      messages,
    });
  });

  it('rejects invalid stored payloads instead of returning untyped data', () => {
    localStorage.setItem('noorix-chat-company-1', JSON.stringify({ messages: [{ role: 'system' }] }));

    expect(loadChat('company-1')).toEqual({
      creatorName: '',
      creatorId: '',
      updatedAt: expect.any(String),
      messages: [],
    });
  });

  it('filters messages by Saudi date format', () => {
    const messages: ChatMessage[] = [
      { role: 'user', text: 'one', createdAt: '2026-07-07T08:00:00.000Z' },
      { role: 'assistant', textAr: 'two', textEn: 'two', createdAt: '2026-07-08T08:00:00.000Z' },
    ];

    expect(filterByDate(messages, '2026-07-07')).toEqual([messages[0]]);
  });
});
