import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui';

export default function NotFound404() {
  const navigate = useNavigate();
  return (
    <div
      className="flex flex-col items-center text-center p-6"
      style={{ minHeight: '60vh', direction: 'rtl' }}
    >
      <div className="noorix-surface-card p-5 rounded-xl" style={{ maxWidth: 400 }}>
        <div className="font-extrabold text-noorix-muted" style={{ fontSize: 52, letterSpacing: -2, marginBottom: 12, lineHeight: 1 }}>404</div>
        <h2 className="m-0 text-[16px]" style={{ marginBottom: 8 }}>الصفحة غير موجودة</h2>
        <p className="m-0 text-noorix-muted text-[14px]" style={{ marginBottom: 20 }}>
          الرابط الذي تبحث عنه غير موجود أو تم نقله.
        </p>
        <Button variant="primary" onClick={() => navigate('/')}>
          العودة للوحة التحكم
        </Button>
      </div>
    </div>
  );
}
