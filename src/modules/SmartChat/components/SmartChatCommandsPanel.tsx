import React from 'react';
import { Button } from '../../../ui';
import type { ChatCommandGroupFiltered } from '../types';

export type SmartChatCommandsPanelProps = {
  filteredGroups: ChatCommandGroupFiltered[];
  isAr: boolean;
  onCommand: (key: string) => void;
};

export function SmartChatCommandsPanel({ filteredGroups, isAr, onCommand }: SmartChatCommandsPanelProps) {
  return (
    <div className="noorix-chat-commands-panel-content" dir={isAr ? 'rtl' : 'ltr'}>
      {filteredGroups.map((g) => (
        <div key={g.id} className="noorix-chat-commands-group">
          <div className="noorix-chat-commands-group-label">
            {g.icon} {isAr ? g.labelAr : g.labelEn}
          </div>
          <div className={`noorix-chat-commands-grid${g.items.length === 1 ? ' noorix-chat-commands-grid--single' : ''}`}>
            {g.items.map((it) => (
              <Button key={it.key} className="noorix-chat-commands-item" onClick={() => onCommand(it.key)}>
                <span aria-hidden>{it.icon}</span>
                <span>{isAr ? it.labelAr : it.labelEn}</span>
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
