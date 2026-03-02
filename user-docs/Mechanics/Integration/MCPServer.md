# MCP Server

## Definition

The MCP (Model Context Protocol) server for VibeCraft is provided by the `vibecraft-mcp` stdio CLI. The app itself runs a local MCP bridge (HTTP JSON-RPC) when a workspace is open, and the CLI uses the bridge to execute commands inside the running workspace.

## Purpose

The MCP server enables:

- **AI-driven workspace orchestration**: External AI agents (like Claude, ChatGPT, or custom tools) can spawn agents, create folders, and organize your workspace programmatically
- **Self-organizing agents**: Agents spawned within VibeCraft can control the workspace, spawn sibling agents, and coordinate work autonomously
- **Automation**: Script complex workspace setups or repetitive tasks
- **Integration**: Connect VibeCraft with other tools in your development workflow
- **Remote control**: Control VibeCraft from external applications or command-line tools

## User Behavior

### Automatic Lifecycle

- **Auto-start**: Opening a workspace starts the local MCP bridge and writes `.vibecraft[-dev]/mcp.json`
- **Auto-stop**: Closing a workspace stops the bridge and removes the info file
- **Client-managed**: Your MCP client launches `vibecraft-mcp` on demand (stdio transport)
- **Invisible operation**: The bridge runs in the background; there is no UI indicator unless you explicitly check logs

### Server State

- **Single active bridge**: Opening a workspace starts the local bridge for that workspace; opening another workspace replaces it
- **Workspace-scoped**: Commands only affect the workspace referenced by the bridge
- **Isolated operation**: The bridge cannot access or modify other workspaces

## How to Use the MCP Server

For Hero-specific orchestration guidance, see [[Mechanics/Integration/HeroMCP]].

### Connecting an AI Agent

The `vibecraft-mcp` CLI speaks MCP over stdio and proxies requests to the local bridge. To connect an AI agent:

1. **Open a workspace** in VibeCraft (the bridge starts automatically)
2. **Configure your AI tool** to launch `vibecraft-mcp`
3. **The AI agent discovers commands** by calling the `vibecraft.commands` tool
4. **Execute commands** via the `vibecraft.command` or `vibecraft.batch` tools

### Example: Claude Desktop Integration

If using Claude Desktop or Claude Code CLI with MCP support:

```json
{
  "mcpServers": {
    "vibecraft": {
      "command": "node",
      "args": [
        "/path/to/vibecraft/scripts/vibecraft-mcp.mjs",
        "--workspace",
        "/path/to/workspace",
        "--storage",
        "dev"
      ]
    }
  }
}
```

If `vibecraft-mcp` is on your PATH, you can set `"command": "vibecraft-mcp"` and keep the same arguments.

If the workspace is using dev storage (`.vibecraft-dev`), keep `--storage dev` (or set `VIBECRAFT_STORAGE_NAMESPACE=dev`). For prod storage, use `--storage prod` or omit the flag to auto-discover based on existing `mcp.json`.

### Example: Custom Integration

For custom tools or scripts, send JSON-RPC requests to the stdio server:

```bash
# Discover available commands
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vibecraft.commands","arguments":{}}}' \
  | node /path/to/vibecraft/scripts/vibecraft-mcp.mjs --workspace /path/to/workspace --storage dev

# Create a Claude agent at position (100, 200)
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"vibecraft.command","arguments":{"command":{"id":"create-agent-claude","args":{"x":100,"y":200}}}}}' \
  | node /path/to/vibecraft/scripts/vibecraft-mcp.mjs --workspace /path/to/workspace --storage dev

# Get workspace layout
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"vibecraft.layout","arguments":{}}}' \
  | node /path/to/vibecraft/scripts/vibecraft-mcp.mjs --workspace /path/to/workspace --storage dev
```

### Agents Inside VibeCraft

**Key Use Case**: Agents spawned within VibeCraft can control their own workspace using the MCP server. This creates a powerful self-organizing system where agents can spawn other agents, create folders, and orchestrate the workspace from within.

#### Configuring Claude Agents with VibeCraft MCP

When you spawn a Claude agent in VibeCraft, you can configure it to have access to the VibeCraft MCP tool by adding MCP server configuration to Claude's settings.

**Step 1: Locate Claude's MCP Configuration**

Claude Code CLI uses MCP configuration from:

- **Global**: `~/.config/claude/mcp.json` (Linux/macOS) or `%APPDATA%\claude\mcp.json` (Windows)
- **Project-specific**: `.claude/mcp.json` in the project folder

**Step 2: Add VibeCraft MCP Server Configuration**

Create or edit the MCP configuration file:

