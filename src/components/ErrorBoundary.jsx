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
          className="nx-flex-col-center nx-text-center nx-p-24"
          style={{ minHeight: '60vh', fontFamily: 'var(--noorix-font-arabic), sans-serif', direction: 'rtl' }}
        >
          <div
            className="noorix-surface-card nx-p-20 nx-rounded-lg nx-border-all"
            style={{ maxWidth: 420 }}
          >
            <div className="nx-text-3xl nx-mb-12">⚠️</div>
            <h2 className="nx-m-0 nx-text-xl nx-text-primary" style={{ marginBottom: 8 }}>
              حدث خطأ غير متوقع
            </h2>
            <p className="nx-m-0 nx-text-muted nx-text-md" style={{ marginBottom: 20 }}>
              نعتذر عن الإزعاج. يمكنك تحديث الصفحة والمحاولة مرة أخرى.
            </p>
            {this.state.error?.message && (
              <pre className="nx-text-sm nx-ltr nx-overflow-auto nx-rounded nx-mb-12" style={{ padding: 12, background: 'rgba(0,0,0,0.05)', marginBottom: 16, maxHeight: 120 }}>
                {this.state.error.message}
              </pre>
            )}
            <div className="nx-flex nx-justify-center nx-flex-wrap nx-gap-10">
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
