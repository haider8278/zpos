import { pgTable, uuid, varchar, timestamp, text, boolean, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const userRoleEnum = pgEnum('user_role', ['ADMIN', 'STORE_MANAGER', 'CASHIER']);
export const permissionEnum = pgEnum('permission', [
  'CASH_DRAWER_OPEN',
  'VOID_INVOICE',
  'PROCESS_RETURN',
  'MANUAL_DISCOUNT_OVERRIDE',
  'MODIFY_TAX_CONFIG',
  'MANAGE_USERS',
  'MANAGE_INVENTORY',
  'MANAGE_STORES',
  'VIEW_REPORTS',
]);

export const invoiceTypeEnum = pgEnum('invoice_type', [
  'SALE',
  'DEBIT_NOTE',
  'CREDIT_NOTE',
]);

export const fbrSyncStatusEnum = pgEnum('fbr_sync_status', [
  'PENDING',
  'SUCCESS',
  'FAILED',
  'RETRYING',
]);

export const taxCategoryEnum = pgEnum('tax_category', ['STANDARD', 'REDUCED', 'ZERO_RATED', 'EXEMPT']);
export const stockMovementTypeEnum = pgEnum('stock_movement_type', [
  'PURCHASE',
  'SALE',
  'RETURN',
  'ADJUSTMENT',
  'TRANSFER_OUT',
  'TRANSFER_IN',
]);
export const transferStatusEnum = pgEnum('transfer_status', [
  'DRAFT',
  'PENDING',
  'IN_TRANSIT',
  'RECEIVED',
  'CANCELLED',
]);

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'DRAFT',
  'COMPLETED',
  'PENDING_SYNC',
  'SYNCED',
  'SYNC_FAILED',
  'VOIDED',
  'RETURNED',
  'PARTIALLY_RETURNED',
]);

