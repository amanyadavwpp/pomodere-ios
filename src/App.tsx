import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { ArrowUpRight, ChartNoAxesCombined, Check, CircleHelp, Clock3, Keyboard, NotebookPen, Settings2, Sun, X } from 'lucide-react';
import { Brand, TomatoMark } from './components/Brand';
import { HelpDialog, SettingsDialog, ShortcutsDialog } from './components/Dialogs';
import { ProgressView } from './components/ProgressView';
import { NotesView } from './components/NotesView';
import { SoundMenu } from './components/SoundMenu';
import { TaskList } from './components/TaskList';
import { Timer } from './components/Timer';
import { useAmbientAudio, useChime } from './hooks/useAudio';
import { useLocalState } from './hooks/useLocalState';
import { usePomodoro } from './hooks/usePomodoro';
import { useNotebook } from './hooks/useNotebook';
import { useDeviceLifecycle } from './hooks/useDeviceLifecycle';
import { useNativeReminders } from './hooks/useNativeReminders';
import { DEFAULT_SETTINGS, durationFor, INITIAL_TASKS, isSessionList, isSettings, isTaskList, localDay, makeId } from './lib/model';
import type { AmbientSound, FocusSession, Settings, Task } from './lib/model';

type Page = 'focus' | 'progress' | 'notes';
type OpenDialog = 'settings' | 'help' | 'shortcuts' | null;
interface Toast { id: string; message: string; action?: { label: string; onClick: () => void } }

function pageFromHash(): Page {
  return window.location.hash === '#notes' ? 'notes' : window.location.hash === '#progress' ? 'progress' : 'focus';
}

