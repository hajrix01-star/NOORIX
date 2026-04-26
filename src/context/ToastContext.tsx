import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Toast from '../components/Toast';

const ToastContext = createContext(null);

/** تجاهل تكرار نفس الرسالة ونفس النوع خلال هذه المدة (يقلّل الوميض المزدوج). */
const DEDUPE_MS = 2200;

/**
 * إشعارات عائمة موحّدة عبر التطبيق (بدلاً من useState + Toast في كل شاشة).
 */
export function ToastProvider({ children }) {
  const [state, setState] = useState({ visible: false, message: '', type: 'success' });
  const lastRef = useRef({ key: '', at: 0 });

  const showToast = useCallback((message, type = 'success') => {
    if (message == null || message === '') return;
    const msg = String(message);
    const t = type || 'success';
    const now = Date.now();
    const key = `${t}::${msg}`;
    if (lastRef.current.key === key && now - lastRef.current.at < DEDUPE_MS) return;
    lastRef.current = { key, at: now };
    setState({ visible: true, message: msg, type: t });
  }, []);

  const dismiss = useCallback(() => {
    setState((s) => ({ ...s, visible: false }));
  }, []);

  const value = useMemo(() => ({ showToast, dismiss }), [showToast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast visible={state.visible} message={state.message} type={state.type} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
