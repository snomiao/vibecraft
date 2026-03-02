# Testing in VibeCraft

This document covers the testing framework, how it is wired, and how to extend it safely.

## Goals

- Validate main-process logic, renderer UI, and full Electron flows
- Keep runs deterministic and fast
- Avoid touching real user data or workspaces

## Testing Philosophy: Game-Driven Approach

VibeCraft uses a game-driven testing approach that prioritizes protecting core gameplay rules, input behavior, and persistent state while avoiding tests for purely visual polish.

### What Must Be Tested

**1. Core Gameplay Contracts** — If this breaks, the experience collapses.

- Selection rules (drag box logic, priority, additive selection)
- Movement rules (formation, right-click move, drag behavior)
- Interaction rules (click targeting order, entity hit rules)
- Persistence rules (positions, attachments, z-order)

**2. State Persistence and Sync** — Games require consistent world state across frames, reloads, and systems.

- Drag end persistence for every affected unit
- Attach/detach side effects
- Data that must survive reload or refresh
- Any command that writes state

**3. Priority and Resolution Systems** — Whenever multiple entities compete for a result, test the ordering.

- Hero vs agent vs building hit priority
- Closest-to-drag-start selection for non-agents
- Z-order tie breaks when center points overlap

**4. Input Rules and Platform Modifiers** — Input defines the feel. Test logic even if you do not test the feel.

- Modifier key behavior (Cmd vs Ctrl)
- Drag thresholds
- Right-click and middle-click flows
- Platform-specific rules

**5. System Coupling** — Where one system mutates another, add coverage to prevent silent regressions.

- Selection changes HUD/action bar
- Dragging changes magnetism and persistence
- Focus changes z-order

### What to Skip

**Presentation** — Do not spend time testing pure visuals unless it represents a rule.

- Colors, gradients, animations
- Styling and layout polish
- Non-critical visual effects

### Quick Decision Checklist

Add a test if **two or more** are true:

- [ ] A player would notice if this broke
- [ ] It corrupts or desyncs state
- [ ] It is a priority/rule system
- [ ] It is hard to spot manually each time

### Regression Surface

If a bug affected gameplay or persistence, add a test with the fix.

## Tooling

- **Bun** for scripts and dependency management
- **Vitest** for unit tests
- **Testing Library** + **JSDOM** for renderer tests
- **Playwright** (Electron) for end-to-end tests

## Layout

```
tests/
  unit/
    main/                 # Main process unit tests
    renderer/             # Renderer unit tests
    setup-main.ts         # Enables test mode for main tests
    setup-renderer.ts     # JSDOM + electronAPI stub
  e2e/
    smoke.spec.ts         # Core UI flow smoke test
    utils.ts              # Electron launch + temp paths + cleanup
    playwright.config.ts  # E2E config (timeouts, reporter, output dir)
  mcp/
    mcp.spec.ts           # MCP JSON-RPC smoke test
    playwright.config.ts  # MCP config (timeouts, reporter, output dir)
vitest.main.config.ts
vitest.renderer.config.ts
scripts/run-e2e.mjs        # Builds to temp dir, runs Playwright, cleans up
scripts/run-mcp-test.mjs   # Builds to temp dir, runs MCP test, cleans up
```

## Running Tests

From `vibecraft/`:

```bash
bun run test:unit
bun run test:e2e
bun run test:mcp
bun run test
```

`bun run test` now runs unit + e2e + perf locally, and automatically skips perf when `CI` is enabled.

Install Playwright browsers if needed:

```bash
bunx playwright install
```

### Focused Unit Runs

```bash
bunx vitest --config vitest.main.config.ts
bunx vitest --config vitest.renderer.config.ts
```

Add `--watch` or a specific test file to target a subset.

## Unit Tests

### Main Process

- **Location**: `tests/unit/main`
- **Environment**: Node (no DOM)
- **Setup**: `tests/unit/setup-main.ts` turns on test mode
- **Guidance**:
  - Prefer pure logic tests
  - Use temp directories for filesystem interaction
  - Keep tests independent of local user data

### Renderer

- **Location**: `tests/unit/renderer`
- **Environment**: JSDOM
- **Setup**: `tests/unit/setup-renderer.ts` provides `window.electronAPI`
- **Guidance**:
  - Prefer `getByRole`/`getByLabelText` for accessibility-focused queries
  - Use `data-testid` only when there is no reliable semantic selector

## End-to-End Tests (Electron)

### What E2E Covers

- UI flows: world selection, workspace entry, entities, abilities, and terminal panel
- Agent runners are stubbed to keep runs deterministic

### How Isolation Works

