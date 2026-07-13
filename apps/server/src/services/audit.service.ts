import { db } from '../db';
import { auditLogs } from '../db/schema';

export interface AuditLogData {
  userId: string;
  terminalId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  beforeValue?: any;
  afterValue?: any;
  metadata?: any;
  ipAddress?: string;
}

export class AuditService {
  async log(data: AuditLogData) {
    await db.insert(auditLogs).values({
      userId: data.userId,
      terminalId: data.terminalId,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      beforeValue: data.beforeValue,
      afterValue: data.afterValue,
      metadata: data.metadata,
      ipAddress: data.ipAddress,
    });
  }

  async getAuditLogs(filters: {
    userId?: string;
    terminalId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const query = db.select().from(auditLogs);
    
    return query.limit(filters.limit || 100).offset(filters.offset || 0);
  }
}

export const auditService = new AuditService();
