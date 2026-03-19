/**
 * Noorix Global Error Boundary — يمنع الشاشة البيضاء ويعرض رسالة اعتذار مع زر تحديث.
 */
import React from 'react';

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

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            minHeight: '60vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            textAlign: 'center',
            fontFamily: 'var(--noorix-font-arabic), sans-serif',
            direction: 'rtl',
          }}
        >
          <div
            className="noorix-surface-card"
            style={{
              maxWidth: 420,
              padding: 32,
              borderRadius: 12,
              border: '1px solid var(--noorix-border)',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, color: 'var(--noorix-text)' }}>
              حدث خطأ غير متوقع
            </h2>
            <p style={{ margin: '0 0 20px', color: 'var(--noorix-text-muted)', fontSize: 14 }}>
              نعتذر عن الإزعاج. يمكنك تحديث الصفحة والمحاولة مرة أخرى.
            </p>
            {this.state.error?.message && (
              <pre style={{ margin: '0 0 16px', padding: 12, background: 'rgba(0,0,0,0.05)', borderRadius: 8, fontSize: 12, textAlign: 'left', direction: 'ltr', overflow: 'auto', maxHeight: 120 }}>
                {this.state.error.message}
              </pre>
            )}
            <button
              type="button"
              onClick={this.handleRetry}
              className="noorix-topbar-btn"
              style={{ padding: '10px 20px', fontWeight: 600 }}
            >
              تحديث الصفحة
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
