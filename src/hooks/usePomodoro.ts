import { useCallback, useEffect, useRef, useState } from 'react';
import { durationFor, formatTime, makeId, MODE_LABELS, readStorage, writeStorage } from '../lib/model';
import type { Settings, TimerMode } from '../lib/model';
import { isAppActive } from '../lib/lifecycle';

export interface TimerState {
  mode: TimerMode;
  remaining: number;
  running: boolean;
  deadline: number | null;
  cycle: number;
  id: string;
  durationMinutes: number;
}

function freshTimer(mode: TimerMode, settings: Settings, cycle = 0): TimerState {
  const durationMinutes = durationFor(mode, settings);
  return { mode, remaining: durationMinutes * 60, running: false, deadline: null, cycle, id: makeId(), durationMinutes };
}

function isTimer(value: unknown): value is TimerState {
  if (!value || typeof value !== 'object') return false;
  const timer = value as TimerState;
  return ['focus', 'short', 'long'].includes(timer.mode) &&
    Number.isInteger(timer.remaining) && timer.remaining > 0 && timer.remaining <= timer.durationMinutes * 60 &&
    typeof timer.running === 'boolean' && typeof timer.id === 'string' &&
    Number.isInteger(timer.cycle) && timer.cycle >= 0 &&
    Number.isFinite(timer.durationMinutes) && timer.durationMinutes >= 1 && timer.durationMinutes <= 120 &&
    (timer.running ? Number.isFinite(timer.deadline) : timer.deadline === null);
}

interface TimerCallbacks {
  onFocusComplete: (id: string, minutes: number, completedAt: number) => void;
  onTransition: (from: TimerMode, to: TimerMode, skipped: boolean) => void;
}

export function usePomodoro(settings: Settings, callbacks: TimerCallbacks) {
  const [timer, setTimer] = useState<TimerState>(() => readStorage('timer', freshTimer('focus', settings), isTimer));
  const timerRef = useRef(timer);
  const settingsRef = useRef(settings);
  const callbacksRef = useRef(callbacks);
  const completedId = useRef<string | null>(null);
  timerRef.current = timer;
  settingsRef.current = settings;
  callbacksRef.current = callbacks;

  const commit = useCallback((next: TimerState, persist = true) => {
    timerRef.current = next;
    setTimer(next);
    if (persist) writeStorage('timer', next);
  }, []);

  const transition = useCallback((skipped = false) => {
    const current = timerRef.current;
    if (completedId.current === current.id) return;
    completedId.current = current.id;
    const preferences = settingsRef.current;
    const completedFocus = current.mode === 'focus' && !skipped;
    const cycle = completedFocus ? (current.cycle + 1) % preferences.longBreakEvery : current.cycle;
    const nextMode: TimerMode = current.mode === 'focus'
      ? completedFocus && cycle === 0 ? 'long' : 'short'
      : 'focus';
    const next = freshTimer(nextMode, preferences, cycle);
    const autoStart = nextMode === 'focus' ? preferences.autoStartFocus : preferences.autoStartBreaks;
    if (autoStart && !skipped) {
      next.running = true;
      next.deadline = Date.now() + next.remaining * 1000;
    }
    commit(next);
    if (completedFocus) callbacksRef.current.onFocusComplete(current.id, current.durationMinutes, current.deadline ?? Date.now());
    callbacksRef.current.onTransition(current.mode, nextMode, skipped);
  }, [commit]);

  useEffect(() => {
    if (!timer.running || !timer.deadline) return;
    const tick = () => {
      if (!isAppActive()) return;
      const current = timerRef.current;
      if (!current.running || !current.deadline) return;
      // A wall-clock deadline keeps the timer accurate in sleeping and background tabs.
      const remaining = Math.max(0, Math.ceil((current.deadline - Date.now()) / 1000));
      if (remaining === 0) transition();
      else if (remaining !== current.remaining) commit({ ...current, remaining }, false);
    };
    tick();
    const interval = window.setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('pomodere:resume', tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('pomodere:resume', tick);
    };
  }, [timer.running, timer.deadline, transition, commit]);

  useEffect(() => {
    document.title = timer.running
      ? `${formatTime(timer.remaining)} - ${MODE_LABELS[timer.mode]} | pomodere`
      : 'pomodere - A little focus goes a long way';
  }, [timer.remaining, timer.mode, timer.running]);

  const toggle = useCallback(() => {
    const current = timerRef.current;
    if (current.running) {
      const remaining = Math.max(0, Math.ceil(((current.deadline ?? Date.now()) - Date.now()) / 1000));
      if (remaining === 0) transition();
      else commit({ ...current, running: false, deadline: null, remaining });
    } else {
      commit({ ...current, running: true, deadline: Date.now() + current.remaining * 1000 });
    }
  }, [commit, transition]);

  const setMode = useCallback((mode: TimerMode) => {
    if (timerRef.current.mode !== mode) commit(freshTimer(mode, settingsRef.current, timerRef.current.cycle));
  }, [commit]);

  const reset = useCallback((preferences = settingsRef.current) => {
    commit(freshTimer(timerRef.current.mode, preferences, timerRef.current.cycle % preferences.longBreakEvery));
  }, [commit]);

  const skip = useCallback(() => transition(true), [transition]);

  return { timer, toggle, setMode, reset, skip };
}