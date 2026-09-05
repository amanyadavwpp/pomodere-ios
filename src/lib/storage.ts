import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const PREFIX = 'pomodere:';
const KEYS = ['settings', 'tasks', 'sessions', 'active-task', 'volume', 'timer', 'notes-vault', 'notifications-enabled'];
const nativeValues = new Map<string, string>();
const writeQueues = new Map<string, Promise<void>>();
let initialization: Promise<void> | null = null;

export function initializeStorage(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve();
  if (!initialization) {
    initialization = (async () => {
      for (const key of KEYS) {
        const fullKey = PREFIX + key;
        const { value } = await Preferences.get({ key: fullKey });
        if (value !== null) nativeValues.set(fullKey, value);
        else {
          let legacyValue: string | null = null;
          try { legacyValue = localStorage.getItem(fullKey); } catch { /* Native storage does not need localStorage. */ }
          if (legacyValue !== null) {
            await Preferences.set({ key: fullKey, value: legacyValue });
            nativeValues.set(fullKey, legacyValue);
          }
        }
      }
    })();
  }
  return initialization;
}

export function readRawStorage(key: string): string | null {
  return Capacitor.isNativePlatform() ? nativeValues.get(PREFIX + key) ?? null : localStorage.getItem(PREFIX + key);
}

export function persistRawStorage(key: string, value: string): Promise<void> {
  const fullKey = PREFIX + key;
  if (!Capacitor.isNativePlatform()) {
    try {
      localStorage.setItem(fullKey, value);
      return Promise.resolve();
    } catch {
      return Promise.reject(new Error('Storage is unavailable or full. Free some space and try saving again.'));
    }
  }
  // Serialize writes per key so a slower bridge call cannot overwrite a newer save.
  const previous = writeQueues.get(fullKey) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(async () => {
    await Preferences.set({ key: fullKey, value });
    nativeValues.set(fullKey, value);
  });
  writeQueues.set(fullKey, next);
  return next;
}

export function reportStorageError(): void {
  window.dispatchEvent(new Event('pomodere:storage-error'));
}