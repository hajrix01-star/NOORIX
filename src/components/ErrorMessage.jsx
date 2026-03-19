import React from 'react';
import { useTranslation } from '../i18n/useTranslation';

const CODE_MESSAGES = {
  TRANSACTION_PAYLOAD_REQUIRED: { ar: 'مطلوب بيانات المعاملة.', en: 'Transaction payload is required.' },
  TRANSACTION_AMOUNT_MUST_BE_POSITIVE: { ar: 'المبلغ يجب أن يكون أكبر من صفر.', en: 'Amount must be greater than zero.' },
  SUPPLIER_REQUIRED: { ar: 'المورد مطلوب لهذه العملية.', en: 'Supplier is required.' },
  PAYMENT_METHOD_REQUIRED: { ar: 'طريقة الدفع مطلوبة.', en: 'Payment method is required.' },
  TRANSACTION_DATE_REQUIRED: { ar: 'تاريخ العملية مطلوب.', en: 'Transaction date is required.' },
  INVALID_TRANSACTION_DATE: { ar: 'تاريخ العملية غير صالح.', en: 'Invalid transaction date.' },
  VAULT_REQUIRED: { ar: 'الخزينة مطلوبة.', en: 'Vault is required.' },
  FETCH_FAILED: { ar: 'فشل تحميل البيانات.', en: 'Failed to load data.' },
  UNAUTHORIZED: { ar: 'غير مصرح.', en: 'Unauthorized.' },
  FORBIDDEN: { ar: 'ممنوع الوصول.', en: 'Access denied.' },
};

export function getMessageForCode(code, lang = 'ar') {
  const entry = CODE_MESSAGES[code];
  if (!entry) return code || '';
  return entry[lang] || entry.ar || code;
}

export default function ErrorMessage({ code, message, lang, onRetry }) {
  const { t, lang: ctxLang } = useTranslation();
  const effectiveLang = lang ?? ctxLang ?? 'ar';
  const displayMessage = message || getMessageForCode(code, effectiveLang);
  return (
    <div
      style={{
        padding: 16,
        textAlign: 'center',
        color: 'var(--noorix-accent-rose, #ef4444)',
        fontSize: 14,
        border: '1px solid var(--noorix-border)',
        borderRadius: 12,
        backgroundColor: 'var(--noorix-bg-muted)',
      }}
      role="alert"
    >
      <div>{displayMessage}</div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: 12,
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid var(--noorix-border)',
            background: 'var(--noorix-bg-surface)',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          {t('retry')}
        </button>
      )}
    </div>
  );
}
