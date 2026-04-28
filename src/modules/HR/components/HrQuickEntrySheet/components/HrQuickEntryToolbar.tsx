import React from 'react';
import { Button } from '../../../../../ui';

type Props = {
  movementLabel: string;
  allowanceLabel: string;
  activeTab: string;
  onTab: (tab: string) => void;
  onClearError: () => void;
};

export function HrQuickEntryToolbar({ movementLabel, allowanceLabel, activeTab, onTab, onClearError }: Props) {
  const segmentBtn = (tab: string, label: string) => (
    <Button
      key={tab}
      onClick={() => {
        onTab(tab);
        onClearError();
      }}
      variant={activeTab === tab ? 'primary' : 'default'}
      className="flex-1 min-h-12"
    >
      {label}
    </Button>
  );

  return (
    <div className="flex gap-2 mb-4">
      {segmentBtn('movement', movementLabel)}
      {segmentBtn('allowance', allowanceLabel)}
    </div>
  );
}
