export function normalizeWorkspaceRelativePath(rawPath: string | undefined | null): string {
  const trimmed = typeof rawPath === 'string' ? rawPath.trim() : '';
  if (!trimmed) return '.';
  const normalized = trimmed.replace(/\\/g, '/');
  const segments = normalized.split('/');
  const stack: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (stack.length > 0 && stack[stack.length - 1] !== '..') {
        stack.pop();
      } else {
        stack.push(segment);
      }
      continue;
    }
    stack.push(segment);
  }
  const result = stack.join('/');
  return result && result !== '.' ? result : '.';
}

export function sanitizeFolderRelativeName(input: string): string {
  const normalized = String(input || '')
    .replace(/[<>:"\\|?*]/g, '')
    .replace(/\\/g, '/')
    .replace(/\/+$/g, '')
    .replace(/^\/+/, '')
    .trim();
  const parts = normalized.split('/').filter(Boolean);
  const safeParts: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed === '.' || trimmed === '..') continue;
    safeParts.push(trimmed);
  }
  return safeParts.join('-');
}
