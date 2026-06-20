import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateOnFinancialMutation } from '../../../../utils/queryInvalidation';
import { BatchPrintSheet } from '../../components/BatchPrintSheet';
import { BatchEditPanel } from '../../components/BatchEditPanel';

export interface PurchasesBatchModalsProps {
  printingBatch: any;
  editingBatch: any;
  suppliers: any[];
  companyId: string;
  vatRateDecimal?: number;
  onClosePrint: () => void;
  onCloseEdit: () => void;
  onSaveInvoice: (inv: any) => Promise<unknown>;
}

export default function PurchasesBatchModals(props: PurchasesBatchModalsProps) {
  const { printingBatch, editingBatch, suppliers, companyId, vatRateDecimal, onClosePrint, onCloseEdit, onSaveInvoice } = props;
  const queryClient = useQueryClient();

  return (
    <>
      {printingBatch && <BatchPrintSheet batch={printingBatch} onClose={onClosePrint} />}
      {editingBatch && (
        <BatchEditPanel
          batch={editingBatch}
          suppliers={suppliers}
          companyId={companyId}
          vatRateDecimal={vatRateDecimal}
          onSaveInvoice={onSaveInvoice}
          onClose={() => {
            onCloseEdit();
            invalidateOnFinancialMutation(queryClient);
          }}
        />
      )}
    </>
  );
}
