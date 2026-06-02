# pages/

Route-level view components. One folder per page:

```
pages/
├── Home/
│   ├── Home.tsx          # imports './Home.scss' once; uses real class names
│   ├── Home.scss         # traditional SCSS (no CSS modules)
│   └── index.ts
└── About/
    └── ...
```

Pages compose components, wire up data via hooks/services, and own routing concerns. Populated when the `--router` feature is scaffolded.
