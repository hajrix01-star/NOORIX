import React from 'react';
import { Button } from '../../../ui';

export type SmartChatMobileStickyHeaderProps = {
  isAr: boolean;
  dateFilter: string;
  title: string;
  filterByDateLabel: string;
  toolsLabel: string;
  onOpenTools: () => void;
};

export function SmartChatMobileStickyHeader({
  isAr,
  dateFilter,
  title,
  filterByDateLabel,
  toolsLabel,
  onOpenTools,
}: SmartChatMobileStickyHeaderProps) {
  return (
    <div className="noorix-smart-chat-sticky noorix-smart-chat-sticky--mobile-toolbar">
      <header className="noorix-smart-chat-mobile-header" dir={isAr ? 'rtl' : 'ltr'}>
        <h1 className="noorix-smart-chat-mobile-title">{title}</h1>
        {dateFilter ? (
          <span className="noorix-smart-chat-date-badge" title={filterByDateLabel}>
            {dateFilter.slice(5).replace('-', '/')}
          </span>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="primary"
          className="noorix-smart-chat-tools-btn shrink-0"
          onClick={onOpenTools}
          aria-haspopup="dialog"
        >
          {toolsLabel}
        </Button>
      </header>
    </div>
  );
}
