import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { invoiceService } from '../services/invoice.service';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { auditService } from '../services/audit.service';
import { CartItemSchema, PaymentSchema } from '@zpos/shared';

const CreateInvoiceSchema = z.object({
  storeId: z.string().uuid(),
  terminalId: z.string().uuid(),
  items: z.array(CartItemSchema).min(1),
  payments: z.array(PaymentSchema).min(1),
  cartDiscount: z.number().int().nonnegative().optional(),
  buyerNtn: z.string().optional(),
  buyerStrn: z.string().optional(),
  notes: z.string().optional(),
});

export async function invoiceRoutes(fastify: FastifyInstance) {
  fastify.post('/checkout', {
    preHandler: [authenticate],
    schema: {
      body: CreateInvoiceSchema,
    },
    handler: async (request, reply) => {
      const data = request.body as z.infer<typeof CreateInvoiceSchema>;

      try {
        const result = await invoiceService.createInvoice({
          ...data,
          userId: request.user!.id,
        });

        await auditService.log({
          userId: request.user!.id,
          terminalId: data.terminalId,
          action: 'CREATE_INVOICE',
          entityType: 'INVOICE',
          entityId: result.invoice.id,
          afterValue: result,
          ipAddress: request.ip,
        });

        return result;
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    },
  });

  fastify.get('/invoices/:id', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const invoice = await invoiceService.getInvoiceById(id);

      if (!invoice) {
        return reply.status(404).send({ error: 'Invoice not found' });
      }

      return { invoice };
    },
  });

  fastify.get('/invoices/number/:invoiceNumber', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { invoiceNumber } = request.params as { invoiceNumber: string };
      const invoice = await invoiceService.getInvoiceByNumber(invoiceNumber);

      if (!invoice) {
        return reply.status(404).send({ error: 'Invoice not found' });
      }

      return { invoice };
    },
  });

  fastify.get('/invoices/store/:storeId', {
    preHandler: [authenticate],
    handler: async (request) => {
      const { storeId } = request.params as { storeId: string };
      const { limit } = request.query as { limit?: string };

      const invoices = await invoiceService.getInvoicesByStore(
        storeId,
        limit ? parseInt(limit) : 100
      );

      return { invoices };
    },
  });

  fastify.get('/invoices/terminal/:terminalId', {
    preHandler: [authenticate],
    handler: async (request) => {
      const { terminalId } = request.params as { terminalId: string };
      const { limit } = request.query as { limit?: string };

      const invoices = await invoiceService.getInvoicesByTerminal(
        terminalId,
        limit ? parseInt(limit) : 100
      );

      return { invoices };
    },
  });

  fastify.post('/invoices/:id/void', {
    preHandler: [authenticate, requirePermission('VOID_INVOICE')],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const invoice = await invoiceService.voidInvoice(id, request.user!.id);

        await auditService.log({
          userId: request.user!.id,
          action: 'VOID_INVOICE',
          entityType: 'INVOICE',
          entityId: id,
          afterValue: invoice,
          ipAddress: request.ip,
        });

        return { invoice };
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    },
  });
}
