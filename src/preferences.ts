import { useEffect, useState } from 'react';

import { availableLocalStorage } from './browserEnvironment';
import type { StorageLike } from './domain/scorecardStorage';

export const fieldPreferenceStorageKey = 'fungolf-scorecard:prefs:v1';

export type FieldPreferences = {
  readonly sunlight: boolean;
  readonly wakeLock: boolean;
};

const defaultPreferences: FieldPreferences = { sunlight: false, wakeLock: false };

export function readFieldPreferences(storage: StorageLike | undefined): FieldPreferences {
  if (!storage) {
    return defaultPreferences;
  }

  try {
    const parsed = JSON.parse(storage.getItem(fieldPreferenceStorageKey) ?? 'null') as { version?: unknown; sunlight?: unknown; wakeLock?: unknown } | null;
    if (!parsed || parsed.version !== 1) {
      return defaultPreferences;
    }
    return { sunlight: parsed.sunlight === true, wakeLock: parsed.wakeLock === true };
  } catch {
    return defaultPreferences;
  }
}

export function writeFieldPreferences(storage: StorageLike | undefined, preferences: FieldPreferences): boolean {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(fieldPreferenceStorageKey, JSON.stringify({ version: 1, ...preferences }));
    return true;
  } catch {
    return false;
  }
}

export function useFieldPreferences(): {
  readonly sunlight: boolean;
  readonly wakeLock: boolean;
  readonly setSunlight: (sunlight: boolean) => void;
  readonly setWakeLock: (wakeLock: boolean) => void;
} {
  const [preferences, setPreferences] = useState<FieldPreferences>(() => readFieldPreferences(availableLocalStorage()));

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }
    document.documentElement.classList.toggle('sunlight', preferences.sunlight);
    return () => document.documentElement.classList.remove('sunlight');
  }, [preferences.sunlight]);

  function update(next: FieldPreferences) {
    setPreferences(next);
    writeFieldPreferences(availableLocalStorage(), next);
  }

  return {
    sunlight: preferences.sunlight,
    wakeLock: preferences.wakeLock,
    setSunlight: (sunlight) => update({ ...preferences, sunlight }),
    setWakeLock: (wakeLock) => update({ ...preferences, wakeLock }),
  };
}
