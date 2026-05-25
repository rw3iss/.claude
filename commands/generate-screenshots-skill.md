# Generate a project-specific screenshot skill

Analyze the current project and generate a custom skill file (`.claude/commands/take-screenshots.md`) that knows how to launch the application, authenticate, navigate to every screen/route/page, and capture a screenshot of each one.

## Arguments

- `$ARGUMENTS` — optional hints about the project (e.g. "it's a React app on port 3000", "console app, use arrow keys to navigate", "needs docker-compose up first"). If empty, auto-detect everything.

## Steps

### 1. Determine project type and tech stack

Read the project root for clues. Check these files in parallel:

- `package.json` — Node/JS/TS project, check `scripts` for dev/start commands, check `dependencies` for framework (React, Next.js, Vue, Svelte, Angular, Express, Nest, Electron, etc.)
- `Cargo.toml` — Rust project; check for `crossterm`, `tui`, `ratatui` (TUI app), `actix-web`/`axum` (web), `iced`/`egui`/`tauri` (desktop)
- `go.mod` — Go project; check for `bubbletea`/`tview` (TUI), `gin`/`echo`/`fiber` (web), `fyne`/`wails` (desktop)
- `requirements.txt` / `pyproject.toml` / `setup.py` — Python; check for `flask`/`django`/`fastapi` (web), `textual`/`curses`/`rich` (TUI), `tkinter`/`PyQt`/`kivy` (desktop)
- `pom.xml` / `build.gradle` — Java/Kotlin
- `Makefile`, `CMakeLists.txt` — C/C++
- `docker-compose.yml` / `Dockerfile` — containerized services
- `.env`, `.env.example`, `.env.development` — environment configuration
- `README.md` — often documents how to run the project

Classify the project into one of these categories:
- **web-spa** — Single-page app (React, Vue, Svelte, Angular) with a dev server
- **web-ssr** — Server-rendered (Next.js, Nuxt, SvelteKit, Remix)
- **web-backend** — API server with optional admin UI
- **web-fullstack** — Monorepo or combined frontend + backend
- **electron** — Electron/Tauri desktop app
- **desktop-native** — Native desktop GUI (Qt, GTK, SwiftUI, WinForms)
- **tui** — Terminal UI application (ratatui, bubbletea, textual, blessed, etc.)
- **cli** — Command-line tool with distinct output screens/modes
- **mobile** — React Native, Flutter, native iOS/Android (simulator required)
- **other** — Anything else; describe it

Record: `PROJECT_TYPE`, `FRAMEWORK`, `LANGUAGE`, `DEV_COMMAND` (how to start it), `DEV_URL` (if web), `PORT` (if web).

### 2. Discover all screens, routes, and pages

Based on the project type, use the appropriate discovery strategy:

**For web applications (web-spa, web-ssr, web-fullstack):**

a. Search for route definitions:
   - React Router: grep for `<Route`, `createBrowserRouter`, `path:` in router config files
   - Next.js: scan `app/` or `pages/` directory structure (each folder/file = route)
   - Vue Router: grep for `routes` array, `path:` definitions
   - Angular: grep for `RouterModule`, `Routes` arrays
   - SvelteKit: scan `src/routes/` directory structure
   - Express/Nest/etc.: grep for `.get(`, `.post(`, `@Get(`, `@Controller(` for API routes with views

b. For each discovered route, determine:
   - The URL path (e.g. `/dashboard`, `/settings/profile`)
   - Whether it requires authentication (is it inside an auth guard, protected route wrapper, or middleware?)
   - A human-readable name (derive from the path or component name)
   - A description of what the page shows (read the component briefly)
   - Any required URL parameters (e.g. `/users/:id` — need a valid ID)

c. Organize routes into groups:
   - **Public routes** (no auth): landing, login, signup, about, pricing, etc.
   - **Authenticated routes** (need login): dashboard, settings, profile, etc.
   - **Admin routes** (need admin role): admin panel, user management, etc.
   - **Dynamic routes** (need params): detail pages, edit forms — note what entity/ID is needed

**For TUI applications (tui, cli):**

a. Search for screen/view definitions:
   - Look for keybinding maps, command handlers, menu definitions
   - Search for screen/view/page structs or classes
   - Look for navigation state machines or tab definitions
   - Read the help text or `--help` output if available

b. For each screen, determine:
   - How to reach it (keyboard shortcut, command, menu selection)
   - A human-readable name
   - A description of what it shows
   - Any required input or state to display meaningful content

**For desktop applications (electron, desktop-native):**

a. Search for window/view definitions:
   - Look for `BrowserWindow` (Electron), window creation calls
   - Search for navigation menus, sidebar items, tab definitions
   - Look for route-like patterns within the desktop framework

