import QRCode from 'qrcode';
import { config } from '../config';

export interface FBRInvoiceItem {
  ItemCode: string;
  ItemName: string;
  PCTCode?: string;
  Quantity: number;
  TaxRate: number;
  SaleValue: number;
  Discount: number;
  TaxCharged: number;
  TotalAmount: number;
}

export interface FBRInvoicePayload {
  POSID: string;
  USIN: string;
  DateTime: string;
  BuyerNTN?: string;
  BuyerCNIC?: string;
  BuyerName?: string;
  BuyerPhoneNumber?: string;
  TotalQuantity: number;
  TotalSaleValue: number;
  TotalTaxCharged: number;
  Discount: number;
  FurtherTax: number;
  TotalBillAmount: number;
  PaymentMode: number;
  RefUSIN?: string;
  InvoiceType: number;
  InvoiceItems: FBRInvoiceItem[];
}

export interface FBRInvoiceResponse {
  InvoiceNumber: string;
  FiscalInvoiceNumber: string;
  FBRInvoiceNumber: string;
  QRCode: string;
}

export class FBRClient {
  private readonly endpoint: string;
  private readonly posId: string;
  private readonly bearerToken: string;
  private readonly timeout: number;

  constructor() {
    const env = config.fbr.environment === 'production' ? config.fbr.production : config.fbr.sandbox;
    this.endpoint = env.endpoint;
    this.posId = env.posId;
    this.bearerToken = env.bearerToken;
    this.timeout = 3000;
  }

  async submitInvoice(payload: FBRInvoicePayload): Promise<FBRInvoiceResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.endpoint}/api/Live/PostInvoiceData`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`FBR API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      return data as FBRInvoiceResponse;
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`FBR API timeout after ${this.timeout}ms`);
      }
      
      throw error;
    }
  }

  buildInvoicePayload(invoice: {
    usin: string;
    invoiceType: 'SALE' | 'DEBIT_NOTE' | 'CREDIT_NOTE';
    originalInvoiceId?: string;
    subtotal: number;
    totalDiscount: number;
    totalTax: number;
    furtherTax: number;
    total: number;
    buyerNtn?: string;
    buyerStrn?: string;
    buyerCnic?: string;
    buyerName?: string;
    buyerPhoneNumber?: string;
    createdAt: Date;
    items: Array<{
      sku: string;
      itemName: string;
      pctCode?: string;
      quantity: number;
      unitPrice: number;
      lineDiscount: number;
      allocatedCartDiscount: number;
      taxRate: number;
      taxAmount: number;
      lineTotal: number;
    }>;
    payments: Array<{
      paymentMode: string;
      amount: number;
    }>;
  }): FBRInvoicePayload {
    const invoiceTypeMap: Record<string, number> = {
      SALE: 1,
      DEBIT_NOTE: 2,
      CREDIT_NOTE: 3,
    };

    const paymentModeMap: Record<string, number> = {
      CASH: 1,
      CARD: 2,
      EASYPAYSA: 3,
      JAZZCASH: 4,
      BANK_TRANSFER: 5,
    };

    const primaryPaymentMode = invoice.payments.length > 0
      ? paymentModeMap[invoice.payments[0].paymentMode] || 1
      : 1;

    const totalQuantity = invoice.items.reduce((sum, item) => sum + item.quantity, 0);

    const invoiceItems: FBRInvoiceItem[] = invoice.items.map((item) => ({
      ItemCode: item.sku,
      ItemName: item.itemName,
      PCTCode: item.pctCode,
      Quantity: item.quantity,
      TaxRate: item.taxRate,
      SaleValue: item.unitPrice * item.quantity,
      Discount: item.lineDiscount + item.allocatedCartDiscount,
      TaxCharged: item.taxAmount,
      TotalAmount: item.lineTotal,
    }));

    return {
      POSID: this.posId,
      USIN: invoice.usin,
      DateTime: invoice.createdAt.toISOString(),
      BuyerNTN: invoice.buyerNtn,
      BuyerCNIC: invoice.buyerCnic,
      BuyerName: invoice.buyerName,
      BuyerPhoneNumber: invoice.buyerPhoneNumber,
      TotalQuantity: totalQuantity,
      TotalSaleValue: invoice.subtotal,
      TotalTaxCharged: invoice.totalTax,
      Discount: invoice.totalDiscount,
      FurtherTax: invoice.furtherTax,
      TotalBillAmount: invoice.total,
      PaymentMode: primaryPaymentMode,
      InvoiceType: invoiceTypeMap[invoice.invoiceType],
      InvoiceItems: invoiceItems,
    };
  }

  async generateQRCode(fbrInvoiceNumber: string, usin: string, totalAmount: number): Promise<string> {
    const qrData = JSON.stringify({
      FBRInvoiceNumber: fbrInvoiceNumber,
      USIN: usin,
      TotalAmount: totalAmount / 100,
    });

    try {
      const qrCodeDataUrl = await QRCode.toDataURL(qrData);
      return qrCodeDataUrl;
    } catch (error: any) {
      throw new Error(`QR Code generation failed: ${error.message}`);
    }
  }
}

export const fbrClient = new FBRClient();
