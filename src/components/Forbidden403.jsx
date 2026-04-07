import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui';

export default function Forbidden403() {
  const navigate = useNavigate();
  return (
    <div
      className="flex flex-col items-center text-center p-6 min-h-[60vh]"
      style={{ direction: 'rtl' }}
    >
      <div className="noorix-surface-card p-5 rounded-xl max-w-[400px]">
        <div className="font-extrabold text-noorix-muted text-[52px] mb-3 leading-none tracking-[-2px]">403</div>
        <h2 className="m-0 text-[16px] mb-2">غير مصرح لك</h2>
        <p className="m-0 text-noorix-muted text-[14px] mb-5">
          لا تملك صلاحية لعرض هذه الصفحة. ما لا تملك صلاحية عليه لا تراه.
        </p>
        <Button variant="primary" onClick={() => navigate('/')}>
          العودة للوحة التحكم
        </Button>
      </div>
    </div>
  );
}
