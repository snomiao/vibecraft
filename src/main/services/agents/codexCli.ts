import * as fs from 'fs';
import * as path from 'path';

export const DEFAULT_CODEX_PERMISSION_FLAG = '--yolo';

export type BuildCodexExecArgsOptions = {
  prompt: string;
  repoRoot: string;
  resumeSessionId?: string | null;
};

export function buildCodexExecArgs(options: BuildCodexExecArgsOptions): string[] {
  const { prompt, repoRoot, resumeSessionId } = options;

  const args: string[] = [
    'exec',
    '--skip-git-repo-check',
    '--json',
    DEFAULT_CODEX_PERMISSION_FLAG,
    '-C',
    repoRoot,
  ];

  if (resumeSessionId) {
    args.push('resume', resumeSessionId);
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

export function getCodexCommand(): { command: string; args: string[] } {
  const baseArgs: string[] = [];
  if (process.platform === 'win32') {
    return { command: resolveWindowsCli('codex'), args: baseArgs };
  }
  return { command: 'codex', args: baseArgs };
}
