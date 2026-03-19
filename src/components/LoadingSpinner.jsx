import React from 'react';

const MESSAGES = { ar: 'جاري التحميل...', en: 'Loading...' };

export default function LoadingSpinner({ message, lang = 'ar' }) {
  const text = message ?? MESSAGES[lang] ?? MESSAGES.ar;
  return (
    <div
      style={{
        padding: 24,
        textAlign: 'center',
        color: 'var(--noorix-text-muted)',
        fontSize: 14,
      }}
      role="status"
      aria-label={text}
    >
      {text}
    </div>
  );
}
