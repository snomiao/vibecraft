# Analytics (PostHog Spec)

## Objectives

- Measure session depth: how long users actively engage with the desktop app per visit.
- Detect attention shifts away (window blur / alt-tab) to understand friction and focus loss.
- Provide a minimal event layer that is easy to trust, audit, and extend as we add features.

## Scope

- Reuse the MCP Agent MVP event taxonomy and property names unchanged.
- Apply the same lifecycle + attention model to the Vibe Craft renderer.
- Include install-level and app-start events from the main process.
- Enable optional PostHog screen recordings with masked inputs.

## Privacy stance

- Analytics are anonymous and focused on product usage, not user content.
- Workspace file paths are not collected.
- Screen recordings, if enabled, mask inputs by default.

## Event flow

- Renderer events call `window.electronAPI.captureTelemetryEvent`.
- Main process owns the PostHog client (`posthog-node`) and enriches events with `app_version` and `platform` before shipping.
- The install id stored in user data drives `distinctId` so cohorts align across sessions.
- Renderer-only PostHog (`posthog-js`) is used for session recordings and shares the same `distinctId` via `getTelemetryContext`.

## Configuration

- Main process reads `POSTHOG_API_KEY` and optional `POSTHOG_HOST` (default: `https://app.posthog.com`).
- Renderer bundle reads `VITE_POSTHOG_API_KEY` and optional `VITE_POSTHOG_HOST` for screen recording.
- Telemetry is off if no PostHog key is configured. No UI toggle yet.

## Core events (unchanged from MCP Agent MVP)

| Event              | Trigger                                                            | Key Properties                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `install`          | First run after install-id creation                                | `version`, `platform`                                                                                                                          |
| `app_started`      | Main process telemetry init                                        | `version`, `platform`                                                                                                                          |
| `daily_heartbeat`  | Every 24h while app is running                                     | `version`, `platform`                                                                                                                          |
| `session_started`  | React root mounts and telemetry is enabled                         | `session_id`, `started_at`, `initial_state` (`foreground`/`background`), `screen`, `workspace_id`, `workspace_name`, `app_version`, `platform` |
| `session_paused`   | App leaves the foreground or the user goes idle                    | `session_id`, `reason`, `active_time_ms`, `elapsed_ms`                                                                                         |
| `session_resumed`  | App regains focus or the user returns from idle                    | `session_id`, `reason`, `paused_duration_ms`, `active_time_ms`, `elapsed_ms`                                                                   |
| `focus_change`     | Any foreground/background transition (includes alt-tab detections) | `session_id`, `state` (`foreground`/`background`), `reason`, `active_time_ms`, `elapsed_ms`                                                    |
| `active_heartbeat` | Every 15s while the window is foregrounded and not idle            | `session_id`, `active_time_ms`, `active_time_ms_delta`, `ms_since_last`, `elapsed_ms`, `window_id`, `screen`, `workspace_id`, `workspace_name` |
| `session_ended`    | Window unloads or renderer unmounts                                | `session_id`, `ended_at`, `reason`, `total_time_ms`, `active_time_ms`, `foreground_ratio`, `screen`, `workspace_id`, `workspace_name`          |
| `screen_view`      | High-level navigation changes inside the renderer                  | `session_id`, `screen`, `screen_from`, `workspace_id`, `workspace_name`                                                                        |

### Reasons & states

- `reason` values remain: `window_blur`, `window_focus`, `visibility_hidden`, `visibility_visible`, `beforeunload`, `unmount`, `system_idle`, `system_idle_resume`, `system_suspend`, `system_resume`.
- Foreground/background state is derived from `document.visibilityState` combined with window focus.

## Vibe Craft screen mapping

- `home`
- `world-selection`
- `workspace`
- `tutorial` (overlay during tutorial flow)
- `paywall` (overlay when license gate is active)

## Tutorial events

Track user progression through the first-run tutorial to identify drop-off points and completion rates.

| Event                     | Trigger                                                         | Key Properties                                                                      |
| ------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `tutorial_started`        | Tutorial status transitions from `not_started` to `in_progress` | `session_id`, `step_id`                                                             |
| `tutorial_step_completed` | User completes a tutorial step                                  | `session_id`, `step_id`, `step_index`, `time_on_step_ms`                            |
| `tutorial_abandoned`      | User exits app or navigates away with tutorial incomplete       | `session_id`, `last_step_id`, `last_step_index`, `steps_completed`, `total_time_ms` |
| `tutorial_completed`      | User finishes final tutorial step (`done`)                      | `session_id`, `total_steps`, `total_time_ms`                                        |

If a user abandons before completing any steps, `last_step_id` and `last_step_index` are omitted.

### Tutorial steps

