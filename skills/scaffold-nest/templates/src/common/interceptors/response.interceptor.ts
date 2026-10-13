import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

/**
 * Standardizes successful responses as `{ data, timestamp }`.
 *
 * Skip conditions:
 *   - If the handler already returns an object with `data` or `error`, pass through.
 *   - If the controller wants raw output (files, streams), opt out via a decorator
 *     later (e.g. @SkipWrap()) — not implemented yet.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, unknown> {
	intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
		return next.handle().pipe(
			map((data) => {
				if (data !== null && typeof data === 'object' && ('data' in data || 'error' in data)) {
					return data;
				}
				return { data, timestamp: new Date().toISOString() };
			}),
		);
	}
}
