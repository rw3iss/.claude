# tests/

Test suite run via Jest + `@vendidit/test-tools`.

```
tests/
├── framework/           # @vendidit/test-tools hooks (globalSetup, setupGlobals)
├── specs/               # *.spec.ts — one file per concern
│   └── smoke.spec.ts    # boots Nest, verifies success + error envelope shape
└── README.md
```

Run:

```bash
pnpm test               # full suite
pnpm test:smoke         # smoke only
pnpm test:watch         # interactive
```

Config lives in `config/jest.config.js` (referenced from `package.json` scripts). Project name for the test-tools reporter is in `testtools.config.json` at project root.
