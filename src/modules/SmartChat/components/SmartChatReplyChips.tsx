import React from 'react';
import { Button } from '../../../ui';

type Chip = { label: string; text: string };

type Props = {
  chips: Chip[];
  loading: boolean;
  onPick: (text: string) => void;
};

export function SmartChatReplyChips({ chips, loading, onPick }: Props) {
  if (!chips.length) return null;
  return (
    <div className="noorix-chat-chips mt-2">
      {chips.map((c) => (
        <Button
          key={c.text}
          type="button"
          variant="raw"
          size="auto"
          className="noorix-chat-chip"
          disabled={loading}
          onClick={() => onPick(c.text)}
        >
          {c.label}
        </Button>
      ))}
    </div>
  );
}
