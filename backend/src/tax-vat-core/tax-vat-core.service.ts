import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { resolveVatRateDecimal, type DecimalInput } from '@noorix/finance-core';

export type TaxVatInvoiceKind = 'sale' | 'purchase' | 'expense' | 'fixed_expense';

export type TaxVatAggregateRow = {
  kind: TaxVatInvoiceKind;
  has_tax: boolean;
  net_sum: string;
  tax_sum: string;
};

export type TaxVatReportData = {
  standard_sales: { amount: number; adjustment: number; vat: number };
  special_sales: { amount: number; adjustment: number; vat: number };
  zero_rated_domestic: { amount: number; adjustment: number; vat: number };
  exports: { amount: number; adjustment: number; vat: number };
  exempt_sales: { amount: number; adjustment: number; vat: number };
  standard_purchases: { amount: number; adjustment: number; vat: number };
  imports_customs: { amount: number; adjustment: number; vat: number };
  reverse_charge: { amount: number; adjustment: number; vat: number };
  exempt_purchases: { amount: number; adjustment: number; vat: number };
};

type VatBucket = { amount: Decimal; vat: Decimal };

@Injectable()
export class TaxVatCoreService {
  computeDisclosureFromInvoiceAggregates(
    rows: TaxVatAggregateRow[],
    vatRatePercent: DecimalInput,
    salesAmountIncludesVat = false,
  ): TaxVatReportData {
    const standardRate = resolveVatRateDecimal(vatRatePercent ?? null);
    const inclusiveDivisor = new Decimal(1).plus(standardRate);

    const standardSales: VatBucket = { amount: new Decimal(0), vat: new Decimal(0) };
    const exemptSales: VatBucket = { amount: new Decimal(0), vat: new Decimal(0) };
    const standardPurchases: VatBucket = { amount: new Decimal(0), vat: new Decimal(0) };
    const exemptPurchases: VatBucket = { amount: new Decimal(0), vat: new Decimal(0) };

    for (const row of rows) {
      const net = this.dec(row.net_sum);
      const tax = this.dec(row.tax_sum);

      if (row.kind === 'sale') {
        this.applySalesRow(standardSales, exemptSales, net, tax, row.has_tax, standardRate, inclusiveDivisor, salesAmountIncludesVat);
      } else {
        this.applyPurchaseRow(standardPurchases, exemptPurchases, net, tax, row.has_tax);
      }
    }

    return {
      standard_sales: this.row(standardSales.amount, standardSales.vat),
      special_sales: this.row(0, 0),
      zero_rated_domestic: this.row(0, 0),
      exports: this.row(0, 0),
      exempt_sales: this.row(exemptSales.amount, 0),
      standard_purchases: this.row(standardPurchases.amount, standardPurchases.vat),
      imports_customs: this.row(0, 0),
      reverse_charge: this.row(0, 0),
      exempt_purchases: this.row(exemptPurchases.amount, 0),
    };
  }

  private applySalesRow(
    standardSales: VatBucket,
    exemptSales: VatBucket,
    net: Decimal,
    tax: Decimal,
    hasTax: boolean,
    standardRate: Decimal,
    inclusiveDivisor: Decimal,
    salesAmountIncludesVat: boolean,
  ) {
    if (hasTax) {
      standardSales.amount = standardSales.amount.plus(net);
      standardSales.vat = standardSales.vat.plus(tax);
      return;
    }

    if (net.lte(0)) return;

    if (salesAmountIncludesVat) {
      const grossInclusive = net;
      const baseExcl = grossInclusive.div(inclusiveDivisor);
      standardSales.amount = standardSales.amount.plus(baseExcl);
      standardSales.vat = standardSales.vat.plus(grossInclusive.minus(baseExcl));
      return;
    }

    standardSales.amount = standardSales.amount.plus(net);
    standardSales.vat = standardSales.vat.plus(net.mul(standardRate));
  }

  private applyPurchaseRow(
    standardPurchases: VatBucket,
    exemptPurchases: VatBucket,
    net: Decimal,
    tax: Decimal,
    hasTax: boolean,
  ) {
    if (hasTax) {
      standardPurchases.amount = standardPurchases.amount.plus(net);
      standardPurchases.vat = standardPurchases.vat.plus(tax);
      return;
    }

    if (net.gt(0)) {
      exemptPurchases.amount = exemptPurchases.amount.plus(net);
    }
  }

  private row(amount: Decimal.Value, vat: Decimal.Value) {
    return { amount: this.dec(amount).toNumber(), adjustment: 0, vat: this.dec(vat).toNumber() };
  }

  private dec(value: Decimal.Value) {
    return new Decimal(value || 0);
  }
}
