import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import Toast from '../components/Toast';

const ToastContext = createContext(null);

/**
 * إشعارات عائمة موحّدة عبر التطبيق (بدلاً من useState + Toast في كل شاشة).
 */
export function ToastProvider({ children }) {
  const [state, setState] = useState({ visible: false, message: '', type: 'success' });

  const showToast = useCallback((message, type = 'success') => {
    if (message == null || message === '') return;
    setState({ visible: true, message: String(message), type: type || 'success' });
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