```json
{
  "mcpServers": {
    "vibecraft": {
      "command": "node",
      "args": ["/path/to/vibecraft/scripts/vibecraft-mcp.mjs"],
      "env": {
        "VIBECRAFT_WORKSPACE": "${workspaceFolder}"
      }
    }
  }
}
```

**Step 3: Verify Agent Has Access**

Once an agent is attached to a folder and its terminal is open:

1. The agent can see the `vibecraft` MCP tool in its available tools
2. Ask the agent to list its tools: "What MCP tools do you have access to?"
3. The agent should report having access to `vibecraft.command`, `vibecraft.commands`, `vibecraft.layout`, and `vibecraft.batch`

#### What Agents Can Do From Inside VibeCraft

Agents running in VibeCraft terminals can:

1. **Spawn sibling agents**: Create additional Claude or Codex agents to parallelize work
2. **Organize workspace**: Create folders for different parts of the project
3. **Auto-attach**: Attach newly spawned agents to specific folders
4. **Create infrastructure**: Set up browser panels for dev servers, terminals at specific paths
5. **Coordinate work**: Query workspace state to see what other agents are doing
6. **Self-manage**: Move themselves, open their own terminals, create worktrees

#### Example Agent Workflow

```
User: "Set up a full-stack development environment"

Agent (using vibecraft MCP tool):
1. Calls vibecraft.layout to understand current workspace state
2. Creates two folders: "backend" and "frontend"
3. Spawns two new Claude agents
4. Attaches first agent to backend folder
5. Attaches second agent to frontend folder
6. Opens terminals for both agents
7. Creates a browser panel for the frontend preview
8. Creates a terminal panel at the project root for git operations

Result: Fully orchestrated development environment created programmatically
```

#### Example Agent Commands

From within a Claude agent's terminal in VibeCraft:

```
"Create a new folder called 'tests' at coordinates 400, 300"
→ Agent uses vibecraft.command with create-folder

"Spawn another Claude agent and attach it to the backend folder"
→ Agent uses vibecraft.batch to create-agent-claude and attach-folder

"Show me all the agents currently in the workspace"
→ Agent uses vibecraft.layout and reports the agent list

"Move the hero to position 500, 500"
→ Agent uses vibecraft.command with move-hero

"Create a browser panel showing localhost:3000"
→ Agent uses vibecraft.command with create-browser
```

#### Configuration Tips

**Global Configuration** (All VibeCraft agents have access):
Place MCP config in `~/.config/claude/mcp.json` so every Claude agent spawned in VibeCraft automatically has the vibecraft tool.

**Project-Specific Configuration** (Only agents in specific folders):
Place MCP config in `.claude/mcp.json` within a specific project folder so only agents attached to that folder have access.

**Environment Variables**:
Use `${workspaceFolder}` in the config to dynamically reference the current workspace path.

#### Self-Organizing Patterns

With VibeCraft MCP access, agents can create sophisticated self-organizing patterns:

- **Agent swarms**: An agent spawns helper agents and delegates subtasks
- **Spatial organization**: Agents create and organize folders based on project structure
- **Automatic parallelization**: Agents spawn siblings to work on independent features simultaneously
- **Workspace memory**: Agents query layout to understand prior state and continue work
- **Meta-coordination**: A "coordinator" agent spawns and manages worker agents

## Available Tools

The MCP server exposes four primary tools:

### 1. `vibecraft.commands` - Discover Commands

Returns comprehensive documentation for all 29 available commands, including:

- Command IDs and descriptions
- Required and optional arguments with types
- Examples for each command
- Organization by category (agent, folder, browser, terminal, hero, worktree, generic)

**Usage**: Call this first to learn what commands are available.

### 2. `vibecraft.command` - Execute Single Command

Executes a single workspace command.

**Arguments**:

- `command.id` (required): The command identifier (e.g., `"create-agent-claude"`)
- `command.args` (optional): Object with command-specific arguments
- `command.source` (optional): Defaults to `"mcp"`

**Example**:

```json
{
  "command": {
    "id": "create-folder",
    "args": {
      "name": "my-project",
      "x": 300,
      "y": 200
    }
  }
}
```

### 3. `vibecraft.layout` - Get Workspace State

Returns the current state of the workspace, including:

- Hero position
- All agents (position, status, attached folder)
- All folders (position, name, path)
- All browsers (position, size, URL)
- All terminals (position, associated agent)

**Usage**: Call this to understand the current workspace state before issuing commands.

### 4. `vibecraft.batch` - Execute Multiple Commands

Executes multiple commands in sequence, atomically.

**Arguments**:

- `commands`: Array of command objects (each with `id` and optional `args`)

**Example**:

```json
{
  "commands": [
    { "id": "create-agent-claude", "args": { "x": 100, "y": 100 } },
    { "id": "create-folder", "args": { "name": "backend", "x": 300, "y": 100 } },
    { "id": "attach-folder", "args": { "agentId": "...", "folderId": "..." } }
  ]
}
```

