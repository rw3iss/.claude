// Shared type definitions consumed across src/. Keep this folder organized
// by domain as the app grows (e.g. src/types/user.ts, src/types/order.ts).

export type Maybe<T> = T | null | undefined;

export type AsyncState<T, E = Error> =
	| { status: 'idle' }
	| { status: 'loading' }
	| { status: 'success'; data: T }
	| { status: 'error'; error: E };
