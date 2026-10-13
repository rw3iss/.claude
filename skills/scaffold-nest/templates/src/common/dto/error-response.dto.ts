// Shape emitted by AllExceptionsFilter. Mirror this in clients when wiring
// typed API contracts (or generate from the OpenAPI schema instead).

export interface ErrorResponse {
	error: {
		code: string;
		message: string;
		details?: unknown;
		timestamp: string;
		path: string;
	};
}

export interface SuccessResponse<T> {
	data: T;
	timestamp: string;
}
