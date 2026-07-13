import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { authRoutes } from './routes/auth.routes';

const fastify = Fastify({
  logger: {
    level: config.nodeEnv === 'production' ? 'info' : 'debug',
  },
});

async function start() {
  try {
    await fastify.register(helmet);
    await fastify.register(cors);
    
    await fastify.register(rateLimit, {
      max: config.rateLimitMax,
      timeWindow: config.rateLimitWindow,
    });

    await fastify.register(jwt, {
      secret: config.jwtSecret,
    });

    fastify.get('/health', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    await fastify.register(authRoutes, { prefix: '/api/auth' });

    await fastify.listen({
      port: config.port,
      host: config.host,
    });

    fastify.log.info(`Server listening on ${config.host}:${config.port}`);
    fastify.log.info(`Environment: ${config.nodeEnv}`);
    fastify.log.info(`FBR Environment: ${config.fbr.environment}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
