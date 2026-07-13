import { z } from 'zod';

export const UserRole = z.enum(['ADMIN', 'STORE_MANAGER', 'CASHIER']);
export type UserRole = z.infer<typeof UserRole>;

export const Permission = z.enum([
  'CASH_DRAWER_OPEN',
  'VOID_INVOICE',
  'PROCESS_RETURN',
  'MANUAL_DISCOUNT_OVERRIDE',
  'MODIFY_TAX_CONFIG',
  'MANAGE_USERS',
  'MANAGE_INVENTORY',
  'MANAGE_STORES',
  'VIEW_REPORTS',
]);
export type Permission = z.infer<typeof Permission>;

export const TaxCategory = z.enum(['STANDARD', 'REDUCED', 'ZERO_RATED', 'EXEMPT']);
export type TaxCategory = z.infer<typeof TaxCategory>;

export const PaymentMode = z.enum([
  'CASH',
  'CARD',
  'EASYPAYSA',
  'JAZZCASH',
  'BANK_TRANSFER',
]);
export type PaymentMode = z.infer<typeof PaymentMode>;

export const InvoiceType = z.enum([
  'NORMAL',
  'DEBIT_NOTE',
  'CREDIT_NOTE',
]);
export type InvoiceType = z.infer<typeof InvoiceType>;

export const InvoiceStatus = z.enum([
  'DRAFT',
  'COMPLETED',
  'PENDING_SYNC',
  'SYNCED',
  'SYNC_FAILED',
  'VOIDED',
  'RETURNED',
  'PARTIALLY_RETURNED',
]);
export type InvoiceStatus = z.infer<typeof InvoiceStatus>;

export const FBRSubmissionStatus = z.enum([
  'NOT_REQUIRED',
  'QUEUED',
  'IN_PROGRESS',
  'SUCCEEDED',
  'FAILED_RETRYABLE',
  'FAILED_PERMANENT',
]);
export type FBRSubmissionStatus = z.infer<typeof FBRSubmissionStatus>;
