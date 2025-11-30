/**
 * Console safety shims:
 * - Silence noisy console.log/info/debug in production unless explicitly enabled.
 * - Mask sensitive data in warn/error outputs.
 */
import { maskSensitiveData } from './logger';

const enableVerboseLogs = process.env.EXPO_PUBLIC_DEBUG_MODE === 'true' || process.env.NODE_ENV !== 'production';

const originalLog = console.log;
const originalInfo = console.info;
const originalDebug = console.debug;
const originalWarn = console.warn;
const originalError = console.error;

if (!enableVerboseLogs) {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
}

console.warn = (...args: any[]) => {
  try {
    originalWarn(...args.map(arg => maskSensitiveData(arg)));
  } catch {
    originalWarn(...args);
  }
};

console.error = (...args: any[]) => {
  try {
    originalError(...args.map(arg => maskSensitiveData(arg)));
  } catch {
    originalError(...args);
  }
};

export {}; // ensure module scope
