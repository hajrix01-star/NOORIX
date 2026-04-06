import React from 'react';
import { Link } from 'react-router-dom';

export default function Forbidden403() {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        textAlign: 'center',
        direction: 'rtl',
      }}
    >
      <div className="noorix-surface-card" style={{ maxWidth: 400, padding: 32, borderRadius: 12 }}>
        <div style={{ fontSize: 52, fontWeight: 800, color: 'var(--noorix-text-muted)', letterSpacing: -2, marginBottom: 12, lineHeight: 1 }}>403</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>غير مصرح لك</h2>
        <p style={{ margin: '0 0 20px', color: 'var(--noorix-text-muted)', fontSize: 14 }}>
          لا تملك صلاحية لعرض هذه الصفحة. ما لا تملك صلاحية عليه لا تراه.
        </p>
        <Link to="/" className="noorix-btn-nav" style={{ display: 'inline-block', padding: '10px 20px', textDecoration: 'none' }}>
          العودة للوحة التحكم
        </Link>
      </div>
    </div>
  );
}
