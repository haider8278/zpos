import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { productService } from '../services/product.service';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { auditService } from '../services/audit.service';

const CreateProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
});

const CreateVariantSchema = z.object({
  productId: z.string().uuid(),
  sku: z.string().min(1),
  barcode: z.string().optional(),
  itemName: z.string().min(1),
  size: z.string().optional(),
  color: z.string().optional(),
  competitorSku: z.string().optional(),
  pctCode: z.string().optional(),
  taxCategoryId: z.string().uuid(),
  unitPrice: z.number().int().positive(),
  costPrice: z.number().int().positive().optional(),
});

export async function productRoutes(fastify: FastifyInstance) {
  fastify.get('/products', {
    preHandler: [authenticate],
    handler: async (request) => {
      const { q } = request.query as { q?: string };
      
      if (q) {
        const products = await productService.searchProducts(q);
        return { products };
      }

      return { products: [] };
    },
  });

  fastify.get('/products/:id', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const product = await productService.getProductById(id);

      if (!product) {
        return reply.status(404).send({ error: 'Product not found' });
      }

      const variants = await productService.getProductVariants(id);
      return { product, variants };
    },
  });

  fastify.post('/products', {
    preHandler: [authenticate, requirePermission('MANAGE_INVENTORY')],
    schema: {
      body: CreateProductSchema,
    },
    handler: async (request) => {
      const data = request.body as z.infer<typeof CreateProductSchema>;
      const product = await productService.createProduct(data);

      await auditService.log({
        userId: request.user!.id,
        action: 'CREATE_PRODUCT',
        entityType: 'PRODUCT',
        entityId: product.id,
        afterValue: product,
        ipAddress: request.ip,
      });

      return { product };
    },
  });

  fastify.get('/variants/search', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { q } = request.query as { q: string };

      if (!q) {
        return reply.status(400).send({ error: 'Query parameter required' });
      }

      const variants = await productService.searchVariants(q);
      return { variants };
    },
  });

  fastify.get('/variants/:id', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const variant = await productService.getVariantById(id);

      if (!variant) {
        return reply.status(404).send({ error: 'Variant not found' });
      }

      return { variant };
    },
  });

  fastify.post('/variants', {
    preHandler: [authenticate, requirePermission('MANAGE_INVENTORY')],
    schema: {
      body: CreateVariantSchema,
    },
    handler: async (request) => {
      const data = request.body as z.infer<typeof CreateVariantSchema>;
      const variant = await productService.createVariant(data);

      await auditService.log({
        userId: request.user!.id,
        action: 'CREATE_VARIANT',
        entityType: 'PRODUCT_VARIANT',
        entityId: variant.id,
        afterValue: variant,
        ipAddress: request.ip,
      });

      return { variant };
    },
  });

  fastify.get('/tax-categories', {
    preHandler: [authenticate],
    handler: async () => {
      const categories = await productService.getTaxCategories();
      return { categories };
    },
  });
}
