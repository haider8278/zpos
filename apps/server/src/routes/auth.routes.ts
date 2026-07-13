import { FastifyInstance } from 'fastify';
import { LoginSchema, RefreshTokenSchema } from '@zpos/shared';
import { authService } from '../services/auth.service';
import { auditService } from '../services/audit.service';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/login', {
    schema: {
      body: LoginSchema,
    },
    handler: async (request, reply) => {
      const { username, password, terminalId } = request.body as any;

      const user = await authService.findUserByUsername(username);
      if (!user || !user.isActive) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const isValidPassword = await authService.verifyPassword(user.passwordHash, password);
      if (!isValidPassword) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const accessToken = fastify.jwt.sign(
        {
          id: user.id,
          username: user.username,
          roleId: user.roleId,
          storeId: user.storeId ?? undefined,
        },
        { expiresIn: '15m' }
      );

      const refreshToken = authService.generateRefreshToken();
      const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await authService.saveRefreshToken(user.id, refreshToken, refreshExpiresAt);

      await auditService.log({
        userId: user.id,
        action: 'LOGIN',
        ipAddress: request.ip,
        metadata: { terminalId },
      });

      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          roleId: user.roleId,
          storeId: user.storeId,
        },
      };
    },
  });

  fastify.post('/refresh', {
    schema: {
      body: RefreshTokenSchema,
    },
    handler: async (request, reply) => {
      const { refreshToken } = request.body as any;

      const tokenRecord = await authService.findRefreshToken(refreshToken);
      if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
        return reply.status(401).send({ error: 'Invalid or expired refresh token' });
      }

      const user = await authService.findUserById(tokenRecord.userId);
      if (!user || !user.isActive) {
        return reply.status(401).send({ error: 'User not found or inactive' });
      }

      await authService.revokeRefreshToken(refreshToken);

      const accessToken = fastify.jwt.sign(
        {
          id: user.id,
          username: user.username,
          roleId: user.roleId,
          storeId: user.storeId ?? undefined,
        },
        { expiresIn: '15m' }
      );

      const newRefreshToken = authService.generateRefreshToken();
      const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await authService.saveRefreshToken(user.id, newRefreshToken, refreshExpiresAt);

      return {
        accessToken,
        refreshToken: newRefreshToken,
      };
    },
  });

  fastify.post('/logout', {
    preHandler: async (request) => {
      try {
        await request.jwtVerify();
      } catch {
        throw new Error('Unauthorized');
      }
    },
    handler: async (request) => {
      const user = request.user as any;
      
      await authService.revokeUserRefreshTokens(user.id);

      await auditService.log({
        userId: user.id,
        action: 'LOGOUT',
        ipAddress: request.ip,
      });

      return { message: 'Logged out successfully' };
    },
  });
}
