# components/

Feature & UI components — **one folder per component**. Keep page-level/route views
in `src/pages/` instead; this folder is for reusable components and self-contained
features.

```
components/
├── comments/              # a feature: components/<feature-or-component>/
│   ├── Comments.tsx       #   imports './Comments.scss' once; uses class="comments"
│   ├── Comments.scss      #   traditional SCSS, real class names (no CSS modules)
│   └── index.ts
└── common/                # primitive / core shared components live here
    └── Button/            # components/common/<Component>/
        ├── Button.tsx     #   imports './Button.scss' once; uses class="button"
        ├── Button.scss
        └── index.ts
```

- **Feature / UI components** → `components/<feature-or-component>/`.
- **Common / primitive components** — raw, core building blocks reused across pages and
  features (Button, Input, Modal, Icon, Card, Tooltip, …) → the **`common/`** subfolder:
  `components/common/<Component>/`.
- **Pages** (route/screen views) do **not** go here — they live in `src/pages/<PageName>/`.

Components are pure and composable. State belongs in hooks (`src/hooks/`), side effects
belong in services (`src/services/`), pure logic belongs in utilities (`src/lib/`).
