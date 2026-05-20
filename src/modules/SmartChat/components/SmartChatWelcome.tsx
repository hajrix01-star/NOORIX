import React from 'react';
import type { PermanentQuestion, PermissionChecker } from '../types';

type Props = {
  userName: string;
  isAr: boolean;
  loading: boolean;
  topQuestions: PermanentQuestion[];
  onPick: (text: string) => void;
};

export function SmartChatWelcome({ userName, isAr, loading, topQuestions, onPick }: Props) {
  const firstName = userName.split(' ')[0] || (isAr ? 'بك' : 'you');

  return (
    <div className="noorix-chat-msg-row noorix-chat-msg-row--assistant">
      <div className="noorix-chat-welcome">
        <div className="noorix-chat-welcome__greeting">
          {isAr ? `مرحباً ${firstName} 👋` : `Hello ${firstName} 👋`}
        </div>
        <div className="noorix-chat-welcome__sub">
          {isAr ? 'ماذا تريد اليوم؟' : 'What can I help you with today?'}
        </div>
        {topQuestions.length > 0 && (
          <div className="noorix-chat-chips">
            {topQuestions.map((q) => (
              <button
                key={isAr ? q.ar : q.en}
                type="button"
                className="noorix-chat-chip"
                disabled={loading}
                onClick={() => onPick(isAr ? q.ar : q.en)}
              >
                {isAr ? (q.shortAr || q.ar) : (q.shortEn || q.en)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
