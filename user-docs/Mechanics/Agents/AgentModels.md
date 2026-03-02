# Agent Models + Reasoning Effort

Definition

- Each agent has a model selection and (if supported by its provider) an optional reasoning effort level.

In‑Game Behavior

- The agent terminal header shows a model selector for the active agent.
- If the provider supports reasoning levels, a reasoning selector appears next to the model selector.
- When an agent has no model chosen yet, VibeCraft selects the provider’s recommended default model and persists it to the agent before running.
- Reasoning effort only appears for providers that expose it (currently Codex).

Lifecycle

- Spawn: new agents inherit the current default reasoning effort for their provider (if one exists).
- First run with no model: the app assigns a default model based on provider recommendations and saves it to the agent.
- User change: switching model or reasoning effort updates only that agent’s settings.

Interactions / Edge Cases

- Providers without reasoning support never show a reasoning selector and ignore any reasoning setting.
- Changing the global default reasoning effort does not retroactively update existing agents.
- If a provider adds reasoning support later, the selector appears automatically and any future default applies only to newly created agents.

Visuals / UX

- Model selector always shows the active model (even if it was defaulted).
- Reasoning selector shows human‑readable labels; the default option is labeled “(Default)”.

Invariants

- Model selection is per‑agent and persists across sessions.
- Reasoning effort is per‑agent, with a global per‑provider default that only affects newly created agents.
- No automatic retroactive changes to existing agents’ reasoning settings.

Acceptance Criteria

- Opening the agent terminal shows the current model and (if supported) reasoning level.
- Agents without a model get a provider‑recommended default before running.
- Changing reasoning effort updates only that agent and becomes the default for newly spawned agents of the same provider.
- Existing agents keep their prior reasoning setting unless explicitly changed.
