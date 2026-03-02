import { spawnSync } from 'child_process';
import { expect, test } from 'bun:test';

test('bun test runs the full test suite', () => {
  const result = spawnSync('bun', ['run', 'test'], { stdio: 'inherit' });
  expect(result.status).toBe(0);
}, 300_000);
