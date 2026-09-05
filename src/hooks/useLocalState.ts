import { useEffect, useState } from 'react';
import { readStorage, writeStorage } from '../lib/model';

export function useLocalState<T>(key: string, fallback: T, validate?: (value: unknown) => value is T) {
  const [value, setValue] = useState<T>(() => readStorage(key, fallback, validate));

  useEffect(() => {
    writeStorage(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}