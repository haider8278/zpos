import { db } from '../db';
import { invoices, invoiceItems, payments, terminals, fbrSubmissions } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { calculateInvoiceTotals, validatePayments, generateUSIN, generateInvoiceNumber } from '@zpos/shared';
import type { CartItem, Payment } from '@zpos/shared';
import { inventoryService } from './inventory.service';
import { fbrClient } from './fbr.service';

export interface CreateInvoiceData {
  storeId: string;
  terminalId: string;
  userId: string;
  items: CartItem[];
  payments: Payment[];
  cartDiscount?: number;
  buyerNtn?: string;
  buyerStrn?: string;
  buyerCnic?: string;
  buyerName?: string;
  buyerPhoneNumber?: string;
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
      const hasValidBuyerRegistration = !!(data.buyerNtn || data.buyerStrn);
      const totals = calculateInvoiceTotals(
        data.items,
        cartDiscount,
        100,
        hasValidBuyerRegistration
      );

      if (!validatePayments(data.payments, totals.total)) {
        throw new Error('Payment total does not match invoice total');
      }

      const [invoice] = await tx.insert(invoices).values({
        invoiceNumber,
        usin,
        storeId: data.storeId,
        terminalId: data.terminalId,
        userId: data.userId,
        invoiceType: 'SALE',
        status: 'COMPLETED',
        subtotal: totals.subtotal,
        totalDiscount: totals.totalDiscount,
        taxableAmount: totals.taxableAmount,
        totalTax: totals.totalTax,
        furtherTax: totals.furtherTax,
        posFee: totals.posFee,
        total: totals.total,
        buyerNtn: data.buyerNtn,
        buyerStrn: data.buyerStrn,
        buyerCnic: data.buyerCnic,
        buyerName: data.buyerName,
        buyerPhoneNumber: data.buyerPhoneNumber,
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

      // Submit to FBR
      try {
        const invoiceForFbr = {
          ...invoice,
          originalInvoiceId: invoice.originalInvoiceId || undefined,
          items: items.map((i) => ({
            ...i[0],
            pctCode: i[0].pctCode || undefined,
          })),
          payments: paymentRecords.map((p) => p[0]),
        };
        
        const fbrPayload = fbrClient.buildInvoicePayload(invoiceForFbr as any);

        const [submission] = await tx.insert(fbrSubmissions).values({
          invoiceId: invoice.id,
          invoiceType: 'SALE',
          status: 'PENDING',
          requestPayload: fbrPayload as any,
        }).returning();

        try {
          const fbrResponse = await fbrClient.submitInvoice(fbrPayload);
          const qrCode = await fbrClient.generateQRCode(
            fbrResponse.FBRInvoiceNumber,
            usin,
            totals.total
          );

          await tx.update(invoices).set({
            status: 'SYNCED',
            fbrInvoiceNumber: fbrResponse.FBRInvoiceNumber,
            fbrQrCode: qrCode,
            fbrResponse: fbrResponse as any,
            syncedAt: new Date(),
          }).where(eq(invoices.id, invoice.id));

          await tx.update(fbrSubmissions).set({
            status: 'SUCCESS',
            responsePayload: fbrResponse as any,
            fbrInvoiceNumber: fbrResponse.FBRInvoiceNumber,
            syncedAt: new Date(),
          }).where(eq(fbrSubmissions.id, submission.id));

        } catch (fbrError: any) {
          await tx.update(invoices).set({
            status: 'PENDING_SYNC',
          }).where(eq(invoices.id, invoice.id));

          await tx.update(fbrSubmissions).set({
            status: 'FAILED',
            errorMessage: fbrError.message,
          }).where(eq(fbrSubmissions.id, submission.id));
        }
      } catch (error: any) {
        console.error('Failed to create FBR submission record:', error);
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

      // Create credit note invoice (InvoiceType 3)
      const creditNoteUsin = await this.generateUSINForTerminal(invoice.terminalId);
      const [terminal] = await tx
        .select()
        .from(terminals)
        .where(eq(terminals.id, invoice.terminalId))
        .limit(1);

      const creditNoteNumber = await this.generateInvoiceNumberForTerminal(
        invoice.terminalId,
        terminal.currentSequence
      );

      const [creditNote] = await tx.insert(invoices).values({
        invoiceNumber: creditNoteNumber,
        usin: creditNoteUsin,
        storeId: invoice.storeId,
        terminalId: invoice.terminalId,
        userId,
        invoiceType: 'CREDIT_NOTE',
        originalInvoiceId: invoice.id,
        status: 'COMPLETED',
        subtotal: -invoice.subtotal,
        totalDiscount: -invoice.totalDiscount,
        taxableAmount: -invoice.taxableAmount,
        totalTax: -invoice.totalTax,
        furtherTax: -invoice.furtherTax,
        posFee: -invoice.posFee,
        total: -invoice.total,
        buyerNtn: invoice.buyerNtn,
        buyerStrn: invoice.buyerStrn,
        buyerCnic: invoice.buyerCnic,
        buyerName: invoice.buyerName,
        buyerPhoneNumber: invoice.buyerPhoneNumber,
        notes: `Credit note for voided invoice ${invoice.invoiceNumber}`,
        completedAt: new Date(),
      }).returning();

      // Update original invoice status
      const [updated] = await tx
        .update(invoices)
        .set({
          status: 'VOIDED',
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, id))
        .returning();

      // Restore inventory
      for (const item of invoice.items) {
        await inventoryService.recordMovement({
          variantId: item.variantId,
          storeId: invoice.storeId,
          movementType: 'RETURN',
          quantity: item.quantity,
          referenceType: 'INVOICE',
          referenceId: creditNote.id,
          userId,
          notes: `Void - Invoice ${invoice.invoiceNumber}`,
        });
      }

      // Submit credit note to FBR
      try {
        const invoiceForFbr = {
          ...creditNote,
          originalInvoiceId: creditNote.originalInvoiceId || undefined,
          items: invoice.items.map((item) => ({
            ...item,
            pctCode: item.pctCode || undefined,
            quantity: -item.quantity,
            lineTotal: -item.lineTotal,
            taxAmount: -item.taxAmount,
          })),
          payments: invoice.payments,
        };
        
        const fbrPayload = fbrClient.buildInvoicePayload(invoiceForFbr as any);

        const [submission] = await tx.insert(fbrSubmissions).values({
          invoiceId: creditNote.id,
          invoiceType: 'CREDIT_NOTE',
          status: 'PENDING',
          requestPayload: fbrPayload as any,
        }).returning();

        try {
          const fbrResponse = await fbrClient.submitInvoice(fbrPayload);
          const qrCode = await fbrClient.generateQRCode(
            fbrResponse.FBRInvoiceNumber,
            creditNoteUsin,
            creditNote.total
          );

          await tx.update(invoices).set({
            status: 'SYNCED',
            fbrInvoiceNumber: fbrResponse.FBRInvoiceNumber,
            fbrQrCode: qrCode,
            fbrResponse: fbrResponse as any,
            syncedAt: new Date(),
          }).where(eq(invoices.id, creditNote.id));

          await tx.update(fbrSubmissions).set({
            status: 'SUCCESS',
            responsePayload: fbrResponse as any,
            fbrInvoiceNumber: fbrResponse.FBRInvoiceNumber,
            syncedAt: new Date(),
          }).where(eq(fbrSubmissions.id, submission.id));

        } catch (fbrError: any) {
          await tx.update(fbrSubmissions).set({
            status: 'FAILED',
            errorMessage: fbrError.message,
          }).where(eq(fbrSubmissions.id, submission.id));
        }
      } catch (error: any) {
        console.error('Failed to create FBR submission for credit note:', error);
      }

      return { original: updated, creditNote };
    });
  }

