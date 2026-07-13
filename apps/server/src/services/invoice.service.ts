import { db } from '../db';
import { invoices, invoiceItems, payments, terminals } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { calculateInvoiceTotals, validatePayments, generateUSIN, generateInvoiceNumber } from '@zpos/shared';
import type { CartItem, Payment } from '@zpos/shared';
import { inventoryService } from './inventory.service';

export interface CreateInvoiceData {
  storeId: string;
  terminalId: string;
  userId: string;
  items: CartItem[];
  payments: Payment[];
  cartDiscount?: number;
  buyerNtn?: string;
  buyerStrn?: string;
  notes?: string;
}

export class InvoiceService {
  async generateUSINForTerminal(terminalId: string): Promise<string> {
    const [terminal] = await db
      .select()
      .from(terminals)
      .where(eq(terminals.id, terminalId))
      .limit(1);

    if (!terminal) {
      throw new Error('Terminal not found');
    }

    const newSequence = terminal.currentSequence + 1;

    await db
      .update(terminals)
      .set({ 
        currentSequence: newSequence,
        updatedAt: new Date(),
      })
      .where(eq(terminals.id, terminalId));

    const store = await db.query.stores.findFirst({
      where: (stores, { eq }) => eq(stores.id, terminal.storeId),
    });

    if (!store) {
      throw new Error('Store not found');
    }

    return generateUSIN(store.code, terminal.code, newSequence);
  }

  async generateInvoiceNumberForTerminal(terminalId: string, sequence: number): Promise<string> {
    const [terminal] = await db
      .select()
      .from(terminals)
      .where(eq(terminals.id, terminalId))
      .limit(1);

    if (!terminal) {
      throw new Error('Terminal not found');
    }

    const store = await db.query.stores.findFirst({
      where: (stores, { eq }) => eq(stores.id, terminal.storeId),
    });

    if (!store) {
      throw new Error('Store not found');
    }

    return generateInvoiceNumber(store.code, terminal.code, sequence);
  }

  async createInvoice(data: CreateInvoiceData) {
    return db.transaction(async (tx) => {
      const usin = await this.generateUSINForTerminal(data.terminalId);
      
      const [terminal] = await tx
        .select()
        .from(terminals)
        .where(eq(terminals.id, data.terminalId))
        .limit(1);

      const invoiceNumber = await this.generateInvoiceNumberForTerminal(
        data.terminalId,
        terminal.currentSequence
      );

      const cartDiscount = data.cartDiscount || 0;
      const totals = calculateInvoiceTotals(data.items, cartDiscount);

      if (!validatePayments(data.payments, totals.total)) {
        throw new Error('Payment total does not match invoice total');
      }

      const [invoice] = await tx.insert(invoices).values({
        invoiceNumber,
        usin,
        storeId: data.storeId,
        terminalId: data.terminalId,
        userId: data.userId,
        status: 'COMPLETED',
        subtotal: totals.subtotal,
        totalDiscount: totals.totalDiscount,
        taxableAmount: totals.taxableAmount,
        totalTax: totals.totalTax,
        posFee: totals.posFee,
        total: totals.total,
        buyerNtn: data.buyerNtn,
        buyerStrn: data.buyerStrn,
        notes: data.notes,
        completedAt: new Date(),
      }).returning();

      const items = await Promise.all(
        totals.items.map((item, index) =>
          tx.insert(invoiceItems).values({
            invoiceId: invoice.id,
            variantId: item.variantId,
            sku: data.items[index].sku,
            itemName: data.items[index].itemName,
            pctCode: data.items[index].pctCode,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineDiscount: item.lineDiscount,
            allocatedCartDiscount: item.allocatedCartDiscount,
            taxRate: data.items[index].taxRate,
            taxAmount: item.taxAmount,
            lineTotal: item.taxableAmount + item.taxAmount,
          }).returning()
        )
      );

      const paymentRecords = await Promise.all(
        data.payments.map((payment) =>
          tx.insert(payments).values({
            invoiceId: invoice.id,
            paymentMode: payment.mode,
            amount: payment.amount,
            reference: payment.reference,
          }).returning()
        )
      );

      for (const item of data.items) {
        await inventoryService.recordMovement({
          variantId: item.variantId,
          storeId: data.storeId,
          movementType: 'SALE',
          quantity: -item.quantity,
          referenceType: 'INVOICE',
          referenceId: invoice.id,
          userId: data.userId,
          notes: `Sale - Invoice ${invoiceNumber}`,
        });
      }

      return {
        invoice,
        items: items.map((i) => i[0]),
        payments: paymentRecords.map((p) => p[0]),
      };
    });
  }

  async getInvoiceById(id: string) {
    const invoice = await db.query.invoices.findFirst({
      where: (invoices, { eq }) => eq(invoices.id, id),
      with: {
        items: true,
        payments: true,
        store: true,
        terminal: true,
        user: true,
      },
    });

    return invoice;
  }

  async getInvoiceByNumber(invoiceNumber: string) {
    const invoice = await db.query.invoices.findFirst({
      where: (invoices, { eq }) => eq(invoices.invoiceNumber, invoiceNumber),
      with: {
        items: true,
        payments: true,
      },
    });

    return invoice;
  }

  async getInvoicesByStore(storeId: string, limit: number = 100) {
    return db.query.invoices.findMany({
      where: (invoices, { eq }) => eq(invoices.storeId, storeId),
      orderBy: [desc(invoices.createdAt)],
      limit,
      with: {
        items: true,
        payments: true,
      },
    });
  }

  async getInvoicesByTerminal(terminalId: string, limit: number = 100) {
    return db.query.invoices.findMany({
      where: (invoices, { eq }) => eq(invoices.terminalId, terminalId),
      orderBy: [desc(invoices.createdAt)],
      limit,
      with: {
        items: true,
        payments: true,
      },
    });
  }

  async voidInvoice(id: string, userId: string) {
    return db.transaction(async (tx) => {
      const invoice = await this.getInvoiceById(id);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.status === 'VOIDED') {
        throw new Error('Invoice already voided');
      }

      const [updated] = await tx
        .update(invoices)
        .set({
          status: 'VOIDED',
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, id))
        .returning();

      for (const item of invoice.items) {
        await inventoryService.recordMovement({
          variantId: item.variantId,
          storeId: invoice.storeId,
          movementType: 'RETURN',
          quantity: item.quantity,
          referenceType: 'INVOICE',
          referenceId: id,
          userId,
          notes: `Void - Invoice ${invoice.invoiceNumber}`,
        });
      }

      return updated;
    });
  }
}

export const invoiceService = new InvoiceService();