## Command Categories

### Agent Commands (8)

Create, move, attach, and manage AI agents:

- `create-agent-claude` - Spawn a Claude agent
- `create-agent-codex` - Spawn a ChatGPT Codex agent
- `move-agent` - Move an agent to new coordinates
- `attach-folder` - Attach an agent to a project folder
- `detach-agent` - Detach agent from folder
- `open-agent-terminal` - Open agent's terminal panel
- `clear-history` - Clear agent terminal history
- `destroy-agent` - Remove an agent from workspace

### Folder Commands (5)

Manage project folders:

- `create-folder` - Create a new project folder
- `move-folder` - Move a folder to new position
- `rename-folder` - Rename a folder
- `remove-folder` - Unlink folder from workspace (doesn't delete files)
- `delete-folder` - Delete folder and move to system trash

### Browser Commands (6)

Control browser panels:

- `create-browser` - Create a browser panel
- `move-browser` - Move browser to new position
- `resize-browser` - Resize browser panel
- `refresh-browser` - Refresh browser page
- `delete-browser` - Close browser panel

### Terminal Commands (4)

Manage terminal panels:

- `create-terminal` - Create a terminal at a path
- `move-terminal` - Move terminal to new position
- `resize-terminal` - Resize terminal panel
- `delete-terminal` - Close terminal panel

### Hero Commands (2)

Control the hero (player character):

- `move-hero` - Move hero to new position
- `move-entity` - Generic move command for any entity type

### Worktree Commands (5)

Git worktree operations:

- `create-worktree` - Create git worktree for a folder
- `worktree-sync` - Sync worktree changes
- `worktree-merge` - Merge worktree to main branch
- `undo-merge` - Undo worktree merge
- `retry-restore` - Retry folder restoration

## Common Use Cases

### Automated Workspace Setup (External Agent)

```javascript
// An external AI agent sets up a development workspace:
1. Create a folder for backend code
2. Create a folder for frontend code
3. Spawn two Claude agents
4. Attach one agent to backend folder
5. Attach another agent to frontend folder
6. Open terminals for both agents
7. Create a browser panel for previewing the app
```

### Self-Organizing Agent Swarm (Agent Inside VibeCraft)

```javascript
// User asks an agent in VibeCraft: "Build a microservices architecture"
// The agent uses MCP to orchestrate:
1. Query vibecraft.layout to understand current workspace
2. Create folders: "api-gateway", "auth-service", "user-service", "db-service"
3. Spawn 4 new Claude agents (one per service)
4. Attach each agent to its corresponding folder
5. Open terminals for all agents
6. Create browser panels for each service's dev server
7. Create a terminal at project root for docker-compose
8. Give each spawned agent instructions for their service

Result: One agent automatically creates a complete development environment
        with specialized agents working on different microservices
```

### Parallel Development (Agent Inside VibeCraft)

```javascript
// User: "Implement authentication for the app"
// Agent uses MCP to parallelize:
1. Get workspace layout via vibecraft.layout
2. Create folders: "backend-auth", "frontend-auth", "auth-tests"
3. Spawn 3 Claude agents
4. Attach agents to respective folders
5. Each agent works independently on its piece
6. Original agent coordinates via chat and monitors progress

Result: Authentication feature built in parallel by coordinated agents
```

### Testing & Debugging (External or Internal Agent)

```javascript
// Set up test environments programmatically:
1. Create test folders with specific configurations
2. Spawn agents with particular settings
3. Create terminals at specific paths for running tests
4. Create browser panels for test runners and coverage reports
5. Create worktrees for testing experimental changes
```

### Dynamic Resource Allocation (Agent Inside VibeCraft)

```javascript
// Agent detects heavy workload and spawns helpers:
1. Agent analyzes task complexity
2. Uses vibecraft.layout to see available space
3. Spawns additional agents based on workload
4. Creates folders for parallel work streams
5. Distributes work among spawned agents
6. Collects results and synthesizes final output

Result: Agents dynamically scale based on task requirements
```

## Discovery Pattern

AI agents should follow this pattern for self-discovery:

1. **Call `vibecraft.commands`** to get all available commands and their schemas
2. **Call `vibecraft.layout`** to understand the current workspace state
3. **Execute commands** based on the metadata and current state
4. **Verify results** by calling `vibecraft.layout` again

This pattern eliminates trial-and-error: the command metadata provides complete documentation, including argument types, requirements, and examples.

## Interactions

### With Manual UI Actions

- **Commands execute immediately**: MCP commands execute in the same way as manual UI actions
- **State synchronization**: Changes made via MCP are immediately visible in the UI
- **Reversible actions**: UI changes (moving entities, renaming folders) affect MCP-created entities equally

### With Entity IDs

- **Optional IDs**: Many commands accept optional entity IDs. When omitted, they operate on the currently selected entity in the UI
- **ID discovery**: Use `vibecraft.layout` to discover entity IDs for precise targeting
- **Stable IDs**: Entity IDs remain stable until the entity is destroyed

### Error Handling

- **Validation**: Commands validate arguments before execution
- **Clear errors**: Invalid commands return descriptive error messages
- **Partial failures**: In batch operations, each command's success/failure is reported individually

## Invariants

- **One MCP server per open workspace**: Only the active workspace has a running MCP server
- **Commands execute in renderer context**: MCP commands are processed by the same logic as UI actions
- **No persistence without workspace**: Commands cannot persist state if the workspace is closed
- **Workspace-scoped**: Commands cannot affect other workspaces or global application state

## Acceptance Criteria

- Opening a workspace automatically starts the MCP bridge and writes `.vibecraft[-dev]/mcp.json`
- Closing a workspace stops the bridge and removes the info file
- Calling `vibecraft.commands` returns documentation for all 29 commands
- Calling `vibecraft.layout` returns the current state of all entities in the workspace
- Executing `vibecraft.command` with valid arguments creates/modifies entities visibly in the UI
- Executing `vibecraft.batch` with multiple commands applies all commands in sequence
- Invalid command IDs or arguments return clear error messages via JSON-RPC error responses
- Commands operate on the currently open workspace and cannot affect other workspaces
- Agents spawned in VibeCraft with MCP configuration can access vibecraft tools
- An agent inside VibeCraft can spawn another agent via `create-agent-claude` or `create-agent-codex`
- An agent inside VibeCraft can create folders, attach agents, and query layout
- Changes made by agents via MCP are immediately visible in the UI
- Multiple agents can use MCP simultaneously without conflicts

## Troubleshooting

### Server Not Responding

- **Check workspace is open**: The bridge only runs when a workspace is active
- **Verify JSON-RPC format**: Ensure requests follow JSON-RPC 2.0 specification
- **Check stdio connection**: `vibecraft-mcp` communicates via stdin/stdout

### Commands Failing

- **Call `vibecraft.commands` first**: Verify you're using correct command IDs and argument names
- **Call `vibecraft.layout`**: Check current state before issuing commands
- **Check entity IDs**: Ensure entity IDs exist and are spelled correctly
- **Review error messages**: Error responses include detailed context about what went wrong

### Workspace State Mismatch

- **Refresh layout**: Call `vibecraft.layout` to get the latest workspace state
- **Check for manual changes**: Remember that UI actions also modify workspace state
- **Verify workspace path**: Ensure you're connected to the correct workspace

### Agents Inside VibeCraft Not Seeing MCP Tool

- **Check MCP configuration**: Verify that `mcp.json` exists in `~/.config/claude/` or in `.claude/` within the project folder
- **Restart agent**: Detach and re-attach the agent to reload MCP configuration
- **Verify file format**: Ensure `mcp.json` is valid JSON
- **Check logs**: Look for MCP initialization errors in the agent's terminal
- **Test with direct question**: Ask the agent "What tools do you have?" to see if it lists vibecraft tools

### Spawned Agents Not Appearing

- **Check coordinates**: Ensure x and y coordinates are within visible workspace bounds
- **Query layout**: Use `vibecraft.layout` to verify the agent was created and get its actual position
- **Check for errors**: Review the response from `create-agent-claude` or `create-agent-codex` for error messages
- **Pan viewport**: The agent may have spawned outside the current view; pan the canvas to find it

### Agent Can't Attach to Folder

- **Verify folder exists**: Use `vibecraft.layout` to confirm the folder ID is correct
- **Check agent status**: Ensure the agent is not already attached to another folder
- **Use correct IDs**: Double-check that both `agentId` and `folderId` match existing entities
- **Review permissions**: Ensure the folder path is accessible

## Technical Notes

### Protocol

- **Transport**: MCP over stdin/stdout via `vibecraft-mcp`
- **Bridge**: The CLI proxies to the local HTTP bridge started by VibeCraft
- **Message format**: Standard JSON-RPC request/response
- **No authentication**: The bridge assumes localhost trust (runs in your local environment)

### Performance

- **Command execution**: Commands execute synchronously; wait for response before issuing next command
- **Batch optimization**: Use `vibecraft.batch` for multiple related commands to reduce round-trips
- **Layout queries**: Layout data is computed on-demand; avoid excessive polling

### Limitations

- **Single workspace**: Only one workspace can have an active bridge at a time
- **UI dependency**: Commands require the VibeCraft UI to be running
- **No remote access**: The bridge is local-only; it cannot be accessed over the network
