import { FastifyRequest, FastifyReply } from 'fastify';
import type { Permission } from '@zpos/shared';

export interface AuthUser {
  id: string;
  username: string;
  roleId: string;
  storeId?: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthUser;
    user: AuthUser;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
}

export function requirePermission(permission: Permission) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { rbacService } = await import('../services/rbac.service');
    const hasPermission = await rbacService.hasPermission(request.user.roleId, permission);

    if (!hasPermission) {
      return reply.status(403).send({ error: 'Forbidden: Insufficient permissions' });
    }
  };
}

export function requireAnyPermission(permissions: Permission[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { rbacService } = await import('../services/rbac.service');
    const hasPermission = await rbacService.hasAnyPermission(request.user.roleId, permissions);

    if (!hasPermission) {
      return reply.status(403).send({ error: 'Forbidden: Insufficient permissions' });
    }
  };
}

export function requireAllPermissions(permissions: Permission[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { rbacService } = await import('../services/rbac.service');
    const hasPermission = await rbacService.hasAllPermissions(request.user.roleId, permissions);

    if (!hasPermission) {
      return reply.status(403).send({ error: 'Forbidden: Insufficient permissions' });
    }
  };
}
