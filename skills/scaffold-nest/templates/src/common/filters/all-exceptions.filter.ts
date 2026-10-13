import {
	ArgumentsHost,
	Catch,
	ExceptionFilter,
	HttpException,
	HttpStatus,
	Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCode } from '../constants';

/**
 * Universal exception filter. Catches every uncaught error and emits a
 * standardized response shape:
 *   { error: { code, message, details?, timestamp, path } }
 *
 * Hook additional concerns here (Sentry, audit logs, metrics) — every error
 * in the app funnels through this single point.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
	private readonly logger = new Logger(AllExceptionsFilter.name);

	catch(exception: unknown, host: ArgumentsHost): void {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const request = ctx.getRequest<Request>();

		const { status, code, message, details } = this.classify(exception);

		// Always log 5xx. Log 4xx at debug level (they're usually client noise).
		if (status >= 500) {
			this.logger.error(
				`${request.method} ${request.url} → ${status} ${code}: ${message}`,
				exception instanceof Error ? exception.stack : undefined,
			);
		} else {
			this.logger.debug(`${request.method} ${request.url} → ${status} ${code}: ${message}`);
		}

		response.status(status).json({
			error: {
				code,
				message,
				details,
				timestamp: new Date().toISOString(),
				path: request.url,
			},
		});
	}

	private classify(exception: unknown): {
		status: number;
		code: string;
		message: string;
		details?: unknown;
	} {
		if (exception instanceof HttpException) {
			const status = exception.getStatus();
			const raw = exception.getResponse();
			const { message, details } = this.extract(raw, exception.message);
			return {
				status,
				code: this.codeFor(status),
				message,
				details,
			};
		}

		if (exception instanceof Error) {
			return {
				status: HttpStatus.INTERNAL_SERVER_ERROR,
				code: ErrorCode.InternalError,
				message: exception.message || 'Internal server error',
			};
		}

		return {
			status: HttpStatus.INTERNAL_SERVER_ERROR,
			code: ErrorCode.InternalError,
			message: 'Internal server error',
		};
	}

	private extract(raw: string | object, fallback: string): { message: string; details?: unknown } {
		if (typeof raw === 'string') return { message: raw };
		if (raw && typeof raw === 'object') {
			const r = raw as { message?: unknown; error?: unknown };
			const message = Array.isArray(r.message)
				? r.message.join('; ')
				: typeof r.message === 'string'
				  ? r.message
				  : fallback;
			// Preserve the shape Nest returns from ValidationPipe for debuggability
			const details = Array.isArray(r.message) ? { fields: r.message } : undefined;
			return { message, details };
		}
		return { message: fallback };
	}

	private codeFor(status: number): string {
		switch (status) {
			case 400: return ErrorCode.BadRequest;
			case 401: return ErrorCode.Unauthorized;
			case 403: return ErrorCode.Forbidden;
			case 404: return ErrorCode.NotFound;
			case 409: return ErrorCode.Conflict;
			case 422: return ErrorCode.ValidationError;
			case 429: return ErrorCode.RateLimited;
			default:  return status >= 500 ? ErrorCode.InternalError : ErrorCode.BadRequest;
		}
	}
}
