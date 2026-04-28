import React from 'react';
import { Button, Input } from '../../../../../ui';

export function ContractDocForm({
  contractEnd,
  setContractEnd,
}: {
  contractEnd: string;
  setContractEnd: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-12" style={{ padding: '8px 4px 12px', flexWrap: 'wrap' }}>
      <Input
        type="date"
        label="تاريخ انتهاء العقد (اختياري)"
        value={contractEnd}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContractEnd(e.target.value)}
      />
      {contractEnd ? (
        <Button type="button" variant="ghost" onClick={() => setContractEnd('')} style={{ fontSize: 11, color: 'var(--noorix-accent-red)' }}>
          ✕ إزالة
        </Button>
      ) : null}
    </div>
  );
}
