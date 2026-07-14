import { db } from '../db';
import { stockTransfers, stockTransferItems, stockLedger } from '../db/schema';
import { eq, and, or } from 'drizzle-orm';
import { inventoryService } from './inventory.service';

export interface CreateTransferData {
  fromStoreId: string;
  toStoreId: string;
  requestedBy: string;
  notes?: string;
  items: Array<{
    variantId: string;
    requestedQuantity: number;
  }>;
}

export class TransferService {
  async createTransfer(data: CreateTransferData) {
    const transferNumber = `TR-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

    return db.transaction(async (tx) => {
      const [transfer] = await tx
        .insert(stockTransfers)
        .values({
          transferNumber,
          fromStoreId: data.fromStoreId,
          toStoreId: data.toStoreId,
          requestedBy: data.requestedBy,
          notes: data.notes,
          status: 'DRAFT',
        })
        .returning();

      const items = await Promise.all(
        data.items.map((item) =>
          tx.insert(stockTransferItems).values({
            transferId: transfer.id,
            variantId: item.variantId,
            requestedQuantity: item.requestedQuantity,
          }).returning()
        )
      );

      return { transfer, items: items.map((i) => i[0]) };
    });
  }

  async getTransferById(id: string) {
    const [transfer] = await db
      .select()
      .from(stockTransfers)
      .where(eq(stockTransfers.id, id))
      .limit(1);

    if (!transfer) return null;

    const items = await db
      .select()
      .from(stockTransferItems)
      .where(eq(stockTransferItems.transferId, id));

    return { transfer, items };
  }

  async getTransfersByStore(storeId: string) {
    return db
      .select()
      .from(stockTransfers)
      .where(
        or(
          eq(stockTransfers.fromStoreId, storeId),
          eq(stockTransfers.toStoreId, storeId)
        )
      )
      .orderBy(stockTransfers.createdAt);
  }

  async approveTransfer(transferId: string, approvedBy: string) {
    return db.transaction(async (tx) => {
      const transfer = await this.getTransferById(transferId);
      if (!transfer || transfer.transfer.status !== 'DRAFT') {
        throw new Error('Transfer not found or already processed');
      }

      for (const item of transfer.items) {
        const balance = await inventoryService.getStockBalance(
          item.variantId,
          transfer.transfer.fromStoreId
        );

        if (balance < item.requestedQuantity) {
          throw new Error(
            `Insufficient stock for variant ${item.variantId}. Available: ${balance}, Required: ${item.requestedQuantity}`
          );
        }

        await tx.insert(stockLedger).values({
          variantId: item.variantId,
          storeId: transfer.transfer.fromStoreId,
          movementType: 'TRANSFER_OUT',
          quantity: -item.requestedQuantity,
          referenceType: 'STOCK_TRANSFER',
          referenceId: transferId,
          userId: approvedBy,
          notes: `Transfer to store ${transfer.transfer.toStoreId}`,
        });

        await tx
          .update(stockTransferItems)
          .set({ transferredQuantity: item.requestedQuantity })
          .where(eq(stockTransferItems.id, item.id));
      }

      const [updated] = await tx
        .update(stockTransfers)
        .set({
          status: 'IN_TRANSIT',
          approvedBy,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(stockTransfers.id, transferId))
        .returning();

      return updated;
    });
  }

  async receiveTransfer(transferId: string, receivedBy: string) {
    return db.transaction(async (tx) => {
      const transfer = await this.getTransferById(transferId);
      if (!transfer || transfer.transfer.status !== 'IN_TRANSIT') {
        throw new Error('Transfer not found or not in transit');
      }

      for (const item of transfer.items) {
        await tx.insert(stockLedger).values({
          variantId: item.variantId,
          storeId: transfer.transfer.toStoreId,
          movementType: 'TRANSFER_IN',
          quantity: item.transferredQuantity || item.requestedQuantity,
          referenceType: 'STOCK_TRANSFER',
          referenceId: transferId,
          userId: receivedBy,
          notes: `Transfer from store ${transfer.transfer.fromStoreId}`,
        });

        await tx
          .update(stockTransferItems)
          .set({ receivedQuantity: item.transferredQuantity || item.requestedQuantity })
          .where(eq(stockTransferItems.id, item.id));
      }

      const [updated] = await tx
        .update(stockTransfers)
        .set({
          status: 'RECEIVED',
          receivedBy,
          receivedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(stockTransfers.id, transferId))
        .returning();

      return updated;
    });
  }

  async cancelTransfer(transferId: string) {
    const [updated] = await db
      .update(stockTransfers)
      .set({
        status: 'CANCELLED',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(stockTransfers.id, transferId),
          or(
            eq(stockTransfers.status, 'DRAFT'),
            eq(stockTransfers.status, 'PENDING')
          )
        )
      )
      .returning();

    return updated;
  }
}

export const transferService = new TransferService();
