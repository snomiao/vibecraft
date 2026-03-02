import { describe, expect, test } from 'vitest';
import {
  computeClaudeContextLeft,
  computeCodexContextLeft,
} from '../../../src/main/services/agentConnect/usage';

describe('agent connect usage', () => {
  test('computes codex context left from input and output tokens', () => {
    const contextLeft = computeCodexContextLeft(
      { input_tokens: 9556, cached_input_tokens: 6656, output_tokens: 5 },
      258_000
    );
    expect(contextLeft).toBe(96);
  });

  test('computes claude context left using cached tokens and reserved output', () => {
    const cached = 6047 + 15267;
    const contextLeft = computeClaudeContextLeft(
      { input_tokens: 3, output_tokens: 4, cached_input_tokens: cached },
      'claude-haiku-4-5-20251001',
      200_000
    );
    expect(contextLeft).toBe(87);
  });
});
