import { describe, expect, test } from 'vitest';
import { COMMAND_IDS as SHARED_COMMAND_IDS } from '../../../src/shared/commands';
import { COMMAND_IDS as MCP_COMMAND_IDS, COMMAND_METADATA } from '../../../src/main/mcp/commandMetadata';

describe('mcp command metadata', () => {
  test('exposes every shared command id', () => {
    expect(new Set(MCP_COMMAND_IDS)).toEqual(new Set(SHARED_COMMAND_IDS));
  });

  test('has unique command ids', () => {
    expect(MCP_COMMAND_IDS).toHaveLength(new Set(MCP_COMMAND_IDS).size);
    expect(COMMAND_METADATA).toHaveLength(MCP_COMMAND_IDS.length);
  });
});
