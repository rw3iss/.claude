# Generate a new test suite

Create a new integration or E2E test for the current project's backend, ie. "api" or "api-server", or the frontend if requested, following the established test framework conventions, and register it in the test index and documentation.

## Arguments

- `$ARGUMENTS` — a description of what the test should cover. Can be a feature name, endpoint, workflow, or scenario (e.g. "test the order generation flow after auction close", "test consignment product creation and fulfillment").

## Steps

1. **Read the test framework docs** — Read `tests/README.md` to understand conventions, patterns, and available helpers. Then read `tests/framework/TestContext.ts`, `tests/framework/factories.ts`, `tests/framework/api.ts`, and `tests/framework/assertions.ts` to understand what utilities already exist.
Look for the @vendidit/test-tools test-tools library integration, if it exists in the project, (e.g. in a package.json: "@vendidit/test-tools": "github:Vendidit/tools#path:packages/test-tools"), and make a new test in the configured test-tools testtools.config.json testsDir folder, if it exists, or the tests/specs folder there, or otherwise in whatever tests specs folder there is, in the logical location that test should belong.

2. **Survey existing tests** — Run `npx test-tools --list --subtests`, or `yarn test:list` (or `npx ts-node tests/list-tests.ts`) to see all current suites and avoid duplicating coverage. Read 1-2 existing suites in `tests/specs/suites/` or `tests/suites` to match the established style.

3. **Determine the test category and filename** — Based on the description:
   - **Smoke/Quick** (`00-09`): Fast endpoint checks, no waiting. Use for basic CRUD or auth verification.
   - **Integration** (`10-49`): Multi-step flows that don't require real-time waiting. Auction types, product configs, validation.
   - **E2E** (`50-99`): Full lifecycle tests that may wait for auctions to close, trigger webhooks, verify winners/orders.

   Pick the next available number in the appropriate range. Name the file `tests/suites/NN-descriptive-name.spec.ts`.

4. **Identify needed API helpers** — Check if `tests/framework/api.ts` has the endpoints the test needs. If not, add new helpers following the existing pattern (domain-grouped objects with typed methods).

5. **Identify needed factories** — Check if `tests/framework/factories.ts` has the builders the test needs. If a new composite factory would be useful (e.g. `createAuctionWithConsignment`), add it following the pattern of `createLiveAuction`. Ensure new factories call `ctx.recordEntity()` for summary report integration.

6. **Write the test suite** — Create the spec file following this template:

   ```typescript
   const configuration = 'development';
   require('dotenv').config({ path: `.env.${configuration}`, override: true });

   import { HttpStatus } from '@nestjs/common';
   import moment from 'moment';
   import { TestContext, DEFAULT_TIMEOUT } from '../framework/TestContext';
   import { installStepReporter } from '../framework/jestStepReporter';
   // ... other imports from framework/api, framework/factories, framework/assertions

   describe('[Category] Suite description', () => {
       const ctx = new TestContext();

       beforeAll(async () => {
           await ctx.setup({ suiteName: 'Human-Readable Name' });
       }, DEFAULT_TIMEOUT);

       installStepReporter(ctx);

       afterAll(async () => {
           await ctx.teardown();
       }, DEFAULT_TIMEOUT);

       // Tests here...
   });
   ```

   Key conventions:
   - Use `ctx.setup({ suiteName: '...' })` so the summary report has a readable name.
   - Call `installStepReporter(ctx)` at the top of the describe block.
   - Use factories from `framework/factories.ts` — they auto-track cleanup and auto-record entities for reports.
   - Use assertions from `framework/assertions.ts` where applicable.
   - For any entities created outside factories, call `ctx.recordEntity()` and `ctx.trackAuction()`/`ctx.trackCategory()` manually.
   - Wrap each `it()` with `DEFAULT_TIMEOUT` as the third argument.
   - For E2E tests that wait, use `waitUntilAfter()` from factories.

7. **Update the sequencer** — Add the new filename to the `order` array in `config/tests/custom-sequencer.js`, in the correct position by number.

8. **Update the test index** — Open `tests/list-tests.ts` and add a categorization entry for the new file in the `categorize()` function, following the existing pattern with appropriate category, description, and estimated duration.

9. **Verify the test runs** — Run the new test:
   ```bash
   NODE_ENV=development npx jest tests/suites/NN-new-test.spec.ts --verbose --forceExit
   ```
   Fix any failures. Then run the smoke test to confirm nothing is broken:
   ```bash
   yarn test:smoke
   ```

10. **Run with summary** — Verify the report integration works:
    ```bash
    NODE_ENV=development TEST_SUMMARIZE=true npx jest tests/suites/NN-new-test.spec.ts --verbose --forceExit
    ```
    Confirm a report is generated in `tests/results/` and entities appear in the tree.

11. **Update the README** — Add the new suite to the execution order list in `tests/README.md` and mention it in the test structure tree if it covers a new domain.

## Rules

- Follow the existing test framework patterns exactly. Do not introduce new test utilities or helpers outside of `tests/framework/`.
- All entities created in tests must be tracked for cleanup (via factories or manual `ctx.track*()` calls).
- All entities must be recorded for summary reports (via factories or manual `ctx.recordEntity()` calls).
- Use `DEFAULT_TIMEOUT` on all async tests — the NestJS app boot is slow.
- Do not modify existing test suites unless the new test requires a shared factory that benefits them too.
- Do not add npm dependencies. The framework uses Jest, supertest, and moment — all already installed.
- If the test requires API endpoints that don't exist in `framework/api.ts`, add them there rather than making raw supertest calls in the spec file.
