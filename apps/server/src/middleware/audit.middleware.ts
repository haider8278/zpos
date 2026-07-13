import { FastifyRequest, FastifyReply } from 'fastify';
import { auditService } from '../services/audit.service';
import type { AuthUser } from './auth.middleware';

export function withAuditLog(action: string, entityType?: string) {
  return async (
    request: FastifyRequest,
    _reply: FastifyReply,
    done: () => void
  ) => {
    const user = request.user as AuthUser | undefined;
    
    if (!user) {
      done();
      return;
    }

    try {
      await auditService.log({
        userId: user.id,
        action,
        entityType,
        beforeValue: request.body,
        ipAddress: request.ip,
        metadata: {
          method: request.method,
          url: request.url,
        },
      });
    } catch (error) {
      request.log.error({ error }, 'Failed to create audit log');
    }

    done();
  };
}