export default function App() {
  useDeviceLifecycle();
  const notebook = useNotebook();
  const [settings, setSettings] = useLocalState<Settings>('settings', DEFAULT_SETTINGS, isSettings);
  const [tasks, setTasks] = useLocalState<Task[]>('tasks', INITIAL_TASKS, isTaskList);
  const [sessions, setSessions] = useLocalState<FocusSession[]>('sessions', [], isSessionList);
  const [activeId, setActiveId] = useLocalState<string | null>('active-task', 'first-plan', (value): value is string | null => value === null || typeof value === 'string');
  const [volume, setVolume] = useLocalState<number>('volume', 0.4, (value): value is number => typeof value === 'number' && value >= 0 && value <= 1);
  const [sound, setSound] = useState<AmbientSound>('off');
  const [page, setPage] = useState<Page>(pageFromHash);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [now, setNow] = useState(Date.now());
  const recordedSessions = useRef(new Set(sessions.map((session) => session.id)));
  const audioError = useAmbientAudio(sound, volume);
  const chime = useChime();

  const notify = useCallback((message: string, action?: Toast['action']) => setToast({ id: makeId(), message, action }), []);

  const pomodoro = usePomodoro(settings, {
    onFocusComplete: (id, minutes, completedAt) => {
      if (recordedSessions.current.has(id)) return;
      recordedSessions.current.add(id);
      const taskId = tasks.some((task) => task.id === activeId && !task.done) ? activeId : null;
      setSessions((previous) => [...previous, { id, minutes, completedAt, taskId }]);
      if (taskId) setTasks((previous) => previous.map((task) => task.id === taskId ? { ...task, completedSessions: task.completedSessions + 1 } : task));
      setNow(Date.now());
    },
    onTransition: (from, to, skipped) => {
      if (settings.completionSound && !skipped) chime.play();
      if (skipped) notify(to === 'focus' ? 'A fresh focus session, whenever you are ready.' : 'Session skipped. A little breather is up next.');
      else if (from === 'focus') notify(`One session, well spent. Time for a ${durationFor(to, settings)}-minute breather.`);
      else notify('A little refreshed. Your next focus session is ready.');
    },
  });
  const reminders = useNativeReminders(pomodoro.timer);

  const toggleTimer = useCallback(() => {
    if (!pomodoro.timer.running && settings.completionSound) chime.unlock();
    pomodoro.toggle();
  }, [pomodoro.toggle, pomodoro.timer.running, settings.completionSound, chime.unlock]);

  const resetTimer = useCallback(() => {
    pomodoro.reset();
    notify('A fresh start. Take it at your own pace.');
  }, [pomodoro.reset, notify]);

  useEffect(() => {
    if (!tasks.some((task) => task.id === activeId && !task.done)) setActiveId(tasks.find((task) => !task.done)?.id ?? null);
  }, [tasks, activeId, setActiveId]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), toast.action ? 7500 : 5000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60000);
    const onHashChange = () => {
      const next = pageFromHash();
      if (next !== 'notes') notebook.lock();
      setPage(next);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => { window.clearInterval(interval); window.removeEventListener('hashchange', onHashChange); };
  }, [notebook.lock]);

  useEffect(() => {
    let lastWarning = 0;
    const warn = () => {
      if (Date.now() - lastWarning < 10000) return;
      lastWarning = Date.now();
      notify('Your device could not save the latest changes. Please free some storage before closing the app.');
    };
    window.addEventListener('pomodere:storage-error', warn);
    return () => window.removeEventListener('pomodere:storage-error', warn);
  }, [notify]);

  useEffect(() => {
    if (page !== 'notes') notebook.lock();
  }, [page, notebook.lock]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (page !== 'focus' || dialog || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]')) return;
      if (event.code === 'Space' && !target.closest('button, a')) { event.preventDefault(); toggleTimer(); }
      if (event.key.toLowerCase() === 'r') { event.preventDefault(); resetTimer(); }
      if (event.key.toLowerCase() === 'n') { event.preventDefault(); pomodoro.skip(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [page, dialog, toggleTimer, resetTimer, pomodoro.skip]);

  const navigate = (next: Page) => {
    if (next !== 'notes') notebook.lock();
    setPage(next);
    if (window.location.hash !== `#${next}`) window.location.hash = next;
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const saveSettings = (next: Settings) => {
    if (durationFor(pomodoro.timer.mode, next) !== pomodoro.timer.durationMinutes || next.longBreakEvery !== settings.longBreakEvery) pomodoro.reset(next);
    if (next.completionSound) chime.unlock();
    setSettings(next);
    setDialog(null);
    notify('Your rhythm, updated. Make yourself at home.');
  };

  const addTask = (title: string, estimate: number) => {
    const task: Task = { id: makeId(), title, estimate, completedSessions: 0, done: false };
    setTasks((previous) => [...previous, task]);
    if (!activeId) setActiveId(task.id);
  };

  const toggleTask = (id: string) => {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    setTasks((previous) => previous.map((item) => item.id === id ? { ...item, done: !item.done, completedAt: item.done ? undefined : Date.now() } : item));
    if (!task.done) notify('One less thing on your mind. Nicely done.');
  };

  const deleteTask = (id: string) => {
    const index = tasks.findIndex((task) => task.id === id);
    const removed = tasks[index];
    if (!removed) return;
    const wasActive = activeId === id;
    setTasks((previous) => previous.filter((task) => task.id !== id));
    notify('Task removed. A little more room.', { label: 'Undo', onClick: () => {
      setTasks((previous) => {
        if (previous.some((task) => task.id === id)) return previous;
        const restored = [...previous]; restored.splice(index, 0, removed); return restored;
      });
      if (wasActive) setActiveId(id);
      notify('Your task is back, right where you left it.');
    } });
  };

  const todaySessions = sessions.filter((session) => localDay(session.completedAt) === localDay(now)).length;
  const dateLabel = new Date(now).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <motion.header className="site-header" initial={{ opacity: 0, y: -7 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <div className="header-inner container">
            <Brand onClick={() => navigate('focus')} />
            <nav className="main-nav" aria-label="Main navigation">
              <a href="#focus" onClick={(event) => { event.preventDefault(); navigate('focus'); }} className={page === 'focus' ? 'nav-link active' : 'nav-link'} aria-current={page === 'focus' ? 'page' : undefined}><Clock3 size={16} strokeWidth={1.7} /><span>Focus space</span>{page === 'focus' && <motion.span className="nav-indicator" layoutId="nav-indicator" />}</a>
              <a href="#progress" onClick={(event) => { event.preventDefault(); navigate('progress'); }} className={page === 'progress' ? 'nav-link active' : 'nav-link'} aria-current={page === 'progress' ? 'page' : undefined}><ChartNoAxesCombined size={17} strokeWidth={1.7} /><span>Your progress</span>{page === 'progress' && <motion.span className="nav-indicator" layoutId="nav-indicator" />}</a>
              <a href="#notes" onClick={(event) => { event.preventDefault(); navigate('notes'); }} className={page === 'notes' ? 'nav-link active' : 'nav-link'} aria-current={page === 'notes' ? 'page' : undefined}><NotebookPen size={17} strokeWidth={1.7} /><span>Notes</span>{page === 'notes' && <motion.span className="nav-indicator" layoutId="nav-indicator" />}</a>
            </nav>
            <div className="header-actions"><SoundMenu sound={sound} volume={volume} error={audioError} onSoundChange={setSound} onVolumeChange={setVolume} /><span className="header-divider" /><button className="icon-button preferences-button" onClick={() => setDialog('settings')} aria-label="Open preferences" title="Your preferences"><Settings2 size={20} strokeWidth={1.6} /></button></div>
          </div>
        </motion.header>

        <AnimatePresence mode="wait" initial={true}>
          <motion.main key={page} className={`main-content container ${page}-page`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.32, ease: 'easeOut' }}>
            {page === 'focus' ? <>
              <div className="page-intro"><div><h1>A little focus goes <em>a long way.</em></h1><p>A calmer mind. A clearer day. One thing at a time.</p></div><div className="today-date"><Sun size={18} strokeWidth={1.5} /><span>{dateLabel}</span></div></div>
              <div className="focus-workspace">
                <Timer timer={pomodoro.timer} settings={settings} todaySessions={todaySessions} onToggle={toggleTimer} onModeChange={pomodoro.setMode} onReset={resetTimer} onSkip={pomodoro.skip} onEditGoal={() => setDialog('settings')} />
                <TaskList tasks={tasks} activeId={activeId} running={pomodoro.timer.running && pomodoro.timer.mode === 'focus'} onSelect={setActiveId} onAdd={addTask} onEdit={(id, title, estimate) => setTasks((previous) => previous.map((task) => task.id === id ? { ...task, title, estimate } : task))} onToggle={toggleTask} onDelete={deleteTask} />
              </div>
            </> : page === 'progress' ? <ProgressView sessions={sessions} tasks={tasks} settings={settings} now={now} onEditGoal={() => setDialog('settings')} onFocus={() => navigate('focus')} /> : <NotesView notebook={notebook} notify={notify} />}
          </motion.main>
        </AnimatePresence>

        <footer className="site-footer container"><p><TomatoMark small />A gentler kind of productive.</p><div><button className="shortcut-footer-button" onClick={() => setDialog('shortcuts')}><Keyboard size={14} strokeWidth={1.5} />Keyboard shortcuts</button><button onClick={() => setDialog('help')}><CircleHelp size={14} strokeWidth={1.6} />How it works<ArrowUpRight size={13} /></button></div></footer>
      </div>

      <AnimatePresence>
        {dialog === 'settings' && <SettingsDialog key="settings" settings={settings} reminders={reminders} onSave={saveSettings} onClose={() => setDialog(null)} />}
        {dialog === 'help' && <HelpDialog key="help" onClose={() => setDialog(null)} onStart={() => { setDialog(null); navigate('focus'); }} />}
        {dialog === 'shortcuts' && <ShortcutsDialog key="shortcuts" onClose={() => setDialog(null)} />}
      </AnimatePresence>

      <AnimatePresence>{toast && <motion.div className="toast" key={toast.id} role="status" initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.2 }}><span className="toast-check"><Check size={15} /></span><p>{toast.message}</p>{toast.action && <button className="toast-action" onClick={toast.action.onClick}>{toast.action.label}</button>}<button className="icon-button toast-close" aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={15} /></button></motion.div>}</AnimatePresence>
    </MotionConfig>
  );
}
