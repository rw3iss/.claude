// Persistent client-side storage.
//
// A tiny, dependency-free wrapper over a key/value backend. Defaults to
// localStorage; swap in another backend (sessionStorage, an IndexedDB adapter,
// a memory stub for SSR/tests) by passing a different `StorageBackend` to the
// constructor. Values are JSON-serialised and namespaced by a prefix.
//
// This is the single place UI-state persistence and the data-cache layer read
// and write through, so the storage mechanism can change in one spot.

export interface StorageBackend {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

type Listener<T> = (value: T | undefined) => void;

const memoryBackend = (): StorageBackend => {
	const map = new Map<string, string>();
	return {
		getItem: (k) => (map.has(k) ? map.get(k)! : null),
		setItem: (k, v) => void map.set(k, v),
		removeItem: (k) => void map.delete(k),
	};
};

// Guard against environments without localStorage (SSR, privacy mode).
function defaultBackend(): StorageBackend {
	try {
		if (typeof localStorage !== 'undefined') {
			const probe = '__storage_probe__';
			localStorage.setItem(probe, '1');
			localStorage.removeItem(probe);
			return localStorage;
		}
	} catch {
		/* fall through to memory */
	}
	return memoryBackend();
}

export class Storage {
	private backend: StorageBackend;
	private prefix: string;
	private listeners = new Map<string, Set<Listener<unknown>>>();

	constructor(opts: { backend?: StorageBackend; prefix?: string } = {}) {
		this.backend = opts.backend ?? defaultBackend();
		this.prefix = opts.prefix ?? 'app:';
	}

	private k(key: string): string {
		return this.prefix + key;
	}

	get<T>(key: string, fallback?: T): T | undefined {
		const raw = this.backend.getItem(this.k(key));
		if (raw === null) return fallback;
		try {
			return JSON.parse(raw) as T;
		} catch {
			return fallback;
		}
	}

	set<T>(key: string, value: T): void {
		try {
			this.backend.setItem(this.k(key), JSON.stringify(value));
		} catch {
			/* quota / serialisation error — ignore so the UI never crashes */
		}
		this.emit(key, value);
	}

	remove(key: string): void {
		this.backend.removeItem(this.k(key));
		this.emit(key, undefined);
	}

	// Subscribe to changes for a key (same-tab). Returns an unsubscribe fn.
	subscribe<T>(key: string, fn: Listener<T>): () => void {
		const set = this.listeners.get(key) ?? new Set();
		set.add(fn as Listener<unknown>);
		this.listeners.set(key, set);
		return () => set.delete(fn as Listener<unknown>);
	}

	private emit<T>(key: string, value: T | undefined): void {
		this.listeners.get(key)?.forEach((fn) => fn(value));
	}
}

// Shared instances. UI preferences/state live under `ui:`; the data cache uses
// its own prefix so the two never collide.
export const uiStorage = new Storage({ prefix: 'ui:' });
export const cacheStorage = new Storage({ prefix: 'cache:' });
