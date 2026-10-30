/**
 * Console log ring-buffer for capturing recent logs to assist in error reports
 */
const MAX_LOG_ENTRIES = 50;
const ringBuffer = [];

export function initLogger() {
  if (typeof window === 'undefined' || window.__aksLoggerInitialized) {
    return;
  }
  window.__aksLoggerInitialized = true;

  const originalMethods = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
  };

  const serializeArg = (arg) => {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    if (arg instanceof Error) {
      return `${arg.name}: ${arg.message}\n${arg.stack || ''}`;
    }
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  };

  const pushEntry = (type, args) => {
    try {
      const message = args.map(serializeArg).join(' ');
      ringBuffer.push({
        type,
        time: new Date().toISOString(),
        message: message.length > 1000 ? message.substring(0, 1000) + '...' : message,
      });

      if (ringBuffer.length > MAX_LOG_ENTRIES) {
        ringBuffer.shift();
      }
    } catch {
      // Ignore buffering errors
    }
  };

  console.log = (...args) => {
    pushEntry('log', args);
    originalMethods.log.apply(console, args);
  };

  console.warn = (...args) => {
    pushEntry('warn', args);
    originalMethods.warn.apply(console, args);
  };

  console.error = (...args) => {
    pushEntry('error', args);
    originalMethods.error.apply(console, args);
  };

  console.info = (...args) => {
    pushEntry('info', args);
    originalMethods.info.apply(console, args);
  };

  // Also catch unhandled promise rejections into the buffer
  window.addEventListener('unhandledrejection', (event) => {
    pushEntry('unhandledrejection', [event.reason || 'Unhandled Promise Rejection']);
  });
}

export function getRecentLogs() {
  return [...ringBuffer];
}

