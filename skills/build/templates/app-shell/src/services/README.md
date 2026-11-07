# services/

Side-effectful modules: API clients, storage adapters, service workers, socket connections. One folder per service. Expose a narrow interface so the rest of the app can swap implementations.

```
services/
├── api/          # fetch wrappers, endpoints
├── storage/      # localStorage / IndexedDB adapters
└── sw/           # service worker (when enabled)
```
