import React from 'react';
import { Button, Input } from '../../../ui';
import type { ChatCommandGroupFiltered } from '../types';

export type SmartChatQuickActionsProps = {
  filteredGroups: ChatCommandGroupFiltered[];
  showFaq: boolean;
  commandsOpen: boolean;
  loading: boolean;
  isAr: boolean;
  narrow: boolean;
  onToggleCommands: () => void;
  onOpenFaq: () => void;
  commandsLabel: string;
  suggestedLabel: string;
  /** عنوان الصفحة في الشريط العلوي */
  headerTitle: string;
  dateFilter: string;
  setDateFilter: (v: string) => void;
  filterDateInputTitle: string;
  clearFilterLabel: string;
};

export function SmartChatQuickActions({
  filteredGroups,
  showFaq,
  commandsOpen,
  loading,
  isAr,
  narrow,
  onToggleCommands,
  onOpenFaq,
  commandsLabel,
  suggestedLabel,
  headerTitle,
  dateFilter,
  setDateFilter,
  filterDateInputTitle,
  clearFilterLabel,
}: SmartChatQuickActionsProps) {
  if (narrow) return null;

  const quickRowCols = filteredGroups.length > 0 && showFaq ? 2 : 1;

  return (
    <div className="noorix-smart-chat-sticky">
      {(filteredGroups.length > 0 || showFaq) && (
        <div
          className={`noorix-smart-chat-quick-row noorix-smart-chat-quick-row--top${quickRowCols === 1 ? ' noorix-smart-chat-quick-row--single' : ''}`}
          dir={isAr ? 'rtl' : 'ltr'}
        >
          {filteredGroups.length > 0 ? (
            <div className="noorix-smart-chat-quick-cell">
              <Button className="noorix-chat-gradient-btn" onClick={onToggleCommands} aria-expanded={commandsOpen}>
                <span className="noorix-chat-gradient-icon" aria-hidden />
                <span className="truncate">{commandsLabel}</span>
                <span className="noorix-chat-chev">{commandsOpen ? '▾' : '▸'}</span>
              </Button>
            </div>
          ) : null}
          {showFaq ? (
            <div className="noorix-smart-chat-quick-cell">
              <Button className="noorix-chat-gradient-btn" onClick={onOpenFaq} disabled={loading}>
                <span className="noorix-chat-gradient-icon" aria-hidden />
                <span className="truncate">{suggestedLabel}</span>
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <header className="noorix-smart-chat-header" dir={isAr ? 'rtl' : 'ltr'}>
        <h1 className="noorix-smart-chat-title">{headerTitle}</h1>
        <div className="noorix-smart-chat-header-actions">
          <Input
            type="date"
            className="noorix-smart-chat-date-input"
            value={dateFilter}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateFilter(e.target.value || '')}
            lang="en"
            title={filterDateInputTitle}
          />
          {dateFilter ? (
            <Button size="sm" onClick={() => setDateFilter('')} className="noorix-smart-chat-filter-clear">
              {clearFilterLabel}
            </Button>
          ) : null}
        </div>
      </header>
    </div>
  );
}
