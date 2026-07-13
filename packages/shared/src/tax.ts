import { CartItem, Payment } from './schemas';

export interface TaxCalculationResult {
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  totalTax: number;
  posFee: number;
  total: number;
  items: Array<{
    variantId: string;
    quantity: number;
    unitPrice: number;
    lineDiscount: number;
    allocatedCartDiscount: number;
    taxableAmount: number;
    taxAmount: number;
  }>;
}

export function calculateInvoiceTotals(
  items: CartItem[],
  cartDiscount: number,
  posFeeAmount: number = 100
): TaxCalculationResult {
  let subtotal = 0;
  let totalLineDiscount = 0;

  const itemResults = items.map((item) => {
    const lineTotal = item.unitPrice * item.quantity;
    const lineDiscount = item.discount;
    subtotal += lineTotal;
    totalLineDiscount += lineDiscount;

    return {
      variantId: item.variantId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineDiscount,
      lineTotal,
      taxRate: item.taxRate,
    };
  });

  const subtotalAfterLineDiscounts = subtotal - totalLineDiscount;
  const totalDiscount = totalLineDiscount + cartDiscount;

  const itemsWithAllocatedDiscount = itemResults.map((item) => {
    const lineAfterDiscount = item.lineTotal - item.lineDiscount;
    const allocatedCartDiscount =
      subtotalAfterLineDiscounts > 0
        ? Math.floor((lineAfterDiscount / subtotalAfterLineDiscounts) * cartDiscount)
        : 0;

    const taxableAmount = lineAfterDiscount - allocatedCartDiscount;
    const taxAmount = Math.floor((taxableAmount * item.taxRate) / 100);

    return {
      variantId: item.variantId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineDiscount: item.lineDiscount,
      allocatedCartDiscount,
      taxableAmount,
      taxAmount,
    };
  });

  const totalTax = itemsWithAllocatedDiscount.reduce((sum, item) => sum + item.taxAmount, 0);
  const taxableAmount = subtotal - totalDiscount;
  const total = taxableAmount + totalTax + posFeeAmount;

  return {
    subtotal,
    totalDiscount,
    taxableAmount,
    totalTax,
    posFee: posFeeAmount,
    total,
    items: itemsWithAllocatedDiscount,
  };
}

export function validatePayments(payments: Payment[], totalAmount: number): boolean {
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  return totalPaid === totalAmount;
}

export function generateUSIN(storeCode: string, terminalCode: string, sequence: number): string {
  return `${storeCode}-${terminalCode}-${sequence.toString().padStart(8, '0')}`;
}
