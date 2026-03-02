import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export type ShellCommand = {
  shell: string;
  args: string[];
};

const findFirstExisting = (paths: string[]): string | null => {
  for (const candidate of paths) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
};

export const ensureTerminalPath = (input?: string): string => {
  const delimiter = path.delimiter;
  const existing = (input ?? '').split(delimiter).filter(Boolean);
  const seen = new Set<string>();
  const home = os.homedir();
  const preferred = [
    path.join(home, '.bun', 'bin'),
    path.join(home, '.local', 'bin'),
    path.join(home, '.cargo', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
  ];
  const next: string[] = [];
  const appendExisting = () => {
    for (const entry of existing) {
      if (!entry || seen.has(entry)) continue;
      next.push(entry);
      seen.add(entry);
    }
  };
  const appendPreferredMissing = () => {
    for (const candidate of preferred) {
      if (seen.has(candidate)) continue;
      if (fs.existsSync(candidate)) {
        next.push(candidate);
        seen.add(candidate);
      }
    }
  };
  if (existing.length > 0) {
    appendExisting();
    appendPreferredMissing();
  } else {
    appendPreferredMissing();
  }
  return next.join(delimiter);
};

const findExecutableOnPath = (executable: string): string | null => {
  const pathEnv = ensureTerminalPath(process.env.PATH);
  const pathExtRaw = process.env.PATHEXT || '.EXE;.CMD;.BAT';
  const pathExt = pathExtRaw.split(';').filter(Boolean);
  const hasExt = path.extname(executable) !== '';
  const candidates = hasExt
    ? [executable]
    : [executable, ...pathExt.map((ext) => `${executable}${ext.toLowerCase()}`)];

  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue;
    for (const candidate of candidates) {
      const full = path.join(dir, candidate);
      if (fs.existsSync(full)) {
        return full;
      }
    }
  }
  return null;
};

const getDefaultShellPath = (): string => {
  if (process.platform === 'win32') {
    const pwshPath = findExecutableOnPath('pwsh');
    const pwshDefault = findFirstExisting([
      'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
      'C:\\Program Files (x86)\\PowerShell\\7\\pwsh.exe',
    ]);
    if (pwshPath || pwshDefault) {
      return pwshPath || pwshDefault || 'pwsh.exe';
    }

    const powershellPath = findExecutableOnPath('powershell');
    const systemRoot = process.env.SystemRoot || 'C:\\Windows';
    const powershellDefault = findFirstExisting([
      path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    ]);
    if (powershellPath || powershellDefault) {
      return powershellPath || powershellDefault || 'powershell.exe';
    }

    return process.env.COMSPEC || 'cmd.exe';
  }

  if (process.platform === 'darwin') {
    return '/bin/zsh';
  }

  return '/bin/bash';
};

const resolveShellExecutable = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (path.isAbsolute(trimmed) || trimmed.includes(path.sep)) {
    return fs.existsSync(trimmed) ? trimmed : null;
  }
  return findExecutableOnPath(trimmed) ?? null;
};

const splitShellCommand = (value: string): ShellCommand => {
  const trimmed = value.trim();
  if (!trimmed) return { shell: '', args: [] };
  const args: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let escaped = false;
  for (const ch of trimmed) {
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\' && quote !== "'") {
      escaped = true;
      continue;
    }
    if (ch === '"' || ch === "'") {
      if (!quote) {
        quote = ch;
        continue;
      }
      if (quote === ch) {
        quote = null;
        continue;
      }
    }
    if (!quote && /\s/.test(ch)) {
      if (current.length > 0) {
        args.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }
  if (current.length > 0) {
    args.push(current);
  }
  const shell = args.shift() ?? '';
  return { shell, args };
};

const resolveExplicitShell = (value: string): ShellCommand | null => {
  const parsed = splitShellCommand(value);
  const resolved = resolveShellExecutable(parsed.shell);
  if (!resolved) return null;
  return { shell: resolved, args: parsed.args };
};

export const resolveShellCommand = (hint?: string): ShellCommand => {
  const explicit = (hint ?? '').trim();
  if (explicit) {
    const resolvedExplicit = resolveExplicitShell(explicit);
    if (resolvedExplicit) return resolvedExplicit;
  }

  if (process.platform !== 'win32') {
    const envShell = (process.env.SHELL ?? '').trim();
    if (envShell) {
      const parsed = splitShellCommand(envShell);
      const resolved = resolveShellExecutable(parsed.shell);
      if (resolved) {
        return { shell: resolved, args: [] };
      }
    }
  }

  const fallback = resolveShellExecutable(getDefaultShellPath()) ?? getDefaultShellPath();
  return { shell: fallback, args: [] };
};

export const sanitizeShellEnv = (env: Record<string, string>, shellPath: string): Record<string, string> => {
  if (process.platform === 'win32') return env;
  if (!shellPath) return env;
  if (env.SHELL === shellPath) return env;
  return { ...env, SHELL: shellPath };
};
