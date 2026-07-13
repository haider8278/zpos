import { db } from '../db';
import { stockLedger, productVariants } from '../db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';

export interface StockMovementData {
  variantId: string;
  storeId: string;
  movementType: 'PURCHASE' | 'SALE' | 'RETURN' | 'ADJUSTMENT' | 'TRANSFER_OUT' | 'TRANSFER_IN';
  quantity: number;
  referenceType?: string;
  referenceId?: string;
  userId: string;
  notes?: string;
}

export interface StockBalance {
  variantId: string;
  storeId: string;
  quantity: number;
}

export class InventoryService {
  async recordMovement(data: StockMovementData) {
    const [movement] = await db.insert(stockLedger).values(data).returning();
    return movement;
  }

  async getStockBalance(variantId: string, storeId: string): Promise<number> {
    const result = await db
      .select({
        balance: sql<number>`SUM(quantity)`,
      })
      .from(stockLedger)
      .where(
        and(
          eq(stockLedger.variantId, variantId),
          eq(stockLedger.storeId, storeId)
        )
      );

    return result[0]?.balance || 0;
  }

  async getStockBalancesByStore(storeId: string): Promise<StockBalance[]> {
    const result = await db
      .select({
        variantId: stockLedger.variantId,
        storeId: stockLedger.storeId,
        quantity: sql<number>`SUM(${stockLedger.quantity})`,
      })
      .from(stockLedger)
      .where(eq(stockLedger.storeId, storeId))
      .groupBy(stockLedger.variantId, stockLedger.storeId);

    return result.map((r) => ({
      variantId: r.variantId,
      storeId: r.storeId,
      quantity: r.quantity,
    }));
  }

  async getStockBalancesByVariant(variantId: string): Promise<StockBalance[]> {
    const result = await db
      .select({
        variantId: stockLedger.variantId,
        storeId: stockLedger.storeId,
        quantity: sql<number>`SUM(${stockLedger.quantity})`,
      })
      .from(stockLedger)
      .where(eq(stockLedger.variantId, variantId))
      .groupBy(stockLedger.variantId, stockLedger.storeId);

    return result.map((r) => ({
      variantId: r.variantId,
      storeId: r.storeId,
      quantity: r.quantity,
    }));
  }

  async getMovementHistory(variantId: string, storeId: string, limit: number = 100) {
    return db
      .select()
      .from(stockLedger)
      .where(
        and(
          eq(stockLedger.variantId, variantId),
          eq(stockLedger.storeId, storeId)
        )
      )
      .orderBy(desc(stockLedger.createdAt))
      .limit(limit);
  }

  async checkLowStock(storeId: string, threshold: number = 10): Promise<any[]> {
    const balances = await this.getStockBalancesByStore(storeId);
    const lowStockItems = balances.filter((b) => b.quantity <= threshold);

    const variantIds = lowStockItems.map((item) => item.variantId);
    if (variantIds.length === 0) return [];

    const variants = await db
      .select()
      .from(productVariants)
      .where(
        sql`${productVariants.id} = ANY(${variantIds})`
      );

    return lowStockItems.map((item) => {
      const variant = variants.find((v) => v.id === item.variantId);
      return {
        ...item,
        variant,
      };
    });
  }
}

export const inventoryService = new InventoryService();
