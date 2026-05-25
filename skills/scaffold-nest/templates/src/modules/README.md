# modules/

Feature modules live here. One folder per domain, following the standard shape:

```
modules/
└── users/
    ├── users.module.ts
    ├── users.controller.ts
    ├── users.service.ts
    ├── entities/
    │   └── user.entity.ts
    └── dto/
        ├── create-user.dto.ts
        └── update-user.dto.ts
```

Import the module into `src/app.module.ts`. Keep the import list there flat — features don't import each other transitively; if they share behavior, extract into `src/common/` or a cross-cutting module.
