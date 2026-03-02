import type { CreateTerminalOptions, TerminalHandlers } from './terminals';
import { getTestModeConfig } from '../../testing/testMode';

export type TerminalService = {
  startTerminalSession: (
    options: CreateTerminalOptions,
    handlers: TerminalHandlers
  ) => { success: boolean; error?: string; sessionToken?: string };
  sendTerminalInput: (terminalId: string, data: string) => boolean;
  resizeTerminal: (terminalId: string, cols: number, rows: number) => boolean;
  stopTerminalSession: (terminalId: string) => boolean;
  getTerminalHistory: (terminalId: string, workspacePath: string) => string;
};

let cachedService: Promise<TerminalService> | null = null;

const loadTerminalService = async (): Promise<TerminalService> => {
  const testMode = getTestModeConfig();
  try {
    return testMode.enabled ? await import('../../testing/terminalsStub') : await import('./terminals');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load terminal service (${testMode.enabled ? 'stub' : 'native'}): ${message}`);
  }
};

export async function getTerminalService(): Promise<TerminalService> {
  if (!cachedService) {
    cachedService = loadTerminalService();
  }
  return cachedService;
}
