import { useState, useRef, useCallback } from 'react';

export function useSmartChatComposer() {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const onChange = useCallback((v: string) => setInput(v), []);

  return { input, setInput, onChange, inputRef };
}