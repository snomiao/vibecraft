import log from 'electron-log';

type Level = log.LevelOption;

const LEVELS: Level[] = ['error', 'warn', 'info', 'verbose', 'debug', 'silly'];

const isDev = process.env.NODE_ENV !== 'production';

function coerceLevel(value: string | undefined, fallback: Level): Level {
  if (!value) return fallback;
  const normalized = value.toLowerCase() as Level;
  return LEVELS.includes(normalized) ? normalized : fallback;
}

const consoleLevel = coerceLevel(process.env.VIBES_LOG_LEVEL, isDev ? 'info' : 'warn');
const fileLevel = coerceLevel(process.env.VIBES_LOG_FILE_LEVEL, 'info');

log.transports.console.level = consoleLevel;
log.transports.console.format = '{h}:{i}:{s}.{ms} [{level}] {text}';

log.transports.file.level = fileLevel;
log.transports.file.maxSize = 1024 * 1024 * 5; // 5MB
log.transports.file.format = '{y}-{m}-{d} {h}:{i}:{s}.{ms} [{level}] {text}';

export const logger = log;

export const logSettings = Object.freeze({
  traceTerminal: process.env.VIBES_TRACE_TERMINAL === '1',
});