E2E tests run in test mode and never touch your real data:

- **Temp user data**: `VIBECRAFT_TEST_USER_DATA`
- **Temp workspace root**: `VIBECRAFT_TEST_WORKSPACE_PATH`
- **Git enabled**: runs inside the temp workspace; set `VIBECRAFT_TEST_DISABLE_GIT=1` to disable
- **Build isolation**: `scripts/run-e2e.mjs` builds into `.e2e-dist-*` and removes it
- **Playwright artifacts**: stored in a temp OS directory and cleaned up on exit

Always use `launchTestApp()` (or `launchTestAppWithMockServer()` when exercising licensing flows) from
`tests/e2e/utils.ts` so cleanup is guaranteed.

### Debugging E2E

```bash
VIBECRAFT_E2E_DEBUG=1 bun run test:e2e
```

This prints Electron process logs and Playwright output to help diagnose failures.

To open the Electron window in the foreground while running E2E:

```bash
bun run test:e2e -- --show
```

To run the live provider registry integration suite:

```bash
bun run test:e2e:integration
```

### Subscription Flow Suites

- `tests/e2e/subscription-flow.spec.ts` is the smoke suite (mock license server, fast).
- `tests/e2e/manual/subscription-flow.manual.ts` holds deeper coverage that is run manually.

Run the manual suite explicitly:

```bash
bun run test:e2e -- tests/e2e/manual/subscription-flow.manual.ts
```

## MCP Integration Test

`test:mcp` boots the Electron app in test mode, starts the MCP server, and validates core JSON-RPC endpoints (`initialize`, `tools/list`, `resources/read`, `tools/call`). The test uses temp workspace/user data isolation and verifies the MCP info file is cleaned up when the server stops.

## Test Mode & Stubs

Test mode is controlled by `src/testing/testMode.ts` and affects behavior across the app:

- **Terminal sessions** use a stub (`src/testing/terminalsStub.ts`) to avoid native PTY dependency
- **Workspace selection** is seeded in the test harness by writing `workspaces.json` into the test user data directory
- **Renderer** can detect test mode via `window.electronAPI.isTestMode`

## Configuration Overrides

Settings and environment overrides commonly used for tests and local verification:

- **App settings**: `settings.json` under the app user data directory
- **Disable Git integration**: set `disableGit: true` in `settings.json` or export `VIBECRAFT_DISABLE_GIT=1`
- **Default reasoning effort**: set `defaultReasoningEffortByProvider` in `settings.json` to control the per-provider default for newly created agents (for example `{ "codex": "medium" }`)
- **Dev storage**: set `VIBECRAFT_STORAGE_NAMESPACE=dev` to force dev storage or `VIBECRAFT_STORAGE_NAMESPACE=prod` to force production storage (the `bun run dev` script sets `dev` by default)
- **Workspace storage**: dev storage uses `.vibecraft-dev` (prod uses `.vibecraft`); set `VIBECRAFT_STORAGE_NAMESPACE=prod` to force production storage
- **License checks (dev)**: set `VIBECRAFT_LICENSE_CHECK=1` to enable license enforcement; pair with `VIBECRAFT_LICENSE_API_URL`, `VIBECRAFT_PRICING_URL`, and `VIBECRAFT_LICENSE_PUBLIC_KEY`
- **Test mode controls**:
  - `VIBECRAFT_TEST_MODE=1` enables test-only behaviors (set by the test harness)
  - `VIBECRAFT_TEST_USER_DATA` overrides Electron `userData` path
  - `VIBECRAFT_TEST_WORKSPACE_PATH` overrides the workspace root used by the tests
  - `VIBECRAFT_TEST_DISABLE_GIT=1` disables git probing/init in tests (default is enabled)
  - `VIBECRAFT_TEST_SHOW_WINDOW=1` shows the Electron window in test mode (use `bun run test:e2e -- --show`)
  - `VIBECRAFT_TEST_INTEGRATION=1` enables live provider registry for E2E integration runs (use `bun run test:e2e:integration`)

## Dev Runtime Flags

Environment flags that are useful when running the app locally in dev:

