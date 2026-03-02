# Context Health System

## Definition

Context Health represents the remaining token capacity in an agent's context window. It provides visual feedback about how much conversation history and context the agent can still process before reaching limits.

## Display

- **Location**: Bottom HUD when a unit is selected.
- **Format**: "Health X/100" where X is the percentage of remaining context.
- **Updates**: Real-time as agents consume tokens.

## Calculation

- Context health is computed as a percentage of remaining tokens in the agent’s context window.
- **Formula (conceptual)**: `remaining / total_context_window`, rounded to a whole percentage.

## Token Tracking

- **Input tokens**: System prompts, user messages, conversation history.
- **Output tokens**: Agent responses.
- **Cache tokens**: Cache creation and cache read operations (if the provider exposes them).

## Behavior

### Initial State

- **New Agents**: Start at 100% context health

### Token Consumption

- **Real-time Updates**: Health decreases as agents process messages and generate responses
- **Persistent**: Health tracks cumulative token usage across the agent's session
- **Visual Feedback**: Immediate reflection in Bottom HUD

### Edge Cases

- **No Usage Data**: Defaults to 100% if no token information available
- **Invalid Data**: Safely handles malformed or missing usage data
- **Multiple Updates**: Handles rapid successive token usage updates correctly

## Acceptance Criteria

- New agents spawn with 100% health displayed in HUD
- Health decreases in real-time as agents consume tokens
- HUD shows accurate percentage reflecting actual token usage
- System gracefully handles missing or invalid token data
- Health persists correctly across agent interactions
