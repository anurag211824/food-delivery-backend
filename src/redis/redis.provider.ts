import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

function getRedisOptions(redisUrl?: string): RedisOptions {
  if (!redisUrl) {
    return { host: '127.0.0.1', port: 6379 };
  }

  const url = new URL(redisUrl);
  const shouldUseTls =
    url.protocol === 'rediss:' || url.hostname.endsWith('.upstash.io');

  return {
    host: url.hostname,
    port: url.port ? parseInt(url.port, 10) : 6379,
    username: url.username || undefined,
    password: url.password || undefined,
    tls: shouldUseTls ? {} : undefined,
  };
}

export const RedisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): Redis => {
    return new Redis(getRedisOptions(configService.get<string>('REDIS_URL')));
  },
};
