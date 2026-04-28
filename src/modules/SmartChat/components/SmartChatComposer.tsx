import React from 'react';
import { Button, Input } from '../../../ui';
import { SendIcon } from '../SmartChatIcons';

export type SmartChatComposerProps = {
  input: string;
  onChange: (v: string) => void;
  onSend: () => void;
  loading: boolean;
  disabledNoCompany: boolean;
  placeholder: string;
  inputAriaLabel: string;
  sendTitle: string;
  sendAriaLabel: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
};

export function SmartChatComposer({
  input,
  onChange,
  onSend,
  loading,
  disabledNoCompany,
  placeholder,
  inputAriaLabel,
  sendTitle,
  sendAriaLabel,
  inputRef,
}: SmartChatComposerProps) {
  return (
    <div className="noorix-chat-input-bar">
      <Input
        ref={inputRef}
        type="text"
        className="noorix-chat-input-field"
        value={input}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) =>
          e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), void onSend())
        }
        placeholder={placeholder}
        disabled={loading || disabledNoCompany}
        aria-label={inputAriaLabel}
      />
      <Button
        type="button"
        className="noorix-chat-send-btn"
        onClick={() => void onSend()}
        disabled={loading || !input.trim() || disabledNoCompany}
        title={sendTitle}
        aria-label={sendAriaLabel}
      >
        {loading ? <span className="noorix-chat-spinner" aria-hidden /> : <SendIcon />}
      </Button>
    </div>
  );
}
