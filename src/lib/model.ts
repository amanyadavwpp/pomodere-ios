import { persistRawStorage, readRawStorage, reportStorageError } from './storage';

export type TimerMode = 'focus' | 'short' | 'long';
export type AmbientSound = 'off' | 'rain' | 'brown';

export interface Settings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakEvery: number;
  dailyGoal: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  completionSound: boolean;
}

export interface Task {
  id: string;
  title: string;
  estimate: number;
  completedSessions: number;
  done: boolean;
  completedAt?: number;
}

export interface FocusSession {
  id: string;
  minutes: number;
  completedAt: number;
  taskId: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  dailyGoal: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  completionSound: true,
};

export const INITIAL_TASKS: Task[] = [
  { id: 'first-plan', title: 'Plan the week ahead', estimate: 1, completedSessions: 0, done: false },
  { id: 'big-idea', title: 'Work on the big idea', estimate: 2, completedSessions: 0, done: false },
  { id: 'read-pages', title: 'Read a few pages', estimate: 1, completedSessions: 0, done: false },
];

export const MODE_LABELS: Record<TimerMode, string> = {
  focus: 'Focus',
  short: 'Short break',
  long: 'Long break',
};

export function durationFor(mode: TimerMode, settings: Settings): number {
  return mode === 'focus'
    ? settings.focusMinutes
    : mode === 'short'
      ? settings.shortBreakMinutes
      : settings.longBreakMinutes;
}

export function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export function localDay(timestamp: number | Date = Date.now()): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function readStorage<T>(key: string, fallback: T, validate?: (value: unknown) => value is T): T {
  try {
    const raw = readRawStorage(key);
    if (!raw) return fallback;
    const value: unknown = JSON.parse(raw);
    return !validate || validate(value) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStorage(key: string, value: unknown): void {
  try {
    void persistRawStorage(key, JSON.stringify(value)).catch(reportStorageError);
  } catch {
    reportStorageError();
  }
}

export function isSettings(value: unknown): value is Settings {
  if (!value || typeof value !== 'object') return false;
  const settings = value as Settings;
  const bounds = { focusMinutes: 120, shortBreakMinutes: 60, longBreakMinutes: 60, longBreakEvery: 8, dailyGoal: 20 };
  return (
    (Object.keys(bounds) as (keyof typeof bounds)[]).every((key) => Number.isInteger(settings[key]) && settings[key] >= 1 && settings[key] <= bounds[key]) &&
    [2, 3, 4, 5, 6, 8].includes(settings.longBreakEvery) &&
    ['autoStartBreaks', 'autoStartFocus', 'completionSound'].every((key) => typeof settings[key as keyof Settings] === 'boolean')
  );
}

export function isTaskList(value: unknown): value is Task[] {
  return Array.isArray(value) && value.every((task) =>
    task && typeof task.id === 'string' && typeof task.title === 'string' &&
    Number.isInteger(task.estimate) && task.estimate >= 1 && task.estimate <= 12 &&
    Number.isInteger(task.completedSessions) && task.completedSessions >= 0 && typeof task.done === 'boolean',
  );
}

export function isSessionList(value: unknown): value is FocusSession[] {
  return Array.isArray(value) && value.every((session) =>
    session && typeof session.id === 'string' && Number.isFinite(session.minutes) &&
    session.minutes > 0 && Number.isFinite(session.completedAt) &&
    (session.taskId === null || typeof session.taskId === 'string'),
  );
}