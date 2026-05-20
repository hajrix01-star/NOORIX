import React from 'react';

type Chip = { label: string; text: string };

type Props = {
  chips: Chip[];
  loading: boolean;
  onPick: (text: string) => void;
};

export function SmartChatReplyChips({ chips, loading, onPick }: Props) {
  if (!chips.length) return null;
  return (
    <div className="noorix-chat-chips" style={{ marginTop: 8 }}>
      {chips.map((c) => (
        <button
          key={c.text}
          type="button"
          className="noorix-chat-chip"
          disabled={loading}
          onClick={() => onPick(c.text)}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
