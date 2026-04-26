/**
 * Noorix Global Error Boundary — يمنع الشاشة البيضاء ويعرض رسالة اعتذار مع زر تحديث.
 */
import React from 'react';
import { Button } from '../ui';

type ErrorBoundaryProps = { children: React.ReactNode };
type ErrorBoundaryState = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (typeof console !== 'undefined' && console.error) {
      console.error('Noorix ErrorBoundary:', error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex flex-col items-center text-center p-6 min-h-[60vh] [font-family:var(--noorix-font-arabic),sans-serif]"
          style={{ direction: 'rtl' }}
        >
          <div
            className="noorix-surface-card max-w-[420px] p-5"
          >
            <div className="text-[20px] mb-3">⚠️</div>
            <h2 className="m-0 text-[16px] text-noorix-text mb-2">
              حدث خطأ غير متوقع
            </h2>
            <p className="m-0 text-noorix-muted text-[14px] mb-5">
              نعتذر عن الإزعاج. يمكنك تحديث الصفحة والمحاولة مرة أخرى.
            </p>
            {this.state.error?.message && (
              <pre className="text-[12px] nx-ltr overflow-auto rounded-lg mb-4 p-3 max-h-[120px] bg-black/5">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex justify-center flex flex-wrap gap-2.5">
              <Button type="button" onClick={this.handleRetry}>
                إعادة المحاولة
              </Button>
              <Button type="button" variant="primary" onClick={this.handleReload}>
                إعادة تحميل الصفحة
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
