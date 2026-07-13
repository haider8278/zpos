import { describe, it, expect } from 'vitest';
import { calculateInvoiceTotals, validatePayments, generateUSIN } from '../src/tax';
import type { CartItem, Payment } from '../src/schemas';

describe('Tax Calculation', () => {
  it('should calculate invoice totals correctly', () => {
    const items: CartItem[] = [
      {
        variantId: '123',
        sku: 'ITEM-001',
        itemName: 'Test Item 1',
        quantity: 2,
        unitPrice: 10000,
        discount: 0,
        taxCategory: 'STANDARD',
        taxRate: 18,
      },
      {
        variantId: '456',
        sku: 'ITEM-002',
        itemName: 'Test Item 2',
        quantity: 1,
        unitPrice: 5000,
        discount: 500,
        taxCategory: 'STANDARD',
        taxRate: 18,
      },
    ];

    const result = calculateInvoiceTotals(items, 1000, 100);

    expect(result.subtotal).toBe(25000);
    expect(result.totalDiscount).toBe(1500);
    expect(result.taxableAmount).toBe(23500);
    expect(result.posFee).toBe(100);
  });

  it('should validate payments correctly', () => {
    const payments: Payment[] = [
      { mode: 'CASH', amount: 10000 },
      { mode: 'CARD', amount: 5000 },
    ];

    expect(validatePayments(payments, 15000)).toBe(true);
    expect(validatePayments(payments, 14000)).toBe(false);
    expect(validatePayments(payments, 16000)).toBe(false);
  });

  it('should generate USIN correctly', () => {
    const usin = generateUSIN('STORE01', 'T001', 42);
    expect(usin).toBe('STORE01-T001-00000042');
  });
});
