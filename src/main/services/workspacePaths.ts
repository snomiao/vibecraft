import * as path from 'path';

export function resolveWorkspaceSubpath(workspacePath: string, relativePath: string): string | null {
  const workspaceRoot = path.resolve(workspacePath);
  const resolved = path.resolve(workspaceRoot, relativePath);
  if (resolved === workspaceRoot) return resolved;
  if (resolved.startsWith(workspaceRoot + path.sep)) return resolved;
  return null;
}