b. For each screen, determine the same as above.

Build a `SCREENS` index — an ordered list of all discoverable screens with: `id`, `name`, `description`, `path_or_action`, `requires_auth`, `requires_params`, `group`.

### 3. Determine authentication strategy

Search for how authentication works:

a. **Find auth mechanism:**
   - JWT tokens in localStorage/cookies: search for `localStorage`, `setToken`, `Bearer`, `jwt`
   - Session-based: search for `express-session`, `cookie-session`, `passport`
   - OAuth: search for OAuth provider configs
   - API keys: search for `x-api-key`, `Authorization` headers
   - Basic auth: search for `basicAuth`, HTTP auth
   - No auth: no login page, no auth middleware
   - CLI auth: search for login commands, credential prompts, config file auth

b. **Find or create test credentials:**
   - Search for seed files, fixtures, migrations with user creation
   - Look for `.env` files with default credentials (`ADMIN_EMAIL`, `DEFAULT_PASSWORD`, etc.)
   - Search for test helpers that create users
   - Look in README for default login credentials
   - Check for `docker-compose` services that seed data

c. **Determine login flow:**
   - Web: which URL is the login page? What fields (email/username + password)? Any MFA?
   - API: which endpoint for login? What payload format?
   - CLI/TUI: what command or prompt for login?
   - None: no login needed

Record: `AUTH_TYPE`, `LOGIN_URL_OR_COMMAND`, `TEST_USERNAME`, `TEST_PASSWORD`, `AUTH_NOTES`.

### 4. Determine screenshot mechanism

Based on project type:

- **Web apps**: Use Playwright MCP tools (`browser_navigate`, `browser_take_screenshot`, `browser_click`, `browser_fill_form`, `browser_snapshot`, `browser_wait_for`)
- **TUI apps**: **IMPORTANT** — TUI/CLI apps are interactive full-screen terminal programs that cannot be controlled from within a Claude Code session. The generated skill MUST produce a standalone shell script (e.g. `scripts/take-screenshots.sh`) that:
  1. Launches the app in a **new terminal window** (`konsole`, `xterm`, or `gnome-terminal`)
  2. Uses `xdotool` to send keystrokes to the app window for navigation
  3. Uses `import` (ImageMagick) or `spectacle` to capture the window after each navigation
  4. Waits 1-2 seconds between actions for the TUI to re-render
  5. Generates an `index.json` manifest of all captured screenshots

  Required tools: `xdotool`, `import` (ImageMagick) or `spectacle`. The skill should check for these and tell the user to install any that are missing. The generated skill's instructions should tell Claude to write the script and then run it via Bash, rather than trying to interact with the TUI directly.
- **Desktop apps**: Same shell-script approach as TUI — launch the app, use `xdotool` for input, system screenshot tools for capture
- **Electron**: Can use Playwright since it's Chromium-based, OR system screenshot

Record: `SCREENSHOT_METHOD` and the specific tool/command to use.

### 5. Determine startup procedure

Figure out the full sequence to get the app running:

a. **Dependencies**: Does `node_modules/` exist? Does it need `npm install`/`yarn`/`pnpm install`? Does it need `cargo build`? `pip install`?
b. **Backend services**: Does it need a database? Redis? Docker containers? Check `docker-compose.yml`, `.env` for DB connection strings.
c. **Seed data**: Does it need `npm run seed`, `rails db:seed`, migrations, fixture loading?
d. **Dev server command**: The exact command to start in dev mode (e.g. `npm run dev`, `cargo run`, `python manage.py runserver`).
e. **Ready signal**: How to know the app is ready (e.g. "listening on port 3000", URL becomes reachable, process outputs a specific string).

Record: `SETUP_COMMANDS` (ordered list), `DEV_COMMAND`, `READY_SIGNAL`, `DEV_URL`.

### 6. Generate the skill file

Now write the project-specific skill to `.claude/commands/take-screenshots.md`. The generated skill MUST contain all the discovered information hardcoded into it, so that when invoked it does not need to re-analyze the project. Structure it as follows:

