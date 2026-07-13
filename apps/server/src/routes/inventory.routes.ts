import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { inventoryService } from '../services/inventory.service';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { auditService } from '../services/audit.service';

const RecordMovementSchema = z.object({
  variantId: z.string().uuid(),
  storeId: z.string().uuid(),
  movementType: z.enum(['PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT', 'TRANSFER_OUT', 'TRANSFER_IN']),
  quantity: z.number().int(),
  referenceType: z.string().optional(),
  referenceId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export async function inventoryRoutes(fastify: FastifyInstance) {
  fastify.get('/inventory/balance/:variantId/:storeId', {
    preHandler: [authenticate],
    handler: async (request) => {
      const { variantId, storeId } = request.params as { variantId: string; storeId: string };
      const balance = await inventoryService.getStockBalance(variantId, storeId);
      
      return { variantId, storeId, balance };
    },
  });

  fastify.get('/inventory/store/:storeId', {
    preHandler: [authenticate],
    handler: async (request) => {
      const { storeId } = request.params as { storeId: string };
      const balances = await inventoryService.getStockBalancesByStore(storeId);
      
      return { storeId, balances };
    },
  });

  fastify.get('/inventory/variant/:variantId', {
    preHandler: [authenticate],
    handler: async (request) => {
      const { variantId } = request.params as { variantId: string };
      const balances = await inventoryService.getStockBalancesByVariant(variantId);
      
      return { variantId, balances };
    },
  });

  fastify.get('/inventory/history/:variantId/:storeId', {
    preHandler: [authenticate],
    handler: async (request) => {
      const { variantId, storeId } = request.params as { variantId: string; storeId: string };
      const { limit } = request.query as { limit?: string };
      
      const history = await inventoryService.getMovementHistory(
        variantId,
        storeId,
        limit ? parseInt(limit) : 100
      );
      
      return { variantId, storeId, history };
    },
  });

  fastify.post('/inventory/movement', {
    preHandler: [authenticate, requirePermission('MANAGE_INVENTORY')],
    schema: {
      body: RecordMovementSchema,
    },
    handler: async (request) => {
      const data = request.body as z.infer<typeof RecordMovementSchema>;
      
      const movement = await inventoryService.recordMovement({
        ...data,
        userId: request.user!.id,
      });

      await auditService.log({
        userId: request.user!.id,
        action: 'RECORD_STOCK_MOVEMENT',
        entityType: 'STOCK_LEDGER',
        entityId: movement.id,
        afterValue: movement,
        ipAddress: request.ip,
      });

      return { movement };
    },
  });

  fastify.get('/inventory/low-stock/:storeId', {
    preHandler: [authenticate],
    handler: async (request) => {
      const { storeId } = request.params as { storeId: string };
      const { threshold } = request.query as { threshold?: string };
      
      const lowStockItems = await inventoryService.checkLowStock(
        storeId,
        threshold ? parseInt(threshold) : 10
      );
      
      return { storeId, lowStockItems };
    },
  });
}
