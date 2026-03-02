import * as fs from 'fs';
import * as path from 'path';

export const DEFAULT_CLAUDE_PERMISSION_MODE = 'bypassPermissions';

export type BuildClaudeChatArgsOptions = {
  prompt: string;
  resumeSessionId?: string | null;
  streaming?: boolean;
};

export function buildClaudeChatArgs(options: BuildClaudeChatArgsOptions): string[] {
  const { prompt, resumeSessionId, streaming = true } = options;

  const args: string[] = ['-p'];

  if (streaming) {
    args.push('--output-format=stream-json', '--verbose');
  } else {
    args.push('--output-format=json');
  }

  args.push('--permission-mode', DEFAULT_CLAUDE_PERMISSION_MODE);

  if (resumeSessionId) {
    args.push('--resume', resumeSessionId);
  }

  args.push(prompt);
  return args;
}

function resolveWindowsCli(binary: string): string {
  const userProfile = process.env.USERPROFILE;
  if (!userProfile) return `${binary}.cmd`;
  const candidate = path.join(userProfile, 'AppData', 'Roaming', 'npm', `${binary}.cmd`);
  if (fs.existsSync(candidate)) return candidate;
  return `${binary}.cmd`;
}

export function getClaudeCommand(): { command: string; args: string[] } {
  const baseArgs: string[] = [];
  if (process.platform === 'win32') {
    return { command: resolveWindowsCli('claude'), args: baseArgs };
  }
  return { command: 'claude', args: baseArgs };
}
