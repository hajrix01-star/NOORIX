import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Toast from '../components/Toast';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | string;

export type ToastContextValue = {
  showToast: (message: unknown, type?: ToastType) => void;
  dismiss: () => void;
};

type ToastState = {
  visible: boolean;
  message: string;
  type: ToastType;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let warnedMissingToastProvider = false;

const fallbackToastContext: ToastContextValue = {
  showToast: (message: unknown, type: ToastType = 'info') => {
    if (typeof console !== 'undefined' && !warnedMissingToastProvider) {
      warnedMissingToastProvider = true;
      console.warn('ToastProvider is not available; dispatching a fallback toast event.', { type });
    }
    if (typeof window !== 'undefined' && message != null && message !== '') {
      window.dispatchEvent(
        new CustomEvent('noorix:toast', {
          detail: { message: String(message), type },
        }),
      );
    }
  },
  dismiss: () => {},
};

/** تجاهل تكرار نفس الرسالة ونفس النوع خلال هذه المدة (يقلّل الوميض المزدوج). */
const DEDUPE_MS = 2200;

/**
 * إشعارات عائمة موحّدة عبر التطبيق (بدلاً من useState + Toast في كل شاشة).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ToastState>({ visible: false, message: '', type: 'success' });
  const lastRef = useRef({ key: '', at: 0 });

  const showToast = useCallback((message: unknown, type: ToastType = 'success') => {
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

  const value = useMemo<ToastContextValue>(() => ({ showToast, dismiss }), [showToast, dismiss]);

  useEffect(() => {
    const handleFallbackToast = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: unknown; type?: ToastType }>).detail;
      if (!detail?.message) return;
      showToast(detail.message, detail.type);
    };
    window.addEventListener('noorix:toast', handleFallbackToast);
    return () => window.removeEventListener('noorix:toast', handleFallbackToast);
  }, [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast visible={state.visible} message={state.message} type={state.type} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx === undefined) {
    return fallbackToastContext;
  }
  return ctx;
}
