import React from 'react';
import { Button, DateField } from '../../../../../ui';

export function ContractDocForm({
  contractEnd,
  setContractEnd,
}: {
  contractEnd: string;
  setContractEnd: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-12 flex-wrap pt-2 px-1 pb-3">
      <DateField
        label="تاريخ انتهاء العقد (اختياري)"
        value={contractEnd}
        onValueChange={setContractEnd}
      />
      {contractEnd ? (
        <Button type="button" variant="ghost" onClick={() => setContractEnd('')} className="text-[11px] text-noorix-red">
          ✕ إزالة
        </Button>
      ) : null}
    </div>
  );
}
