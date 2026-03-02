import type { CreateTerminalOptions, TerminalHandlers } from '../main/services/terminals';

const DEFAULT_PROCESS_NAME = 'vibecraft-test-shell';

export function startTerminalSession(
  options: CreateTerminalOptions,
  handlers: TerminalHandlers
): { success: boolean; error?: string; sessionToken?: string } {
  const terminalId = String(options.terminalId || '').trim();
  if (!terminalId) {
    return { success: false, error: 'Terminal id is required' };
  }

  const sessionToken = (options.sessionToken || '').trim() || `test-${Date.now()}`;
  const relativePath = String(options.relativePath || '').trim() || '.';

  handlers.onProcessChange?.(terminalId, DEFAULT_PROCESS_NAME, sessionToken);
  handlers.onCwdChange?.(terminalId, { path: relativePath, relativePath }, sessionToken);

  return { success: true, sessionToken };
}

export function sendTerminalInput(): boolean {
  return true;
}

export function resizeTerminal(): boolean {
  return true;
}

export function stopTerminalSession(): boolean {
  return true;
}

export function getTerminalHistory(): string {
  return '';
}
