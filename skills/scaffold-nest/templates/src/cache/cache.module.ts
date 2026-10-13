import { Global, Module } from '@nestjs/common';
import { REDIS_CLIENT, redisProvider } from './redis.provider';

/**
 * Redis as a shared infrastructure concern. Any module can inject the
 * client by `@Inject(REDIS_CLIENT) private readonly redis: Redis`.
 *
 * Global so it's available everywhere without re-importing. If multiple
 * Redis clusters are ever needed, split into named providers here.
 */
@Global()
@Module({
	providers: [redisProvider],
	exports: [REDIS_CLIENT],
})
export class CacheModule {}
