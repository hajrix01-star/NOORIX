/**
 * ChangePasswordModal — نافذة تغيير كلمة المرور
 */
import React, { useState } from 'react';
import { useTranslation } from '../i18n/useTranslation';
import { changePassword } from '../services/api';

export default function ChangePasswordModal({ onClose, onSuccess }) {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!currentPassword.trim()) {
      setError(t('changePasswordCurrentRequired') || 'كلمة المرور الحالية مطلوبة');
      return;
    }
    if (!newPassword.trim()) {
      setError(t('changePasswordNewRequired') || 'كلمة المرور الجديدة مطلوبة');
      return;
    }
    if (newPassword.length < 6) {
      setError(t('changePasswordMinLength') || 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('changePasswordMismatch') || 'كلمة المرور الجديدة غير متطابقة');
      return;
    }
    setLoading(true);
    try {
      const res = await changePassword(currentPassword, newPassword);
      if (res?.success) {
        onSuccess?.(t('changePasswordSuccess') || 'تم تغيير كلمة المرور بنجاح');
        onClose?.();
      } else {
        setError(res?.error || t('changePasswordFailed') || 'فشل تغيير كلمة المرور');
      }
    } catch (err) {
      setError(err?.message || t('changePasswordFailed') || 'فشل تغيير كلمة المرور');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid var(--noorix-border)',
    background: 'var(--noorix-bg-surface)',
    fontSize: 14,
    fontFamily: 'inherit',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        style={{
          background: 'var(--noorix-bg-surface)',
          borderRadius: 14,
          maxWidth: 400,
          width: '100%',
          padding: 24,
          boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>{t('changePassword')}</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('changePasswordCurrent') || 'كلمة المرور الحالية'}</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
              autoComplete="current-password"
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('changePasswordNew') || 'كلمة المرور الجديدة'}</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
              autoComplete="new-password"
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('changePasswordConfirm') || 'تأكيد كلمة المرور'}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
              autoComplete="new-password"
            />
          </div>
          {error && (
            <div style={{ marginBottom: 16, padding: 10, borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#dc2626', fontSize: 13 }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="noorix-btn-nav" onClick={onClose}>
              {t('cancel')}
            </button>
            <button type="submit" className="noorix-btn-nav noorix-btn-primary" disabled={loading}>
              {loading ? t('loading') : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