The tutorial consists of 20 ordered steps. Track `step_index` (0-based) alongside `step_id` for easier funnel analysis.

| Index | Step ID              | Description                    |
| ----- | -------------------- | ------------------------------ |
| 0     | `world-select`       | Select the tutorial world      |
| 1     | `hero-provider`      | Choose coding agent provider   |
| 2     | `hero-intro`         | Provider intro                 |
| 3     | `create-project`     | Create first project folder    |
| 4     | `rename-project`     | Rename to "cookie-clicker"     |
| 5     | `create-agent`       | Spawn first agent              |
| 6     | `attach-agent`       | Attach agent to project        |
| 7     | `open-global-chat`   | Open global chat               |
| 8     | `send-prompt`        | Send first prompt              |
| 9     | `open-terminal`      | Open agent terminal            |
| 10    | `close-terminal`     | Close terminal                 |
| 11    | `move-project`       | Move project on canvas         |
| 12    | `create-project-2`   | Create second project          |
| 13    | `rename-project-2`   | Rename second project          |
| 14    | `create-agent-2`     | Spawn second agent             |
| 15    | `attach-agent-2`     | Attach second agent            |
| 16    | `open-global-chat-2` | Open global chat again         |
| 17    | `send-prompt-2`      | Send second prompt             |
| 18    | `open-browser-1`     | Open browser to localhost:3000 |
| 19    | `open-browser-2`     | Open browser to localhost:3001 |
| 20    | `done`               | Tutorial complete              |

### Tutorial derived metrics

- **Tutorial completion rate:** `tutorial_completed` / `tutorial_started`
- **Step drop-off:** For each step, percentage of users who started that step but never completed it
- **Median time per step:** Group by `step_id` and compute median `time_on_step_ms`
- **Friction points:** Steps with above-average drop-off or time-on-step

## Subscription & paywall events

Track user interactions with the license paywall and subscription flow to measure conversion and identify friction.

| Event                        | Trigger                                                                         | Key Properties                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `paywall_shown`              | Paywall overlay becomes visible                                                 | `session_id`, `reason` (`trial_ended`, `device_limit`, `load_error`), `license_status`, `tutorial_completed` |
| `paywall_plan_selected`      | User selects a billing plan                                                     | `session_id`, `plan` (`monthly`, `annual`), `previous_plan`                                                  |
| `paywall_checkout_started`   | User clicks Subscribe button                                                    | `session_id`, `plan`                                                                                         |
| `paywall_checkout_opened`    | Stripe checkout page opens in browser                                           | `session_id`, `plan`                                                                                         |
| `paywall_checkout_completed` | Stripe redirects back with success                                              | `session_id`, `plan`, `subscription_status`                                                                  |
| `paywall_checkout_failed`    | Checkout fails or times out                                                     | `session_id`, `plan`, `error`                                                                                |
| `paywall_dismissed`          | Active subscriber closes the overlay                                            | `session_id`                                                                                                 |
| `paywall_pairing_started`    | User switches to pairing code input                                             | `session_id`                                                                                                 |
| `paywall_pairing_submitted`  | User submits a pairing code                                                     | `session_id`                                                                                                 |
| `paywall_pairing_succeeded`  | Pairing code accepted, device linked                                            | `session_id`                                                                                                 |
| `paywall_pairing_failed`     | Pairing code rejected                                                           | `session_id`, `error`                                                                                        |
| `subscription_activated`     | License transitions to active subscription                                      | `session_id`, `plan`, `via` (`checkout`, `pairing`)                                                          |
| `subscription_observed`      | Active subscription observed without a checkout or pairing flow in this session | `session_id`, `plan`, `subscription_status`                                                                  |
| `subscription_cancelled`     | User cancels subscription (from manage flow)                                    | `session_id`, `plan`, `period_end`                                                                           |

### License states

- `license_status` values: `trial`, `active`, `past_due`, `canceled`, `inactive`
- `reason` for paywall display: `trial_ended`, `device_limit`, `load_error`, `manual_open`

### Subscription derived metrics

- **Paywall-to-checkout rate:** `paywall_checkout_started` / `paywall_shown`
- **Checkout conversion rate:** `paywall_checkout_completed` / `paywall_checkout_started`
- **Overall conversion rate:** `subscription_activated` / `paywall_shown`
- **Pairing adoption:** `paywall_pairing_succeeded` / `paywall_pairing_started`
- **Post-tutorial conversion:** Conversion rate sliced by `tutorial_completed = true`

## Screen recordings

PostHog session recordings capture user interactions for qualitative analysis of friction points.

### Configuration

