import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

redis.on('error', (err) => console.error('[Redis]', err.message));
redis.on('connect', () => console.log('[Redis] connected'));

export const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export const refreshKey = (userId: string) => `refresh:${userId}`;

export default redis;
