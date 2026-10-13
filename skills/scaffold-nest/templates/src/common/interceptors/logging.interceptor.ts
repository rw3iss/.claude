import {
	CallHandler,
	ExecutionContext,
	Injectable,
	Logger,
	NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

/**
 * Logs each HTTP request: METHOD PATH → STATUS (Nms).
 * Replace with pino or OpenTelemetry later without touching call sites.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
	private readonly logger = new Logger('HTTP');

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const http = context.switchToHttp();
		const req = http.getRequest<Request>();
		const res = http.getResponse<Response>();
		const start = Date.now();

		return next.handle().pipe(
			tap({
				next: () => this.logger.log(`${req.method} ${req.url} → ${res.statusCode} (${Date.now() - start}ms)`),
				error: () => this.logger.warn(`${req.method} ${req.url} → error (${Date.now() - start}ms)`),
			}),
		);
	}
}
