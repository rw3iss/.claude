import { Test, TestingModule } from '@nestjs/testing';
import { Controller, Get, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';

/**
 * Smoke — boots a minimal Nest app with the global interceptor + filter
 * wired in, verifies both the wrapped success shape and error normalization
 * work. No DB / Redis required — that's the point of a smoke test.
 */

@Controller()
class SmokeController {
	@Get('ok')
	ok(): { hello: string } {
		return { hello: 'world' };
	}

	@Get('boom')
	boom(): never {
		throw new Error('boom');
	}
}

describe('smoke', () => {
	let app: INestApplication;

	beforeAll(async () => {
		const mod: TestingModule = await Test.createTestingModule({
			controllers: [SmokeController],
		}).compile();

		app = mod.createNestApplication();
		app.useGlobalInterceptors(new ResponseInterceptor());
		app.useGlobalFilters(new AllExceptionsFilter());
		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	it('wraps success responses as { data, timestamp }', async () => {
		const res = await request(app.getHttpServer()).get('/ok');
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({ data: { hello: 'world' } });
		expect(typeof res.body.timestamp).toBe('string');
	});

	it('normalizes uncaught errors into { error: { code, message, ... } }', async () => {
		const res = await request(app.getHttpServer()).get('/boom');
		expect(res.status).toBe(500);
		expect(res.body).toMatchObject({
			error: { code: 'INTERNAL_ERROR', message: 'boom' },
		});
		expect(res.body.error).toHaveProperty('timestamp');
		expect(res.body.error).toHaveProperty('path', '/boom');
	});
});
