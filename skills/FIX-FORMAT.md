---
name: format
description: Look for linting issues in the code and try to fix them. Use this skill when asked to check the codebase for code or linting errors, or when formatting the codebase, or when the user says "fix" or "format" or "lint".
---

When linting or formatting code, run this process:

1. **Run existing linter**: If the codebase is a typescript codebase, find its linting process and run it, usually 'pnpm lint' or 'make lint', or otherwise run it's linting process.
2. **Fix any linting errors**: Use the output of the previous step to diagnose any errors and try to fix them.
3. **Repeat until error-free**: Repeat steps 1 and 2 until the codebase has no more linting errors, or otherwise cannot be fixed.
4. **Format code**: Once the codebase is free of errors, run the existing formatter on it (usually 'pnpm format'). If no formatter exists, setup a basic one with 4-space indentation, and run it.

For any errors that cannot be fixed, try to add a linting ignore rule, if it makes sense, or otherwise summarize the issue afterwards so we can try to fix it.