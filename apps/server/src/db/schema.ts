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
