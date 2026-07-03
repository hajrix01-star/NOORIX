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
    <div className="flex items-center gap-12 flex-wrap pt-2 px-1 pb-3">
      <Input
        type="date"
        label="تاريخ انتهاء العقد (اختياري)"
        value={contractEnd}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContractEnd(e.target.value)}
      />
      {contractEnd ? (
        <Button type="button" variant="ghost" onClick={() => setContractEnd('')} className="text-[11px] text-noorix-red">
          ✕ إزالة
        </Button>
      ) : null}
    </div>
  );
}
