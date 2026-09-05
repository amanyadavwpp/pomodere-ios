import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Coffee, LockKeyhole, Minus, Plus, Sprout, Timer, X } from 'lucide-react';
import type { Settings } from '../lib/model';
import { DevicePreferences } from './DevicePreferences';
import type { NativeReminderController } from '../hooks/useNativeReminders';

export function Dialog({ title, description, onClose, children, className = '' }: { title: string; description?: string; onClose: () => void; children: ReactNode; className?: string }) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]') ?? []);
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key !== 'Tab') return;
      const elements = focusable();
      if (!elements.length) { event.preventDefault(); return; }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, []);

  return createPortal(
    <motion.div className="dialog-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <motion.div className={`dialog ${className}`} ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} initial={{ opacity: 0, y: 16, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.985 }} transition={{ duration: 0.22 }}>
        <button className="icon-button dialog-close" onClick={onClose} aria-label="Close dialog"><X size={20} /></button>
        <h2 id={titleId}>{title}</h2>
        {description && <p className="dialog-description" id={descriptionId}>{description}</p>}
        {children}
      </motion.div>
    </motion.div>,
    document.body,
  );
}

function Toggle({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="preference-row"><span><span className="preference-label">{label}</span>{description && <span className="preference-description">{description}</span>}</span><span className="switch"><input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className="switch-track" /></span></label>;
}

export function SettingsDialog({ settings, reminders, onSave, onClose }: { settings: Settings; reminders: NativeReminderController; onSave: (settings: Settings) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(settings);
  const timingChanged = draft.focusMinutes !== settings.focusMinutes || draft.shortBreakMinutes !== settings.shortBreakMinutes || draft.longBreakMinutes !== settings.longBreakMinutes || draft.longBreakEvery !== settings.longBreakEvery;
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => setDraft((previous) => ({ ...previous, [key]: value }));
  return (
    <Dialog title="Find your rhythm." description="A few little adjustments to make this space yours." onClose={onClose} className="settings-dialog">
      <form onSubmit={(event) => { event.preventDefault(); onSave(draft); }}>
        <div className="settings-section"><h3>TIME, YOUR WAY <span>in minutes</span></h3><div className="duration-inputs">
          <label>Focus<input type="number" min="1" max="120" required value={draft.focusMinutes} onChange={(event) => update('focusMinutes', Number(event.target.value))} /></label>
          <label>Short break<input type="number" min="1" max="60" required value={draft.shortBreakMinutes} onChange={(event) => update('shortBreakMinutes', Number(event.target.value))} /></label>
          <label>Long break<input type="number" min="1" max="60" required value={draft.longBreakMinutes} onChange={(event) => update('longBreakMinutes', Number(event.target.value))} /></label>
        </div></div>
        <div className="settings-section rhythm-section"><h3>A LITTLE STRUCTURE</h3>
          <label className="preference-row"><span className="preference-label">Long break after</span><span className="select-with-unit"><select value={draft.longBreakEvery} onChange={(event) => update('longBreakEvery', Number(event.target.value))}>{[2, 3, 4, 5, 6, 8].map((number) => <option value={number} key={number}>{number}</option>)}</select><span>sessions</span></span></label>
          <div className="preference-row"><span><span className="preference-label">Daily focus goal</span><span className="preference-description">An intention, not an obligation.</span></span><div className="number-stepper"><button type="button" aria-label="Decrease daily goal" disabled={draft.dailyGoal <= 1} onClick={() => update('dailyGoal', draft.dailyGoal - 1)}><Minus size={14} /></button><output aria-label="Daily goal in sessions">{draft.dailyGoal}</output><button type="button" aria-label="Increase daily goal" disabled={draft.dailyGoal >= 20} onClick={() => update('dailyGoal', draft.dailyGoal + 1)}><Plus size={14} /></button></div></div>
        </div>
        <div className="settings-section"><h3>KEEP THE FLOW</h3>
          <Toggle label="Auto-start breaks" description="Ease straight into a little rest." checked={draft.autoStartBreaks} onChange={(value) => update('autoStartBreaks', value)} />
          <Toggle label="Auto-start focus sessions" checked={draft.autoStartFocus} onChange={(value) => update('autoStartFocus', value)} />
          <Toggle label="A gentle chime while the app is open" checked={draft.completionSound} onChange={(value) => update('completionSound', value)} />
        </div>
        <DevicePreferences reminders={reminders} />
        {timingChanged && <p className="timing-change-note">Changing the current session's length or break rhythm will reset its timer.</p>}
        <div className="settings-footer"><span><LockKeyhole size={12} />Saved only on this device</span><button type="submit" className="primary-button">Save preferences<CheckIcon /></button></div>
      </form>
    </Dialog>
  );
}

function CheckIcon() { return <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>; }

export function HelpDialog({ onClose, onStart }: { onClose: () => void; onStart: () => void }) {
  return (
    <Dialog title="A rhythm, not a race." description="Meet the Pomodoro technique. A simple way to give your attention a little breathing room." onClose={onClose} className="help-dialog">
      <div className="how-steps">
        <div><span className="how-icon"><Sprout size={23} strokeWidth={1.5} /></span><div><h3>One small intention.</h3><p>Add a task and select it from your list. It doesn't need to be big. It just needs to be one thing.</p></div></div>
        <div><span className="how-icon"><Timer size={23} strokeWidth={1.5} /></span><div><h3>A little uninterrupted time.</h3><p>Start a 25-minute focus session. Put the other tabs, notifications, and to-dos aside for a moment.</p></div></div>
        <div><span className="how-icon"><Coffee size={23} strokeWidth={1.5} /></span><div><h3>Room to come up for air.</h3><p>Take a 5-minute break. After four focus sessions, enjoy a longer 15-minute rest. Then find your flow again.</p></div></div>
      </div>
      <p className="help-footnote">Make it your own in preferences. Only finished focus sessions count toward your progress; skipping a session never adds time.</p>
      <button className="primary-button help-cta" onClick={onStart}>Let's make a little space<ArrowRight size={16} /></button>
      <p className="privacy-note"><LockKeyhole size={12} />Your data stays on this device. No account, no noise.</p>
    </Dialog>
  );
}

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return <Dialog title="Stay in the flow." description="A few shortcuts, so your hands can stay right where they are." onClose={onClose} className="shortcuts-dialog"><dl className="shortcuts-list"><div><dt>Start or pause the timer</dt><dd><kbd>space</kbd></dd></div><div><dt>Reset the current session</dt><dd><kbd>R</kbd></dd></div><div><dt>Skip to the next session</dt><dd><kbd>N</kbd></dd></div><div><dt>Close a dialog</dt><dd><kbd>esc</kbd></dd></div></dl><p className="help-footnote">Timer shortcuts work in your focus space, whenever you're not typing in a field or using another control.</p></Dialog>;
}