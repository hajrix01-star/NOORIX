import React from 'react';

export function SmartChatTypingIndicator({ isAr }: { isAr: boolean }) {
  return (
    <div className="noorix-chat-msg-row noorix-chat-msg-row--assistant">
      <div className="noorix-chat-typing" aria-label={isAr ? 'يكتب…' : 'Typing…'} role="status">
        <span className="noorix-chat-typing__dot" aria-hidden />
        <span className="noorix-chat-typing__dot" aria-hidden />
        <span className="noorix-chat-typing__dot" aria-hidden />
      </div>
    </div>
  );
}
