import { Controller, Get, Inject } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../cache/redis.provider';

@Controller('health')
export class HealthController {
	constructor(
		@InjectDataSource() private readonly ds: DataSource,
		@Inject(REDIS_CLIENT) private readonly redis: Redis,
	) {}

	/**
	 * Liveness — returns 200 whenever the process is up.
	 * Use for container liveness probes; never checks dependencies.
	 */
	@Get()
	live(): { status: 'ok'; uptime: number } {
		return { status: 'ok', uptime: process.uptime() };
	}

	/**
	 * Readiness — verifies DB + Redis are reachable.
	 * Returns 200 only when every dependency responds; individual statuses
	 * are in the body regardless so ops tools can see what's degraded.
	 */
	@Get('ready')
	async ready(): Promise<{
		status: 'ok' | 'degraded';
		dependencies: { db: 'ok' | 'down'; redis: 'ok' | 'down' };
	}> {
		const db = await this.pingDb();
		const redis = await this.pingRedis();
		return {
			status: db === 'ok' && redis === 'ok' ? 'ok' : 'degraded',
			dependencies: { db, redis },
		};
	}

	private async pingDb(): Promise<'ok' | 'down'> {
		try {
			await this.ds.query('SELECT 1');
			return 'ok';
		} catch {
			return 'down';
		}
	}

	private async pingRedis(): Promise<'ok' | 'down'> {
		try {
			const res = await this.redis.ping();
			return res === 'PONG' ? 'ok' : 'down';
		} catch {
			return 'down';
		}
	}
}
