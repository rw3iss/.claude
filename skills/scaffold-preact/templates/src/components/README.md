# components/

Reusable presentational components. Each component gets its own folder:

```
components/
└── Button/
    ├── Button.tsx
    ├── Button.module.scss
    └── index.ts
```

Components are pure and composable. State belongs in hooks (`src/hooks/`), side effects belong in services (`src/services/`), pure logic belongs in utilities (`src/lib/`).
