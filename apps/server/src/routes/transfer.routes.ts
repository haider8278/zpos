import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { transferService } from '../services/transfer.service';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { auditService } from '../services/audit.service';

const CreateTransferSchema = z.object({
  fromStoreId: z.string().uuid(),
  toStoreId: z.string().uuid(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      variantId: z.string().uuid(),
      requestedQuantity: z.number().int().positive(),
    })
  ).min(1),
});

export async function transferRoutes(fastify: FastifyInstance) {
  fastify.get('/transfers/:id', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await transferService.getTransferById(id);

      if (!result) {
        return reply.status(404).send({ error: 'Transfer not found' });
      }

      return result;
    },
  });

  fastify.get('/transfers/store/:storeId', {
    preHandler: [authenticate],
    handler: async (request) => {
      const { storeId } = request.params as { storeId: string };
      const transfers = await transferService.getTransfersByStore(storeId);
      
      return { transfers };
    },
  });

  fastify.post('/transfers', {
    preHandler: [authenticate, requirePermission('MANAGE_INVENTORY')],
    schema: {
      body: CreateTransferSchema,
    },
    handler: async (request) => {
      const data = request.body as z.infer<typeof CreateTransferSchema>;
      
      const result = await transferService.createTransfer({
        ...data,
        requestedBy: request.user!.id,
      });

      await auditService.log({
        userId: request.user!.id,
        action: 'CREATE_TRANSFER',
        entityType: 'STOCK_TRANSFER',
        entityId: result.transfer.id,
        afterValue: result,
        ipAddress: request.ip,
      });

      return result;
    },
  });

  fastify.post('/transfers/:id/approve', {
    preHandler: [authenticate, requirePermission('MANAGE_INVENTORY')],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      
      try {
        const transfer = await transferService.approveTransfer(id, request.user!.id);

        await auditService.log({
          userId: request.user!.id,
          action: 'APPROVE_TRANSFER',
          entityType: 'STOCK_TRANSFER',
          entityId: id,
          afterValue: transfer,
          ipAddress: request.ip,
        });

        return { transfer };
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    },
  });

  fastify.post('/transfers/:id/receive', {
    preHandler: [authenticate, requirePermission('MANAGE_INVENTORY')],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      
      try {
        const transfer = await transferService.receiveTransfer(id, request.user!.id);

        await auditService.log({
          userId: request.user!.id,
          action: 'RECEIVE_TRANSFER',
          entityType: 'STOCK_TRANSFER',
          entityId: id,
          afterValue: transfer,
          ipAddress: request.ip,
        });

        return { transfer };
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    },
  });

  fastify.post('/transfers/:id/cancel', {
    preHandler: [authenticate, requirePermission('MANAGE_INVENTORY')],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      
      const transfer = await transferService.cancelTransfer(id);

      if (!transfer) {
        return reply.status(400).send({ error: 'Cannot cancel transfer' });
      }

      await auditService.log({
        userId: request.user!.id,
        action: 'CANCEL_TRANSFER',
        entityType: 'STOCK_TRANSFER',
        entityId: id,
        afterValue: transfer,
        ipAddress: request.ip,
      });

      return { transfer };
    },
  });
}
