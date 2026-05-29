import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useApp } from '../../context/AppContext';
import { ScreenShell } from '../../ui';
import OcrBatchUploadPanel from './components/OcrBatchUploadPanel';

/**
 * شاشة الكاشير — رفع صور فواتير (دفعة) للاستخراج والحفظ التلقائي في الخلفية.
 */
export default function OcrCashierSubmitScreen() {
  const { t, lang } = useTranslation();
  const { activeCompanyId } = useApp();
  const isAr = lang === 'ar';

  return (
    <ScreenShell>
      {!activeCompanyId && (
        <div className="mb-3 rounded-lg border border-noorix-border bg-noorix-bg-muted px-3 py-2 text-[13px] text-noorix-muted">
          {isAr ? 'اختر شركة من القائمة لإرسال فاتورة لهذا الفرع.' : 'Select a company from the menu to submit an invoice for that branch.'}
        </div>
      )}

      <div className="flex flex-col gap-4" dir={isAr ? 'rtl' : 'ltr'}>
        <div>
          <h1 className="text-lg font-bold text-noorix-text m-0">
            {t('ocrCashierPageTitle')}
          </h1>
          <p className="text-[13px] text-noorix-muted m-0 mt-1">
            {t('ocrCashierPageHint')}
          </p>
        </div>

        <OcrBatchUploadPanel disabled={!activeCompanyId} companyId={activeCompanyId} />
      </div>
    </ScreenShell>
  );
}
