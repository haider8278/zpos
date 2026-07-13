import { z } from 'zod';
import { PaymentMode, TaxCategory } from './types';

export const LoginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(8),
  terminalId: z.string().optional(),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string(),
});

export const CreateUserSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string(),
  roleId: z.string().uuid(),
  storeId: z.string().uuid().optional(),
});

export const ProductVariantSchema = z.object({
  sku: z.string(),
  itemName: z.string(),
  barcode: z.string().optional(),
  pctCode: z.string().optional(),
  taxCategory: TaxCategory,
  price: z.number().int().positive(),
  quantity: z.number(),
});

export const CartItemSchema = z.object({
  variantId: z.string().uuid(),
  sku: z.string(),
  itemName: z.string(),
  pctCode: z.string().optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().int().positive(),
  discount: z.number().int().nonnegative().default(0),
  taxCategory: TaxCategory,
  taxRate: z.number().nonnegative(),
});

export const PaymentSchema = z.object({
  mode: PaymentMode,
  amount: z.number().int().positive(),
  reference: z.string().optional(),
});

export const CreateInvoiceSchema = z.object({
  storeId: z.string().uuid(),
  terminalId: z.string().uuid(),
  items: z.array(CartItemSchema).min(1),
  payments: z.array(PaymentSchema).min(1),
  cartDiscount: z.number().int().nonnegative().default(0),
  buyerNtn: z.string().optional(),
  buyerStrn: z.string().optional(),
});

export const FBRInvoiceItemSchema = z.object({
  ItemCode: z.string(),
  ItemName: z.string(),
  PCTCode: z.string().optional(),
  Quantity: z.number(),
  TaxRate: z.number(),
  TaxCharged: z.number().int(),
  SaleValue: z.number().int(),
});

export const FBRInvoicePayloadSchema = z.object({
  POSID: z.string(),
  USIN: z.string(),
  DateTime: z.string(),
  TotalSaleValue: z.number().int(),
  TotalTaxCharged: z.number().int(),
  Discount: z.number().int(),
  TotalBillAmount: z.number().int(),
  PaymentMode: z.number(),
  InvoiceType: z.number(),
  InvoiceItems: z.array(FBRInvoiceItemSchema),
});

export type LoginRequest = z.infer<typeof LoginSchema>;
export type RefreshTokenRequest = z.infer<typeof RefreshTokenSchema>;
export type CreateUserRequest = z.infer<typeof CreateUserSchema>;
export type CartItem = z.infer<typeof CartItemSchema>;
export type Payment = z.infer<typeof PaymentSchema>;
export type CreateInvoiceRequest = z.infer<typeof CreateInvoiceSchema>;
export type FBRInvoicePayload = z.infer<typeof FBRInvoicePayloadSchema>;
