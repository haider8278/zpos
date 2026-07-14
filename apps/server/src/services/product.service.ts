import { db } from '../db';
import { products, productVariants, taxCategories } from '../db/schema';
import { eq, ilike, or } from 'drizzle-orm';

export interface CreateProductData {
  name: string;
  description?: string;
  brand?: string;
  category?: string;
}

export interface CreateVariantData {
  productId: string;
  sku: string;
  barcode?: string;
  itemName: string;
  size?: string;
  color?: string;
  competitorSku?: string;
  pctCode?: string;
  taxCategoryId: string;
  unitPrice: number;
  costPrice?: number;
}

export class ProductService {
  async createProduct(data: CreateProductData) {
    const [product] = await db.insert(products).values(data).returning();
    return product;
  }

  async getProductById(id: string) {
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    return product;
  }

  async searchProducts(query: string) {
    return db
      .select()
      .from(products)
      .where(
        or(
          ilike(products.name, `%${query}%`),
          ilike(products.brand, `%${query}%`),
          ilike(products.category, `%${query}%`)
        )
      )
      .limit(50);
  }

  async updateProduct(id: string, data: Partial<CreateProductData>) {
    const [updated] = await db
      .update(products)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return updated;
  }

  async createVariant(data: CreateVariantData) {
    const [variant] = await db.insert(productVariants).values(data).returning();
    return variant;
  }

  async getVariantById(id: string) {
    const [variant] = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, id))
      .limit(1);
    return variant;
  }

  async getVariantBySku(sku: string) {
    const [variant] = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.sku, sku))
      .limit(1);
    return variant;
  }

  async getVariantByBarcode(barcode: string) {
    const [variant] = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.barcode, barcode))
      .limit(1);
    return variant;
  }

  async getProductVariants(productId: string) {
    return db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, productId));
  }

  async searchVariants(query: string) {
    return db
      .select()
      .from(productVariants)
      .where(
        or(
          eq(productVariants.sku, query),
          eq(productVariants.barcode, query),
          ilike(productVariants.itemName, `%${query}%`)
        )
      )
      .limit(50);
  }

  async updateVariant(id: string, data: Partial<CreateVariantData>) {
    const [updated] = await db
      .update(productVariants)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productVariants.id, id))
      .returning();
    return updated;
  }

  async getTaxCategories() {
    return db.select().from(taxCategories).where(eq(taxCategories.isActive, true));
  }

  async getTaxCategoryById(id: string) {
    const [category] = await db
      .select()
      .from(taxCategories)
      .where(eq(taxCategories.id, id))
      .limit(1);
    return category;
  }
}

export const productService = new ProductService();
