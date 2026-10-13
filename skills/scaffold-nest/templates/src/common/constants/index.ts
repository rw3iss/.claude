// Cross-module constants. Keep this file small — domain constants belong
// in their own module's `constants.ts`.

/** Standard error codes used by AllExceptionsFilter. */
export const ErrorCode = {
	InternalError: 'INTERNAL_ERROR',
	BadRequest: 'BAD_REQUEST',
	Unauthorized: 'UNAUTHORIZED',
	Forbidden: 'FORBIDDEN',
	NotFound: 'NOT_FOUND',
	Conflict: 'CONFLICT',
	ValidationError: 'VALIDATION_ERROR',
	RateLimited: 'RATE_LIMITED',
} as const;

export type ErrorCodeKey = keyof typeof ErrorCode;
export type ErrorCodeValue = (typeof ErrorCode)[ErrorCodeKey];
