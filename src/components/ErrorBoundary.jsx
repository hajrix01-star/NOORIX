/**
 * Noorix Global Error Boundary — يمنع الشاشة البيضاء ويعرض رسالة اعتذار مع زر تحديث.
 */
import React from 'react';
import { Button } from '../ui';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
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
          className="flex flex-col items-center text-center p-6"
          style={{ minHeight: '60vh', fontFamily: 'var(--noorix-font-arabic), sans-serif', direction: 'rtl' }}
        >
          <div
            className="noorix-surface-card p-5 rounded-xl border border-noorix-border"
            style={{ maxWidth: 420 }}
          >
            <div className="text-[20px] mb-3">⚠️</div>
            <h2 className="m-0 text-[16px] text-noorix-text" style={{ marginBottom: 8 }}>
              حدث خطأ غير متوقع
            </h2>
            <p className="m-0 text-noorix-muted text-[14px]" style={{ marginBottom: 20 }}>
              نعتذر عن الإزعاج. يمكنك تحديث الصفحة والمحاولة مرة أخرى.
            </p>
            {this.state.error?.message && (
              <pre className="text-[12px] nx-ltr overflow-auto rounded-lg mb-3" style={{ padding: 12, background: 'rgba(0,0,0,0.05)', marginBottom: 16, maxHeight: 120 }}>
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
