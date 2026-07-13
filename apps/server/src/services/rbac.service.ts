import { db } from '../db';
import { permissions, rolePermissions } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { Permission } from '@zpos/shared';

export class RBACService {
  private permissionsCache = new Map<string, Set<string>>();

  async getUserPermissions(roleId: string): Promise<Set<string>> {
    if (this.permissionsCache.has(roleId)) {
      return this.permissionsCache.get(roleId)!;
    }

    const perms = await db
      .select({
        name: permissions.name,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId));

    const permissionSet = new Set(perms.map((p) => p.name));
    this.permissionsCache.set(roleId, permissionSet);

    return permissionSet;
  }

  async hasPermission(roleId: string, permission: Permission): Promise<boolean> {
    const permissions = await this.getUserPermissions(roleId);
    return permissions.has(permission);
  }

  async hasAnyPermission(roleId: string, requiredPermissions: Permission[]): Promise<boolean> {
    const permissions = await this.getUserPermissions(roleId);
    return requiredPermissions.some((p) => permissions.has(p));
  }

  async hasAllPermissions(roleId: string, requiredPermissions: Permission[]): Promise<boolean> {
    const permissions = await this.getUserPermissions(roleId);
    return requiredPermissions.every((p) => permissions.has(p));
  }

  clearCache() {
    this.permissionsCache.clear();
  }
}

export const rbacService = new RBACService();
