import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui';

export default function NotFound404() {
  const navigate = useNavigate();
  return (
    <div
      className="nx-flex-col-center nx-text-center nx-p-24"
      style={{ minHeight: '60vh', direction: 'rtl' }}
    >
      <div className="noorix-surface-card nx-p-20 nx-rounded-lg" style={{ maxWidth: 400 }}>
        <div className="nx-font-800 nx-text-muted" style={{ fontSize: 52, letterSpacing: -2, marginBottom: 12, lineHeight: 1 }}>404</div>
        <h2 className="nx-m-0 nx-text-xl" style={{ marginBottom: 8 }}>الصفحة غير موجودة</h2>
        <p className="nx-m-0 nx-text-muted nx-text-md" style={{ marginBottom: 20 }}>
          الرابط الذي تبحث عنه غير موجود أو تم نقله.
        </p>
        <Button variant="primary" onClick={() => navigate('/')}>
          العودة للوحة التحكم
        </Button>
      </div>
    </div>
  );
}
