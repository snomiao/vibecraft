import pkg from '../../../package.json';

const resolvedVersion = typeof pkg.version === 'string' ? pkg.version.trim() : '';

export const APP_VERSION = resolvedVersion || '0.0.0';
