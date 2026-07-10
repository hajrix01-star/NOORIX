import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateOnFinancialMutation } from '../../../../utils/queryInvalidation';
import { BatchPrintSheet } from '../../components/BatchPrintSheet';
import { BatchEditPanel } from '../../components/BatchEditPanel';
import { DialogActions, Modal } from '../../../../ui';
import type { PurchaseBatchInvoice, PurchaseBatchSupplier, PurchaseBatchSummaryRow } from '../purchaseBatchTypes';
import { useTranslation } from '../../../../i18n/useTranslation';

export interface PurchasesBatchModalsProps {
  printingBatch: PurchaseBatchSummaryRow | null;
  editingBatch: PurchaseBatchSummaryRow | null;
  cancellingBatch: PurchaseBatchSummaryRow | null;
  suppliers: PurchaseBatchSupplier[];
  companyId: string;
  vatRateDecimal?: number;
  onClosePrint: () => void;
  onCloseEdit: () => void;
  onCloseCancel: () => void;
  onEditPrintedBatch: (batch: PurchaseBatchSummaryRow) => void;
  onCancelPrintedBatch: (batch: PurchaseBatchSummaryRow) => void;
  onSaveInvoice: (invoice: PurchaseBatchInvoice) => Promise<unknown>;
  onConfirmCancel: () => Promise<void>;
}

export default function PurchasesBatchModals(props: PurchasesBatchModalsProps) {
  const {
    printingBatch,
    editingBatch,
    cancellingBatch,
    suppliers,
    companyId,
    vatRateDecimal,
    onClosePrint,
    onCloseEdit,
    onCloseCancel,
    onEditPrintedBatch,
    onCancelPrintedBatch,
    onSaveInvoice,
    onConfirmCancel,
  } = props;
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return (
    <>
      {printingBatch && (
        <BatchPrintSheet
          batch={printingBatch}
          onClose={onClosePrint}
          onEdit={() => onEditPrintedBatch(printingBatch)}
          onCancel={() => onCancelPrintedBatch(printingBatch)}
          canCancel={printingBatch.status === 'active' || printingBatch.status === 'partial'}
        />
      )}
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
      {cancellingBatch ? (
        <Modal
          open
          onClose={onCloseCancel}
          title={t('cancel')}
          size="sm"
          footer={(
            <DialogActions
              actions={[
                {
                  key: 'confirm-cancel',
                  label: t('cancel'),
                  role: 'delete',
                  onClick: () => {
                    void onConfirmCancel();
                  },
                },
              ]}
            />
          )}
        >
          <p className="text-[14px] text-noorix-muted m-0">
            {t('cancelBatchConfirm', cancellingBatch.batchId, cancellingBatch.invoiceCount)}
          </p>
        </Modal>
      ) : null}
    </>
  );
}
