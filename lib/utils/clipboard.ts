/**
 * Clipboard utility for secure clipboard management
 * Clears clipboard after a specified timeout to prevent data leakage
 */

import * as Clipboard from 'expo-clipboard';
import { createScopedLogger } from './logger';

const debug = createScopedLogger('clipboard');

let clearClipboardTimeout: NodeJS.Timeout | null = null;

/**
 * Sets clipboard content and automatically clears it after the specified delay
 * @param text - Text to copy to clipboard
 * @param delayMs - Delay in milliseconds before clearing (default: 60000 = 60 seconds)
 */
export async function setClipboardWithAutoClear(
  text: string,
  delayMs: number = 60000
): Promise<void> {
  // Clear any existing timeout
  if (clearClipboardTimeout) {
    clearTimeout(clearClipboardTimeout);
    clearClipboardTimeout = null;
  }

  // Set clipboard content
  await Clipboard.setStringAsync(text);

  // Set timeout to clear clipboard
  clearClipboardTimeout = setTimeout(async () => {
    try {
      // Overwrite with empty string to clear
      await Clipboard.setStringAsync('');
      clearClipboardTimeout = null;
    } catch (error) {
      // Non-fatal - just log it
      debug.warn('Failed to clear clipboard:', error);
    }
  }, delayMs);
}

/**
 * Manually clear the clipboard and cancel any pending auto-clear
 */
export async function clearClipboard(): Promise<void> {
  if (clearClipboardTimeout) {
    clearTimeout(clearClipboardTimeout);
    clearClipboardTimeout = null;
  }

  try {
    await Clipboard.setStringAsync('');
  } catch (error) {
    console.warn('[clipboard] Failed to clear clipboard:', error);
  }
}