```markdown
# Take demo screenshots of [Project Name]

Capture screenshots of every screen in [Project Name] for documentation and demo purposes.

## Project Profile

- **Type**: [PROJECT_TYPE]
- **Framework**: [FRAMEWORK]
- **Language**: [LANGUAGE]
- **Screenshot method**: [SCREENSHOT_METHOD]

## Steps

### 1. Prepare the environment

[Exact commands to install deps, start services, run migrations/seeds, start the dev server. Include the READY_SIGNAL to wait for.]

### 2. Prepare screenshot output

Create a `screenshots/` directory in the project root. Initialize a results index:
\`\`\`json
{
  "project": "[Project Name]",
  "generated": "[timestamp]",
  "screenshots": []
}
\`\`\`

### 3. Authenticate (if needed)

[Exact steps to log in — navigate to login URL, fill credentials, submit, wait for redirect. OR create a test user first. OR set a token. OR skip if no auth.]

### 4. Capture screenshots

For each screen below, navigate to it, wait for it to fully load, then capture a screenshot and add it to the results index.

**Group: Public Pages**

| # | Name | Path/Action | Description | Filename |
|---|------|-------------|-------------|----------|
| 1 | [name] | [/path or action] | [description] | 01-[slug].png |
| ... | ... | ... | ... | ... |

**Group: Authenticated Pages**

| # | Name | Path/Action | Description | Filename |
|---|------|-------------|-------------|----------|
| ... | ... | ... | ... | ... |

**Group: Admin Pages** (if applicable)

| # | Name | Path/Action | Description | Filename |
|---|------|-------------|-------------|----------|
| ... | ... | ... | ... | ... |

For each entry:
[Specific navigation instructions — for web: browser_navigate to URL, browser_wait_for network idle, browser_take_screenshot. For TUI: send keystrokes via the terminal, sleep 1s, capture with system tool.]

### 5. Generate summary

Write the final results index to `screenshots/index.json`. Print a summary table listing every screenshot: number, name, description, file path, and file size.

## Screen Index

[Full listing of all discovered screens with IDs, names, descriptions, paths, auth requirements, and parameter requirements — this is the reference the skill uses in Step 4.]

## Authentication Details

- **Method**: [AUTH_TYPE]
- **Login**: [LOGIN_URL_OR_COMMAND]
- **Credentials**: [TEST_USERNAME] / [TEST_PASSWORD]
- **Notes**: [AUTH_NOTES]

## Startup Details

- **Install**: [install command]
- **Services**: [docker/db startup commands if any]
- **Seed**: [seed command if any]
- **Dev server**: [DEV_COMMAND]
- **Ready signal**: [READY_SIGNAL]
- **URL**: [DEV_URL]

## Rules

- Do not modify any source code or configuration files.
- If the dev server is already running, skip startup and reuse it.
- Wait for each page to fully load before screenshotting (network idle for web; 1-2 second delay for TUI/desktop).
- For dynamic routes that need entity IDs, query the API or database for the first available entity. If none exist, note it in the results as "skipped — no data".
- If a page fails to load or errors, capture the error state as the screenshot and note the failure in the results index.
- Screenshots should be 1280x800 for web apps (or the default Playwright viewport). For TUI/desktop, capture the full window.
- All screenshots go in `screenshots/` at the project root.
- The results index (`screenshots/index.json`) must be valid JSON.
```

### 7. Verify and report

1. Read back the generated `.claude/commands/take-screenshots.md` file to verify it is well-formed.
2. Count the total number of screens indexed.
3. Print a summary to the user:
   - Project type detected
   - Number of screens/routes discovered (broken down by group)
   - Authentication method detected
   - Screenshot method that will be used
   - How to run it: "Run `/take-screenshots` to capture all screenshots"

## Rules

- **Do not run the application or take screenshots yourself.** This command only GENERATES the skill that will do that later when invoked.
- **Hardcode everything** into the generated skill. The generated skill should not need to re-discover routes, auth, or startup procedures. It should be a concrete, step-by-step playbook.
- **Be thorough in route discovery.** Check router configs, file-system routing, navigation components, sidebar menus, and any route constants/enums. If unsure whether something is a route, include it.
- **Handle monorepos.** If the project has multiple apps (e.g. `apps/web`, `apps/admin`, `packages/cli`), generate sections for each app in a single skill file, or note which app to target.
- **Respect `.gitignore`.** Don't index routes from `node_modules`, `dist`, `build`, or other generated directories.
- **For TUI/CLI apps**, the generated skill MUST produce a shell script that uses `xdotool` + `import`/`spectacle` to automate screenshots. Claude Code cannot interact with full-screen TUI apps directly. Document the exact keystrokes as `xdotool key` calls in the script. If the app uses vim-like bindings, arrow keys, tab switching, or command palettes, spell them out as xdotool commands.
- **If route discovery is ambiguous** (e.g. dynamic routes with no obvious test data), include them with a note about what parameter is needed and instruct the skill to attempt finding or creating test data at runtime.
- **For the screenshot output folder**, use `screenshots/` at the project root. Add `screenshots/` to `.gitignore` if it's not already there.
- **The generated skill should be self-contained.** Someone invoking `/take-screenshots` should not need any prior knowledge of the project.
- If `$ARGUMENTS` provides hints, use them to resolve ambiguities but still verify by reading the code.
