# Hero MCP Orchestration

## Definition

The Hero is the workspace orchestrator. It should coordinate work through Vibecraft MCP commands, not act as an implementation worker.

## What the Hero Has by Default

When a workspace runs with MCP skills enabled, the Hero automatically includes:

- `vibecraft-core`: core workspace MCP command access
- `vibecraft-docs`: user-facing docs access for `<workspace>/docs`

This means the Hero can use:

- `vibecraft.layout` to inspect workspace state
- `vibecraft.commands` (or `vibecraft://commands`) to inspect command schemas
- `vibecraft.command` / `vibecraft.batch` to execute workspace operations
- `vibecraft.docs.search` and `vibecraft://docs/*` resources for documentation lookup

## Recommended Hero Workflow

1. Set Hero provider and model in the Hero details panel.
2. Give the Hero a concrete orchestration objective.
3. Ask it to inspect layout first, then create folders/agents/terminals/browsers.
4. Ask it to attach each spawned agent to the correct folder.
5. Ask it to monitor progress and reassign work by sending follow-up prompts.

## Example Prompt

```text
Coordinate this workspace using Vibecraft MCP tools.
Goal: implement the top 3 GitHub issues for repo <repo-url>.

Requirements:
- Create 3 folders (one per issue).
- In each folder: clone/fork repo and create a dedicated branch.
- Spawn one agent per folder and attach it.
- Keep all implementation work delegated to agents.
- Use Vibecraft docs search when needed.
- Report progress per agent and folder.
```

## Practical Notes

- The Hero can create as many agents as needed.
- The Hero is expected to operate only through available Vibecraft commands/tools.
- If `<workspace>/docs` does not exist, docs search/resources will return no documentation matches.

## Troubleshooting

- Hero does not appear to use MCP tools:
  - Confirm provider is installed and logged in.
  - Confirm `@agentconnect/host` is up to date in Vibecraft.
  - Restart the Hero run and ask it to call `vibecraft.layout` first.
- Hero starts doing implementation directly:
  - Add an explicit instruction: "Do not implement directly. Spawn and manage agents only."
- Docs queries return no results:
  - Confirm docs are in `vibecraft/user-docs/`.
  - Ask for a narrower query string.
