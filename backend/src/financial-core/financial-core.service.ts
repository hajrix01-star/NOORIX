/**
 * واجهة المحرك المالي — تفوّض إلى outflow / inflow / transfer / cancel
 */
import { Injectable } from '@nestjs/common';
import { FinancialOutflowService } from './financial-outflow.service';
import { FinancialInflowService } from './financial-inflow.service';
import { FinancialTransferService } from './financial-transfer.service';
import { FinancialCancelService } from './financial-cancel.service';
@Injectable()
export class FinancialCoreService {
  constructor(
    private readonly outflow: FinancialOutflowService,
    private readonly inflow: FinancialInflowService,
    private readonly transfer: FinancialTransferService,
    private readonly cancel: FinancialCancelService,
  ) {}

  processOutflow(...a: Parameters<FinancialOutflowService['processOutflow']>) {
    return this.outflow.processOutflow(...a);
  }
  processOutflowBatch(...a: Parameters<FinancialOutflowService['processOutflowBatch']>) {
    return this.outflow.processOutflowBatch(...a);
  }
  rebuildOutflowInvoiceLedgerAfterVaultChange(
    ...a: Parameters<FinancialOutflowService['rebuildOutflowInvoiceLedgerAfterVaultChange']>
  ) {
    return this.outflow.rebuildOutflowInvoiceLedgerAfterVaultChange(...a);
  }
  rebuildOutflowInvoiceLedgerToMatchInvoice(
    ...a: Parameters<FinancialOutflowService['rebuildOutflowInvoiceLedgerToMatchInvoice']>
  ) {
    return this.outflow.rebuildOutflowInvoiceLedgerToMatchInvoice(...a);
  }
  processInflow(...a: Parameters<FinancialInflowService['processInflow']>) {
    return this.inflow.processInflow(...a);
  }
  updateInflow(
    id: string,
    companyId: string,
    dto: Parameters<FinancialInflowService['updateInflow']>[2],
    userId?: string,
  ) {
    return this.inflow.updateInflow(id, companyId, dto, userId);
  }
  processTransfer(...a: Parameters<FinancialTransferService['processTransfer']>) {
    return this.transfer.processTransfer(...a);
  }
  cancelOperation(...a: Parameters<FinancialCancelService['cancelOperation']>) {
    return this.cancel.cancelOperation(...a);
  }
}
