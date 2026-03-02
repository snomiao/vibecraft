import type { CommandBatchItem, CommandInvocation, CommandRunResponse } from '../../shared/commands';
import { runRendererCommand, runRendererCommandBatch } from '../commandBridge';

export type RunCommandPayload = {
  command: CommandInvocation;
  workspacePath: string;
};

export type RunCommandsPayload = {
  commands: CommandBatchItem[];
  workspacePath: string;
};

export const runCommandTool = async (payload: RunCommandPayload): Promise<CommandRunResponse> => {
  return runRendererCommand({ ...payload.command, source: 'mcp' as const }, payload.workspacePath);
};

export const runCommandsTool = async (payload: RunCommandsPayload): Promise<CommandRunResponse> => {
  const commands: CommandBatchItem[] = payload.commands.map((command) => ({
    ...command,
    source: 'mcp' as const,
  }));
  return runRendererCommandBatch(commands, payload.workspacePath);
};
