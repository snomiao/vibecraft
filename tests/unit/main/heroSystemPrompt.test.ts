import { describe, expect, test } from 'vitest';
import { buildHeroSystemPrompt } from '../../../src/main/services/agentConnect/heroSystemPrompt';

describe('hero system prompt', () => {
  test('enforces orchestrator-only delegation behavior', () => {
    const prompt = buildHeroSystemPrompt('Davion');

    expect(prompt).toContain('"Davion"');
    expect(prompt).toContain('orchestration-only workspace conductor');
    expect(prompt).toContain('must delegate execution to spawned Vibecraft agents');
    expect(prompt).toContain('Do not perform coding, editing, or execution work yourself');
    expect(prompt).toContain('If no suitable agent exists, spawn one first and then delegate');
    expect(prompt).toContain('Operate exclusively within the Vibecraft workspace');
    expect(prompt).toContain('Only use actions available in the Vibecraft command set');
    expect(prompt).toContain('`create-folder`, `create-browser`, `create-terminal`');
    expect(prompt).toContain('always rely on the agent attachment for execution context');
    expect(prompt).toContain('You may create as many agents as needed; there is no agent-count quota');
    expect(prompt).toContain(
      'You have unrestricted access to orchestrate the Vibecraft workspace, bounded only by the available Vibecraft commands'
    );
  });
});
