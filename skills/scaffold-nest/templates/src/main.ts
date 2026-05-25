import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

/**
 * Bootstrap the NestJS app.
 *
 * Order matters: parse env first so the logger can be configured, then
 * create the app, wire global pipes/filters/interceptors, enable CORS,
 * and listen. Every error below the global filter is normalized before
 * the response leaves the process.
 */
async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule, {
        // Defer logger construction until we know NODE_ENV; the built-in Logger
        // is a reasonable default — swap for nestjs-pino later if needed.
        bufferLogs: true,
    });

    const config = app.get(ConfigService);
    const logger = new Logger('Bootstrap');

    // ── API prefix (e.g. /api/v1) ────────────────────────────────────
    const apiPrefix = config.get<string>('app.apiPrefix');
    if (apiPrefix) app.setGlobalPrefix(apiPrefix);

    // ── CORS ─────────────────────────────────────────────────────────
    // Default: allow all origins. Lock down via CORS_ORIGINS env var
    // (comma-separated). When origins are restricted, `credentials: true`
    // is enabled so cookies/auth headers work cross-origin.
    const origins = config.get<string>('app.corsOrigins') ?? '*';
    if (origins === '*' || origins === '') {
        app.enableCors({ origin: '*' });
    } else {
        const allowList = origins.split(',').map((s) => s.trim()).filter(Boolean);
        app.enableCors({ origin: allowList, credentials: true });
    }

    // ── Global pipes / filters / interceptors ────────────────────────
    // ValidationPipe: strips unknown fields, transforms primitives, rejects extras.
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: { enableImplicitConversion: true },
        }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new LoggingInterceptor(), new ResponseInterceptor());

    // ── Listen ───────────────────────────────────────────────────────
    const port = config.get<number>('app.port') ?? 3000;
    await app.listen(port);
    logger.log(`__APP_NAME__ listening on http://localhost:${port}${apiPrefix ? '/' + apiPrefix : ''}`);
}

bootstrap().catch((err) => {
    // Last-resort handler — if we can't boot, we can't log via Nest.
    // eslint-disable-next-line no-console
    console.error('[bootstrap] fatal error:', err);
    process.exit(1);
});