- **Hero selection override (dev only)**: `VITE_DEV_HERO_PROVIDER=unset` forces the hero selection flow (ignores saved hero provider). Use `VITE_DEV_HERO_PROVIDER=claude|codex|cursor` to hard-set a provider in dev.
- **React Strict Mode (dev only)**: `VITE_STRICT_MODE=1` enables React Strict Mode in dev (off by default).
- **Storage namespace**: `VIBECRAFT_STORAGE_NAMESPACE=dev|prod` controls which on-disk storage namespace is used (`bun run dev` sets `dev` automatically).
- **Disable Git**: `VIBECRAFT_DISABLE_GIT=1` disables git integration regardless of settings.
- **Profile logging**: `VIBECRAFT_PROFILE=1` enables `[profile]` timing logs (and exposes `window.electronAPI.isProfileMode` in the renderer).
- **Workspace perf overlay**: press `F3` in workspace to toggle live FPS/frame/render diagnostics. It defaults on in dev mode and with `VIBECRAFT_PROFILE=1` unless a prior toggle is stored in local storage.
- **Terminal tracing**: `VIBES_TRACE_TERMINAL=1` enables verbose terminal session tracing in logs.
- **Log levels**: `VIBES_LOG_LEVEL=info|debug|verbose|silly` (console) and `VIBES_LOG_FILE_LEVEL=info|debug|verbose|silly` (file).
- **Home background**: `VITE_HOME_BG=/absolute/or/relative/path.png` overrides the home screen background image.
- **Licensing backend URL**: `VIBECRAFT_LICENSE_API_URL=https://license.example.com` sets the base URL for device licensing (defaults to `http://localhost:8787` in dev).
- **Pricing page URL**: `VIBECRAFT_PRICING_URL=https://vibecraft.dev/checkout` sets the checkout page URL opened by the app (defaults to `http://localhost:5173/checkout` in dev).
- **License debug state**: `VIBECRAFT_LICENSE_DEBUG=trial|expired|subscribed` simulates different license states for UI testing. The device still registers with the backend (so checkout works), but the UI displays the specified state. Useful for testing the license gate, trial banner, and subscription flows without needing a real subscription.
- **Tutorial reset**: `VIBECRAFT_TUTORIAL_RESET=1` resets the tutorial state on app launch and creates a temporary sandbox workspace for the tutorial. The sandbox is cleaned up when the app exits. Useful for testing the full onboarding flow from scratch.

## Performance Benchmarks

- `bun run test:perf` runs microbenchmarks for workspace hot paths (`resolveDragSelection`, minimap bounds/projection math).
- `bun run test:perf` also includes a high-entity panning stress benchmark (`MinimapOverlay panning updates`) with large agent/browser/terminal counts.
- `bun run test:perf:runtime` runs a real Electron panning stress capture (heavy agent/folder/browser/terminal seed) via Playwright and writes a JSON report to `history/perf/` (override output with `--out <path>`).
- `bun run perf:loop -- --iterations 5` runs the benchmark suite repeatedly and writes JSON snapshots into `history/perf/`. Add `--runtime` to include the runtime panning capture in every loop iteration.
- During runtime, workspace auto-switches to a reduced-effects tier when sustained low FPS is detected and restores normal effects after recovery; the active tier is shown in the perf overlay.
- Runtime diagnostics are also exposed as `window.__vibecraftPerformance.getSnapshot()` (workspace path, FPS/frame stats, render stats, effect tier, entity counts) for automation agents or Playwright-driven perf loops.

## Writing E2E Tests

Use stable selectors:

- Ability buttons and dialogs: `data-testid` (for example `world-ability-create-folder`, `dialog-input`)
- Entities: `entity-*` (for example `entity-agent`, `entity-folder`, `entity-browser`)
- Canvas: `workspace-canvas`

Keep flows short, assert visible UI state, and avoid external network calls.

## UI Testability Standard

When adding or changing UI components, follow these rules so tests stay reliable:

- Prefer semantic elements and accessible labels (`button`, `role`, `aria-label`, `aria-labelledby`). Tests should use `getByRole` where possible.
- Use `data-testid` only when semantics are ambiguous or repeated. Treat the ID as a public, stable API.
- Naming: `kebab-case`, scoped by screen or feature. Examples: `world-ability-create-folder`, `dialog-confirm`, `agent-terminal`.
- For collections, add stable `data-*` attributes to disambiguate items (for example `data-workspace-id`, `data-entity-id`).
- Ensure dialogs expose input/confirm/cancel targets consistently; use the existing `dialog-*` and `folder-select-*` patterns.
- Avoid test selectors that depend on styling, layout, or user-generated text.

## Fixtures

When you need canned payloads for tests, create a `tests/fixtures/` directory and load data from there rather than embedding large JSON in spec files.

## Troubleshooting

- **Electron window never opens**: verify the build succeeds and `VIBECRAFT_DIST_DIR` is set by `scripts/run-e2e.mjs`
- **Playwright cannot find browsers**: run `bunx playwright install`
- **Unexpected file writes**: ensure test mode is enabled and the test uses `launchTestApp()`