  async retryFailedSubmissions() {
    const failedSubmissions = await db.query.fbrSubmissions.findMany({
      where: (submissions, { eq, and, or, lt }) =>
        and(
          or(
            eq(submissions.status, 'FAILED'),
            eq(submissions.status, 'RETRYING')
          ),
          lt(submissions.retryCount, 5)
        ),
      limit: 50,
      with: {
        invoice: {
          with: {
            items: true,
            payments: true,
          },
        },
      },
    });

    for (const submission of failedSubmissions) {
      try {
        await db.update(fbrSubmissions).set({
          status: 'RETRYING',
          retryCount: submission.retryCount + 1,
          lastRetryAt: new Date(),
        }).where(eq(fbrSubmissions.id, submission.id));

        const fbrResponse = await fbrClient.submitInvoice(submission.requestPayload as any);
        const qrCode = await fbrClient.generateQRCode(
          fbrResponse.FBRInvoiceNumber,
          submission.invoice.usin,
          submission.invoice.total
        );

        await db.update(invoices).set({
          status: 'SYNCED',
          fbrInvoiceNumber: fbrResponse.FBRInvoiceNumber,
          fbrQrCode: qrCode,
          fbrResponse: fbrResponse as any,
          syncedAt: new Date(),
        }).where(eq(invoices.id, submission.invoiceId));

        await db.update(fbrSubmissions).set({
          status: 'SUCCESS',
          responsePayload: fbrResponse as any,
          fbrInvoiceNumber: fbrResponse.FBRInvoiceNumber,
          syncedAt: new Date(),
        }).where(eq(fbrSubmissions.id, submission.id));

      } catch (error: any) {
        await db.update(fbrSubmissions).set({
          status: 'FAILED',
          errorMessage: error.message,
        }).where(eq(fbrSubmissions.id, submission.id));
      }
    }

    return failedSubmissions.length;
  }
}

export const invoiceService = new InvoiceService();
