/**
 * أنواع محادثة SmartChat — واجهة فقط (لا تغيير عقود API)
 */

import type { ReactNode } from 'react';
import type { ChatResponseExtras } from '../../types/api';

export type ChatRole = 'user' | 'assistant';

export type ChatMessageBase = {
  createdAt?: string;
};

export type ChatUserMessage = ChatMessageBase & {
  role: 'user';
  text: string;
};

/** حمولة اختيارية من الخادم (مخططات وغيرها) — نفس شكل `chatQuery` */
export type ChatAnswerExtras = ChatResponseExtras;

export type ChatAssistantMessage = ChatMessageBase & {
  role: 'assistant';
  textAr?: string;
  textEn?: string;
  extras?: ChatAnswerExtras;
};

export type ChatMessage = ChatUserMessage | ChatAssistantMessage;

/** إدخال رسالة جديدة (مطابقة `addMessage` / `messageWithCreatedAt`) */
export type ChatMessageInput =
  | (Omit<ChatUserMessage, 'createdAt'> & { createdAt?: string })
  | (Omit<ChatAssistantMessage, 'createdAt'> & { createdAt?: string });

export type EntryMode = 'advance' | 'leave' | 'deduction' | 'increase';

export type ExpenseMode = 'addLine' | 'pay' | 'editLine' | null;

export type PermissionChecker = (permission: string) => boolean;

export type PermanentQuestion = {
  key: string;
  section: string;
  ar: string;
  en: string;
  shortAr?: string;
  shortEn?: string;
  canUse: (can: PermissionChecker) => boolean;
};

export type ChatCommandItem = {
  key: string;
  labelAr: string;
  labelEn: string;
  icon: string;
  canUse: (can: PermissionChecker) => boolean;
};

export type ChatCommandGroup = {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: string;
  items: ChatCommandItem[];
};

export type ChatCommandGroupFiltered = ChatCommandGroup & { items: ChatCommandItem[] };

export type HrRecordedPayload = { textAr?: string; textEn?: string };

export type SmartChatMobileToolsBodyProps = {
  isAr: boolean;
  dateFilter: string;
  setDateFilter: (v: string) => void;
  t: (k: string) => string;
  filteredGroups: ChatCommandGroupFiltered[];
  showFaq: boolean;
  visibleFaqQuestions: PermanentQuestion[];
  handleCommand: (key: string) => void;
  handleSend: (text?: string) => void | Promise<void>;
  onCloseSheet: () => void;
};

/** عنصر أسئلة FAQ في العرض — يطابق FAQ_SECTION_ORDER */
export type FaqSectionMeta = { id: string; labelAr: string; labelEn: string };