- Renderer initializes `posthog-js` with the same `distinctId` as the main process telemetry.
- Recordings are enabled via `VITE_POSTHOG_API_KEY` in the renderer bundle.
- Input masking is enabled by default to protect sensitive content.

### Recording scope

- **Tutorial flow:** Capture full session recordings during onboarding to watch where users hesitate, backtrack, or abandon.
- **Paywall interactions:** Record checkout and pairing flows to identify UX friction.
- **Workspace sessions:** Optional recording of general app usage for feature discovery analysis.

### Privacy controls

- All text inputs are masked by default (`maskAllInputs: true`).
- File paths, project names, and code content are not captured in recordings.
- Recordings can be disabled entirely by omitting `VITE_POSTHOG_API_KEY`.
- Production-only by default; dev recordings require explicit opt-in (`VITE_POSTHOG_RECORDING_DEV=1`).

### Session replay filters

Use these filters in PostHog to find relevant recordings:

- `$session_id` matches specific event session IDs for correlated playback.
- Filter by `tutorial_started` or `paywall_shown` events to find onboarding/conversion sessions.
- Filter by `tutorial_abandoned` to watch drop-off behavior.

## Derived metrics

- **North Star:** Median `active_time_ms` per `session_id`. Slice by screen and day-of-week.
- **Foreground ratio:** `active_time_ms / total_time_ms` from `session_ended`.
- **Immediate drop-off:** Share of sessions that end in <30s.
- **Attention leakage:** Count of `focus_change` events with `state=background` per session.

## Implementation notes (Vibe Craft)

- `session_id` is a UUID generated per renderer boot; heartbeats and lifecycle events reuse it.
- Heartbeats stop when the app is backgrounded or the OS reports the user idle for >=60s; deltas (`active_time_ms_delta`) prevent double counting.
- Window suspend/resume from `powerMonitor` should flow to the renderer to prevent sleep inflation.
- Workspace metadata must omit file paths; use the saved workspace id + display name only.
- Analytics should no-op in test mode (`VIBECRAFT_TEST_MODE=1`).

## Quality improvements (same event taxonomy)

- Debounce visibility/blur/focus transitions so a single foreground change emits one pause/resume + one `focus_change`.
- Clamp deltas and ignore negative or huge timing jumps (system clock changes) to protect session depth math.
- Resolve telemetry context before initializing screen recordings; skip recorder entirely when context is unavailable.
- Gate screen recording to production builds unless explicitly enabled (avoid noisy dev data).
- Emit `screen_view` only on meaningful screen changes; avoid duplicate events on no-op state updates.
- Treat window suspend/resume as a hard pause so long sleeps do not inflate `active_time_ms`.

## Integration points

- Main process: initialize PostHog in `vibecraft/src/main/index.ts` (or a new `services/telemetry.ts`) and wire IPC handlers in `vibecraft/src/main/ipc.ts`.
- Preload: expose `captureTelemetryEvent`, `getTelemetryContext`, `getSystemIdleTime`, `getWindowId`, `onPowerSuspend`, `onPowerResume` in `vibecraft/src/preload.ts` and `vibecraft/src/shared/types.ts`.
- Renderer: add analytics helpers under `vibecraft/src/renderer/utils/analytics.ts` and screen recorder at `vibecraft/src/renderer/utils/posthogScreenRecorder.ts`.
- App wiring: call `initRendererAnalytics` on mount; update context when screen/workspace changes; call `shutdownRendererAnalytics` on unmount.

## Validation checklist

1. Launch the app with telemetry enabled and confirm `install` + `app_started` in PostHog live events.
2. Move the window to the background and verify `session_paused` + `focus_change`.
3. Return to the app and confirm `session_resumed` + `active_heartbeat`.
4. Close the window; verify `session_ended` has correct timing deltas.
5. Navigate home -> world selection -> workspace and confirm `screen_view`.
6. Open PostHog recordings; verify masked inputs and shared `distinctId`.
7. Start a fresh tutorial; verify `tutorial_started` fires with `step_id=world-select`.
8. Complete several tutorial steps; verify `tutorial_step_completed` fires for each with correct `step_index` and `time_on_step_ms`.
9. Close the app mid-tutorial; verify `tutorial_abandoned` fires with `last_step_id` and `steps_completed`.
10. Complete the full tutorial; verify `tutorial_completed` fires with `total_steps` and `total_time_ms`.
11. Trigger the paywall (trial expired or device limit); verify `paywall_shown` with correct `reason`.
12. Select a plan and start checkout; verify `paywall_plan_selected` and `paywall_checkout_started`.
13. Complete Stripe checkout; verify `paywall_checkout_completed` and `subscription_activated`.
14. Test pairing flow; verify `paywall_pairing_started`, `paywall_pairing_submitted`, and success/failure events.
