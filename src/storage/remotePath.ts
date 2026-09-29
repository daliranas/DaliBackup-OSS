import path from 'path';

/** Accept a relative name or a previously returned full path, within the repository. */
export function remotePath(base: string, name: string): string {
  const root = path.posix.resolve('/', base);
  const candidate = path.posix.isAbsolute(name)
    ? path.posix.normalize(name) : path.posix.resolve(root, name);
  if (candidate !== root && !candidate.startsWith(root === '/' ? '/' : root + '/')) {
    throw new Error('Storage path escapes the configured repository');
  }
  return candidate;
}
