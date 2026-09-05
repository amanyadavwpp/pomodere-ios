import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { TimerState } from './usePomodoro';
import { useLocalState } from './useLocalState';

const REMINDER_ID = 41025;
let reminderQueue: Promise<void> = Promise.resolve();
let reminderVersion = 0;

export function useNativeReminders(timer: TimerState) {
  const native = Capacitor.getPlatform() === 'ios';
  const [enabled, setEnabled] = useLocalState('notifications-enabled', false, (value): value is boolean => typeof value === 'boolean');
  const [permission, setPermission] = useState<string>('prompt');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!native) return;
    try { setPermission((await LocalNotifications.checkPermissions()).display); }
    catch { setError('Timer reminders are unavailable. Run Capacitor sync and check the iOS notification settings.'); }
  }, [native]);

  useEffect(() => {
    void refresh();
    const onResume = () => { void refresh(); };
    window.addEventListener('pomodere:resume', onResume);
    return () => window.removeEventListener('pomodere:resume', onResume);
  }, [refresh]);

  const toggle = useCallback(async () => {
    if (!native || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      if (enabled && permission === 'granted') { setEnabled(false); return; }
      const current = await LocalNotifications.checkPermissions();
      const result = current.display === 'prompt' || current.display === 'prompt-with-rationale'
        ? await LocalNotifications.requestPermissions()
        : current;
      setPermission(result.display);
      if (result.display === 'granted') setEnabled(true);
      else setError('Allow notifications for Pomodere in iPhone Settings, then enable reminders here.');
    } catch {
      setError('Reminders could not be enabled. Your timer still works while the app is open.');
    } finally { busyRef.current = false; setBusy(false); }
  }, [enabled, native, permission, setEnabled]);

  useEffect(() => {
    if (!native) return;
    const version = ++reminderVersion;
    const deadline = timer.running ? timer.deadline : null;
    reminderQueue = reminderQueue.catch(() => undefined).then(async () => {
      if (version !== reminderVersion) return;
      await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
      if (version !== reminderVersion || !enabled || !deadline || deadline <= Date.now()) return;
      const current = await LocalNotifications.checkPermissions();
      if (current.display !== 'granted' || version !== reminderVersion || deadline <= Date.now()) return;
      await LocalNotifications.schedule({ notifications: [{
        id: REMINDER_ID,
        title: timer.mode === 'focus' ? 'A little focus, well spent.' : 'A little refreshed.',
        body: timer.mode === 'focus' ? 'Your focus session is complete. Open Pomodere for a little breather.' : 'Your break is complete. Open Pomodere when you are ready to focus.',
        schedule: { at: new Date(deadline) },
        sound: 'default',
        extra: { destination: 'focus' },
      }] });
    }).catch(() => {
      if (version === reminderVersion) setError('The timer reminder could not be scheduled. Keep the app open for this session, or try again.');
    });
    // Do not cancel on background/unmount: iOS owns the scheduled reminder.
  }, [native, enabled, permission, timer.running, timer.deadline, timer.mode]);

  useEffect(() => {
    if (!native) return;
    const listener = LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => {
      if (notification.id === REMINDER_ID) window.location.hash = 'focus';
    });
    void listener.catch(() => undefined);
    return () => { void listener.then((handle) => handle.remove()).catch(() => undefined); };
  }, [native]);

  return { native, enabled, permission, busy, error, toggle };
}

export type NativeReminderController = ReturnType<typeof useNativeReminders>;