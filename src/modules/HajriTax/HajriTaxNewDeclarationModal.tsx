/**
 * نافذة إقرار جديد — اختيار شركة + سنة + ربع (أسلوب شرائح)
 */
import React, { useMemo, useState } from 'react';
import { Modal, Button } from '../../ui';
import type {
  HajriTaxCompanyRef,
  HajriTaxNewDeclarationRequest,
  HajriTaxQuarter,
  HajriTaxTranslate,
  HajriTaxLanguage,
} from '../../types/api/domains/hajriTax';

type HajriTaxNewDeclarationModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (request: HajriTaxNewDeclarationRequest) => void;
  companies: HajriTaxCompanyRef[];
  lang: HajriTaxLanguage;
  t: HajriTaxTranslate;
};

export default function HajriTaxNewDeclarationModal({
  open,
  onClose,
  onConfirm,
  companies,
  lang,
  t,
}: HajriTaxNewDeclarationModalProps) {
  const currentYear = new Date().getFullYear();
  const years = useMemo(() => [currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4], [currentYear]);

  const [companyId, setCompanyId] = useState('');
  const [year, setYear] = useState(currentYear);
  const [quarter, setQuarter] = useState<HajriTaxQuarter>(1);

  const handleSubmit = () => {
    if (!companyId) return;
    onConfirm({ companyId, year, quarter });
    onClose();
    setCompanyId('');
    setYear(currentYear);
    setQuarter(1);
  };

  const chipActive = 'rounded-lg border-2 border-noorix-blue bg-[var(--noorix-blue-7)] px-3 py-2 text-[13px] font-bold text-noorix-blue';
  const chipIdle = 'rounded-lg border border-noorix-border bg-noorix-surface px-3 py-2 text-[13px] font-medium hover:border-noorix-blue/40';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('hajriTaxNewDeclarationTitle')}
      size="lg"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={!companyId} onClick={handleSubmit}>
            {t('hajriTaxNewDeclarationStart')}
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 text-start">
        <p className="m-0 text-[13px] text-noorix-muted">{t('hajriTaxNewDeclarationDesc')}</p>

        <div>
          <p className="mb-2 text-[13px] font-semibold text-noorix-text">{t('vatFilterCompany')}</p>
          <div className="flex flex-wrap gap-2">
            {companies.map((c) => {
              const nm = lang === 'en' ? (c.nameEn || c.nameAr || c.name) : (c.nameAr || c.name || c.nameEn);
              const active = companyId === c.id;
              return (
                <Button
                  variant="raw"
                  key={c.id}
                  type="button"
                  onClick={() => setCompanyId(c.id)}
                  className={active ? chipActive : chipIdle}
                >
                  {nm}
                </Button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[13px] font-semibold text-noorix-text">{t('reportYear')}</p>
          <div className="flex flex-wrap gap-2">
            {years.map((y) => (
              <Button variant="raw" key={y} type="button" onClick={() => setYear(y)} className={year === y ? chipActive : chipIdle}>
                {y}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[13px] font-semibold text-noorix-text">{t('vatQuarter')}</p>
          <div className="flex flex-wrap gap-2">
            {([1, 2, 3, 4] as const).map((q) => (
              <Button
                variant="raw"
                key={q}
                type="button"
                onClick={() => setQuarter(q)}
                className={quarter === q ? chipActive : chipIdle}
              >
                Q{q}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
