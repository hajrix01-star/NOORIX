import React from 'react';
import { Button, EditableCheckboxCell } from '../../../ui';
import { getTransactionTypeInfo, getTransactionSideInfo } from './bankRuleConstants';
import { normParentKeywords, normClassifications } from './utils/bankCategoryTreeNormalize';
import type { BankTransactionSide } from './bankAnalysisTab.types';
import type { BankTreeCategory } from './bankCategoryTree.types';

export type BankCategoryCardRowProps = {
  category: BankTreeCategory;
  index?: number;
  t: (k: string, ...args: string[]) => string;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
};

function toTransactionSide(value: unknown): BankTransactionSide | undefined {
  return value === 'any' || value === 'debit' || value === 'credit' ? value : undefined;
}

export function BankCategoryCardRow({
  category,
  index,
  t,
  onEdit,
  onDelete,
  onToggle,
}: BankCategoryCardRowProps) {
  const typeInfo = getTransactionTypeInfo(
    category.transactionType ?? undefined,
    t,
  );
  const transactionSide = toTransactionSide(category.transactionSide);
  const sideInfo = getTransactionSideInfo(transactionSide, t);
  const classifications = normClassifications(category.classifications);
  const parentKeywords = normParentKeywords(category.parentKeywords);
  const totalKw = classifications.reduce((s, c) => s + (c.keywords?.length || 0), 0);
  const active = category.isActive !== false;

  return (
    <div className={`noorix-surface-card p-3.5${active ? '' : ' opacity-[0.55]'}`}>
      <div className="flex gap-3 flex-wrap justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex flex-wrap gap-2 mb-2">
            {index != null ? (
              <span
                className="text-[11px] font-extrabold w-[26px] h-[26px] rounded-full inline-flex items-center justify-center text-white bg-gradient-to-br from-[var(--noorix-navy-light)] to-[var(--noorix-navy)]"
              >
                {index}
              </span>
            ) : null}
            <span className="font-bold">{String(category.name ?? '')}</span>
            <span
              className="text-[11px] py-[2px] px-2 rounded-md"
              style={{ background: typeInfo.color, color: typeInfo.colorText }}
            >
              {typeInfo.icon} {typeInfo.label}
            </span>
            {transactionSide && transactionSide !== 'any' ? (
              <span
                className={`text-[10px] py-[2px] px-2 rounded-md border border-noorix-border ${
                  transactionSide === 'debit' ? 'bg-[var(--noorix-red-8)]' : 'bg-[var(--noorix-green-8)]'
                }`}
              >
                {sideInfo.icon} {t(sideInfo.labelKey)}
              </span>
            ) : null}
            <span className="text-[10px] px-2 py-[2px] rounded-[6px] bg-noorix-bg-muted">
              {classifications.length} {t('bankTreeStatsClassifications')} · {totalKw}{' '}
              {t('bankTreeStatsKeywords')}
            </span>
          </div>
          {parentKeywords.length > 0 ? (
            <div className="text-[11px] mb-2 text-noorix-amber">
              {t('bankTreeParentKeywordsShort')}: {parentKeywords.join(' · ')}
            </div>
          ) : null}
          {classifications.length > 0 ? (
            <div className="grid gap-1.5">
              {classifications.map((cl, idx) => (
                <div key={idx} className="text-[12px] pl-2 border-l-2 border-noorix-border">
                  <strong>{cl.name}</strong>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(cl.keywords || []).map((kw, ki) => (
                      <code key={ki} className="text-[10px] px-1.5 py-[2px] rounded bg-noorix-bg-muted">
                        {kw}
                      </code>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5 shrink-0 items-end">
          <label className="nx-checkbox">
            <EditableCheckboxCell checked={active} onChange={() => onToggle()} />
            {t('bankTreeActive')}
          </label>
          <Button size="sm" onClick={onEdit}>
            {t('edit')}
          </Button>
          <Button variant="danger" size="sm" onClick={onDelete}>
            {t('delete')}
          </Button>
        </div>
      </div>
    </div>
  );
}