export const paymentModeEnum = pgEnum('payment_mode', [
  'CASH',
  'CARD',
  'EASYPAYSA',
  'JAZZCASH',
  'BANK_TRANSFER',
]);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 100 }).unique().notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  roleId: uuid('role_id').references(() => roles.id).notNull(),
  storeId: uuid('store_id').references(() => stores.id),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: userRoleEnum('name').unique().notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: permissionEnum('name').unique().notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const rolePermissions = pgTable('role_permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  roleId: uuid('role_id').references(() => roles.id).notNull(),
  permissionId: uuid('permission_id').references(() => permissions.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const stores = pgTable('stores', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).unique().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  address: text('address'),
  ntn: varchar('ntn', { length: 50 }),
  strn: varchar('strn', { length: 50 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const terminals = pgTable('terminals', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull(),
  storeId: uuid('store_id').references(() => stores.id).notNull(),
  posId: varchar('pos_id', { length: 100 }).unique(),
  deviceId: varchar('device_id', { length: 255 }).unique(),
  currentSequence: integer('current_sequence').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  lastSyncAt: timestamp('last_sync_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  terminalId: uuid('terminal_id').references(() => terminals.id),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 100 }),
  entityId: uuid('entity_id'),
  beforeValue: jsonb('before_value'),
  afterValue: jsonb('after_value'),
  metadata: jsonb('metadata'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Phase 4: FBR Integration
export const fbrSubmissions = pgTable('fbr_submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').references(() => invoices.id).notNull(),
  invoiceType: invoiceTypeEnum('invoice_type').notNull().default('SALE'),
  status: fbrSyncStatusEnum('status').notNull().default('PENDING'),
  requestPayload: jsonb('request_payload').notNull(),
  responsePayload: jsonb('response_payload'),
  fbrInvoiceNumber: varchar('fbr_invoice_number', { length: 100 }),
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').notNull().default(0),
  lastRetryAt: timestamp('last_retry_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  syncedAt: timestamp('synced_at'),
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  token: text('token').unique().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  revokedAt: timestamp('revoked_at'),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  role: one(roles, {
    fields: [users.roleId],
    references: [roles.id],
  }),
  store: one(stores, {
    fields: [users.storeId],
    references: [stores.id],
  }),
  auditLogs: many(auditLogs),
  refreshTokens: many(refreshTokens),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(users),
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const storesRelations = relations(stores, ({ many }) => ({
  users: many(users),
  terminals: many(terminals),
}));

export const terminalsRelations = relations(terminals, ({ one, many }) => ({
  store: one(stores, {
    fields: [terminals.storeId],
    references: [stores.id],
  }),
  auditLogs: many(auditLogs),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

// Phase 2: Catalog and Inventory tables

export const taxCategories = pgTable('tax_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  category: taxCategoryEnum('category').unique().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  defaultRate: integer('default_rate').notNull(),
  effectiveFrom: timestamp('effective_from').notNull(),
  effectiveTo: timestamp('effective_to'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  brand: varchar('brand', { length: 255 }),
  category: varchar('category', { length: 255 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const productVariants = pgTable('product_variants', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  sku: varchar('sku', { length: 100 }).unique().notNull(),
  barcode: varchar('barcode', { length: 100 }).unique(),
  itemName: varchar('item_name', { length: 255 }).notNull(),
  size: varchar('size', { length: 50 }),
  color: varchar('color', { length: 50 }),
  competitorSku: varchar('competitor_sku', { length: 100 }),
  pctCode: varchar('pct_code', { length: 50 }),
  taxCategoryId: uuid('tax_category_id').references(() => taxCategories.id).notNull(),
  unitPrice: integer('unit_price').notNull(),
  costPrice: integer('cost_price'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const stockLedger = pgTable('stock_ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  variantId: uuid('variant_id').references(() => productVariants.id).notNull(),
  storeId: uuid('store_id').references(() => stores.id).notNull(),
  movementType: stockMovementTypeEnum('movement_type').notNull(),
  quantity: integer('quantity').notNull(),
  referenceType: varchar('reference_type', { length: 50 }),
  referenceId: uuid('reference_id'),
  userId: uuid('user_id').references(() => users.id).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const stockTransfers = pgTable('stock_transfers', {
  id: uuid('id').primaryKey().defaultRandom(),
  transferNumber: varchar('transfer_number', { length: 100 }).unique().notNull(),
  fromStoreId: uuid('from_store_id').references(() => stores.id).notNull(),
  toStoreId: uuid('to_store_id').references(() => stores.id).notNull(),
  status: transferStatusEnum('status').notNull().default('DRAFT'),
  requestedBy: uuid('requested_by').references(() => users.id).notNull(),
  approvedBy: uuid('approved_by').references(() => users.id),
  receivedBy: uuid('received_by').references(() => users.id),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  approvedAt: timestamp('approved_at'),
  receivedAt: timestamp('received_at'),
});

export const stockTransferItems = pgTable('stock_transfer_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  transferId: uuid('transfer_id').references(() => stockTransfers.id).notNull(),
  variantId: uuid('variant_id').references(() => productVariants.id).notNull(),
  requestedQuantity: integer('requested_quantity').notNull(),
  transferredQuantity: integer('transferred_quantity'),
  receivedQuantity: integer('received_quantity'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const taxCategoriesRelations = relations(taxCategories, ({ many }) => ({
  variants: many(productVariants),
}));

export const productsRelations = relations(products, ({ many }) => ({
  variants: many(productVariants),
}));

export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
  taxCategory: one(taxCategories, {
    fields: [productVariants.taxCategoryId],
    references: [taxCategories.id],
  }),
  stockMovements: many(stockLedger),
  transferItems: many(stockTransferItems),
}));

export const stockLedgerRelations = relations(stockLedger, ({ one }) => ({
  variant: one(productVariants, {
    fields: [stockLedger.variantId],
    references: [productVariants.id],
  }),
  store: one(stores, {
    fields: [stockLedger.storeId],
    references: [stores.id],
  }),
  user: one(users, {
    fields: [stockLedger.userId],
    references: [users.id],
  }),
}));

export const stockTransfersRelations = relations(stockTransfers, ({ one, many }) => ({
  fromStore: one(stores, {
    fields: [stockTransfers.fromStoreId],
    references: [stores.id],
  }),
  toStore: one(stores, {
    fields: [stockTransfers.toStoreId],
    references: [stores.id],
  }),
  requestedByUser: one(users, {
    fields: [stockTransfers.requestedBy],
    references: [users.id],
  }),
  items: many(stockTransferItems),
}));

export const stockTransferItemsRelations = relations(stockTransferItems, ({ one }) => ({
  transfer: one(stockTransfers, {
    fields: [stockTransferItems.transferId],
    references: [stockTransfers.id],
  }),
  variant: one(productVariants, {
    fields: [stockTransferItems.variantId],
    references: [productVariants.id],
  }),
}));

// Phase 3: Sales and Checkout tables

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceNumber: varchar('invoice_number', { length: 100 }).unique().notNull(),
  usin: varchar('usin', { length: 100 }).unique().notNull(),
  storeId: uuid('store_id').references(() => stores.id).notNull(),
  terminalId: uuid('terminal_id').references(() => terminals.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  invoiceType: invoiceTypeEnum('invoice_type').notNull().default('SALE'),
  originalInvoiceId: uuid('original_invoice_id').references((): any => invoices.id),
  status: invoiceStatusEnum('status').notNull().default('DRAFT'),
  subtotal: integer('subtotal').notNull(),
  totalDiscount: integer('total_discount').notNull().default(0),
  taxableAmount: integer('taxable_amount').notNull(),
  totalTax: integer('total_tax').notNull(),
  furtherTax: integer('further_tax').notNull().default(0),
  posFee: integer('pos_fee').notNull().default(0),
  total: integer('total').notNull(),
  buyerNtn: varchar('buyer_ntn', { length: 50 }),
  buyerStrn: varchar('buyer_strn', { length: 50 }),
  buyerName: varchar('buyer_name', { length: 255 }),
  buyerCnic: varchar('buyer_cnic', { length: 20 }),
  buyerPhoneNumber: varchar('buyer_phone_number', { length: 20 }),
  fbrInvoiceNumber: varchar('fbr_invoice_number', { length: 100 }),
  fbrQrCode: text('fbr_qr_code'),
  fbrResponse: jsonb('fbr_response'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  syncedAt: timestamp('synced_at'),
});

export const invoiceItems = pgTable('invoice_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').references(() => invoices.id).notNull(),
  variantId: uuid('variant_id').references(() => productVariants.id).notNull(),
  sku: varchar('sku', { length: 100 }).notNull(),
  itemName: varchar('item_name', { length: 255 }).notNull(),
  pctCode: varchar('pct_code', { length: 50 }),
  quantity: integer('quantity').notNull(),
  unitPrice: integer('unit_price').notNull(),
  lineDiscount: integer('line_discount').notNull().default(0),
  allocatedCartDiscount: integer('allocated_cart_discount').notNull().default(0),
  taxRate: integer('tax_rate').notNull(),
  taxAmount: integer('tax_amount').notNull(),
  lineTotal: integer('line_total').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').references(() => invoices.id).notNull(),
  paymentMode: paymentModeEnum('payment_mode').notNull(),
  amount: integer('amount').notNull(),
  reference: varchar('reference', { length: 255 }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  store: one(stores, {
    fields: [invoices.storeId],
    references: [stores.id],
  }),
  terminal: one(terminals, {
    fields: [invoices.terminalId],
    references: [terminals.id],
  }),
  user: one(users, {
    fields: [invoices.userId],
    references: [users.id],
  }),
  items: many(invoiceItems),
  payments: many(payments),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
  variant: one(productVariants, {
    fields: [invoiceItems.variantId],
    references: [productVariants.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
}));

export const fbrSubmissionsRelations = relations(fbrSubmissions, ({ one }) => ({
  invoice: one(invoices, {
    fields: [fbrSubmissions.invoiceId],
    references: [invoices.id],
  }),
}));
