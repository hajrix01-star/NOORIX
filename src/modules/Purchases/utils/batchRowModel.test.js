import { describe, it, expect } from 'vitest';
import { patchForSupplierChange, patchForCategoryChange } from './batchRowModel';

describe('patchForSupplierChange', () => {
  it('clears supplier-related fields when empty', () => {
    expect(patchForSupplierChange('', [], [])).toEqual({
      supplierId: '',
      categoryId: '',
      debitAccountId: '',
      kind: 'purchase',
    });
  });

  it('derives purchase kind and category from supplier', () => {
    const suppliers = [
      {
        id: 's1',
        isTaxRegistered: true,
        supplierCategory: {
          id: 'c1',
          type: 'purchase',
          accountId: 'acc1',
        },
      },
    ];
    const categories = [];
    expect(patchForSupplierChange('s1', suppliers, categories)).toEqual({
      supplierId: 's1',
      kind: 'purchase',
      categoryId: 'c1',
      debitAccountId: 'acc1',
      isTaxable: true,
    });
  });

  it('uses expense kind when supplier category is expense', () => {
    const suppliers = [
      {
        id: 's2',
        isTaxRegistered: false,
        supplierCategory: {
          id: 'c2',
          type: 'expense',
          account: { id: 'acc2' },
        },
      },
    ];
    expect(patchForSupplierChange('s2', suppliers, [])).toMatchObject({
      kind: 'expense',
      categoryId: 'c2',
      debitAccountId: 'acc2',
      isTaxable: false,
    });
  });

  it('falls back to defaults when supplier id not in list', () => {
    expect(patchForSupplierChange('missing', [], [])).toEqual({
      supplierId: 'missing',
      kind: 'purchase',
      categoryId: '',
      debitAccountId: '',
      isTaxable: true,
    });
  });

  it('resolves category from supplierCategoryId when embedded category missing', () => {
    const suppliers = [
      {
        id: 's3',
        supplierCategoryId: 'cx',
        isTaxRegistered: true,
      },
    ];
    const categories = [
      { id: 'cx', type: 'purchase', accountId: 'accx' },
    ];
    expect(patchForSupplierChange('s3', suppliers, categories)).toMatchObject({
      supplierId: 's3',
      kind: 'purchase',
      categoryId: 'cx',
      debitAccountId: 'accx',
    });
  });
});

describe('patchForCategoryChange', () => {
  it('clears when cat is null', () => {
    expect(patchForCategoryChange(null, { supplierId: 'x' })).toEqual({
      categoryId: '',
      debitAccountId: '',
    });
  });

  it('sets category and does not override isTaxable when supplier is set', () => {
    const cat = { id: 'k1', accountId: 'a1', account: { taxExempt: true } };
    const row = { supplierId: 's' };
    expect(patchForCategoryChange(cat, row)).toEqual({
      categoryId: 'k1',
      debitAccountId: 'a1',
    });
  });

  it('sets isTaxable from account when no supplier', () => {
    const cat = { id: 'k2', accountId: 'a2', account: { taxExempt: true } };
    const row = { supplierId: '' };
    expect(patchForCategoryChange(cat, row)).toEqual({
      categoryId: 'k2',
      debitAccountId: 'a2',
      isTaxable: false,
    });
  });
});
