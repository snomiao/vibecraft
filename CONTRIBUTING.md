# Contributing

Thanks for your interest in improving AgentCraft.

## Before You Start

- Read `AGENTS.md` in the repository root.
- Use Node.js 20 or newer.
- Use `bun` for package management and scripts.
- Track work with `bd` (beads), not markdown TODO lists.

## Development Workflow

1. Check for unblocked work:
   ```bash
   bd ready --json
   ```
2. Claim or create an issue:
   ```bash
   bd update <issue-id> --status in_progress --json
   ```
3. Implement your changes.
4. Run checks from `vibecraft/`:
   ```bash
   bun check
   bun test
   ```
5. Update issue state:
   ```bash
   bd close <issue-id> --reason "Completed" --json
   ```

## Pull Requests

- Keep pull requests focused and small when possible.
- Include the related bead issue IDs.
- Describe behavior changes and test coverage in the PR body.
- If you changed architecture-level behavior, update `vibecraft/CODEBASE.md`.

## Coding Expectations

- Prefer maintainable, readable code over compatibility workarounds.
- Keep file structure clean; refactor when needed.
- Avoid low-contrast text in UI changes.
- Do not use `npm`/`npx` for local commands in this repository.

## Reporting Bugs

- Use GitHub Issues with clear reproduction steps.
- Include platform, Node/Bun versions, and logs when relevant.

## Security Issues

Please do not open public issues for security reports. See `SECURITY.md`.
