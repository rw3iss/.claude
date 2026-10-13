import { Provider, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * Singleton ioredis client built from the validated redis config namespace.
 * Logs connection events so operators can tell quickly if Redis is missing.
 */
export const redisProvider: Provider = {
	provide: REDIS_CLIENT,
	inject: [ConfigService],
	useFactory: (config: ConfigService): Redis => {
		const logger = new Logger('Redis');
		const client = new Redis({
			host: config.get<string>('redis.host'),
			port: config.get<number>('redis.port'),
			password: config.get<string>('redis.password'),
			db: config.get<number>('redis.db'),
			// Don't deadlock startup if Redis is temporarily unavailable.
			lazyConnect: false,
			maxRetriesPerRequest: 3,
		});

		client.on('connect', () => logger.log('connected'));
		client.on('error', (err) => logger.warn(`error: ${err.message}`));
		client.on('end', () => logger.warn('disconnected'));

		return client;
	},
};
