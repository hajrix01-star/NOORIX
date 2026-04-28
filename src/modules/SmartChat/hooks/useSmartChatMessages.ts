import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { loadChat, saveChat, filterByDate } from '../chatStorage';
import { CHAT_PAGE_SIZE } from '../utils/smartChatConstants';
import { messageWithCreatedAt } from '../utils/smartChatMappers';
import type { ChatMessage, ChatMessageInput } from '../types';

export function useSmartChatMessages(
  activeCompanyId: string | undefined,
  userName: string,
  userId: string | undefined,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [creatorName, setCreatorName] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [visibleMessageCount, setVisibleMessageCount] = useState(CHAT_PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const skipScrollToEndRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.body.classList.add('noorix-page-smart-chat');
    return () => document.body.classList.remove('noorix-page-smart-chat');
  }, []);

  useEffect(() => {
    if (!activeCompanyId) return;
    const data = loadChat(activeCompanyId);
    if (data?.messages?.length) {
      setMessages(data.messages as ChatMessage[]);
      setCreatorName(data.creatorName || userName || '');
    } else {
      setMessages([]);
      setCreatorName(userName || '');
    }
  }, [activeCompanyId]);

  const persistChat = useCallback(() => {
    if (!activeCompanyId || !messages.length) return;
    saveChat(activeCompanyId, {
      creatorName: creatorName || userName,
      creatorId: userId,
      messages,
    });
  }, [activeCompanyId, messages, creatorName, userName, userId]);

  useEffect(() => {
    saveTimerRef.current = setTimeout(persistChat, 600);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [messages, persistChat]);

  const filteredMessages = useMemo(() => {
    const base = dateFilter ? filterByDate(messages, dateFilter) : messages;
    return base.length > 100 ? base.slice(-100) : base;
  }, [messages, dateFilter]);

  useEffect(() => {
    setVisibleMessageCount(CHAT_PAGE_SIZE);
  }, [activeCompanyId, dateFilter]);

  const displayedMessages = useMemo(() => {
    if (filteredMessages.length <= visibleMessageCount) return filteredMessages;
    return filteredMessages.slice(-visibleMessageCount);
  }, [filteredMessages, visibleMessageCount]);

  const olderHiddenCount = filteredMessages.length - displayedMessages.length;

  const handleLoadMoreMessages = useCallback(() => {
    const el = messagesScrollRef.current;
    const prevScrollHeight = el?.scrollHeight ?? 0;
    skipScrollToEndRef.current = true;
    setVisibleMessageCount((c) => c + CHAT_PAGE_SIZE);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (el) el.scrollTop += el.scrollHeight - prevScrollHeight;
        skipScrollToEndRef.current = false;
      });
    });
  }, []);

  useEffect(() => {
    if (skipScrollToEndRef.current) return;
    const scroller = messagesScrollRef.current;
    if (!scroller) return;
    requestAnimationFrame(() => {
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
    });
  }, [displayedMessages, loading]);

  const addMessage = useCallback(
    (msg: ChatMessageInput) => {
      const withMeta = messageWithCreatedAt(msg);
      setMessages((prev) => [...prev, withMeta]);
      if (!creatorName && userName) setCreatorName(userName);
    },
    [creatorName, userName],
  );

  return {
    messages,
    setMessages,
    creatorName,
    setCreatorName,
    dateFilter,
    setDateFilter,
    visibleMessageCount,
    setVisibleMessageCount,
    loading,
    setLoading,
    messagesScrollRef,
    filteredMessages,
    displayedMessages,
    olderHiddenCount,
    handleLoadMoreMessages,
    addMessage,
  };
}
