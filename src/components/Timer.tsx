import { motion } from 'framer-motion';
import { Pause, Play, RotateCcw, SkipForward, Sprout } from 'lucide-react';
import { formatTime, MODE_LABELS } from '../lib/model';
import type { Settings, TimerMode } from '../lib/model';
import type { TimerState } from '../hooks/usePomodoro';

interface TimerProps {
  timer: TimerState;
  settings: Settings;
  todaySessions: number;
  onToggle: () => void;
  onModeChange: (mode: TimerMode) => void;
  onReset: () => void;
  onSkip: () => void;
  onEditGoal: () => void;
}

export function Timer({ timer, settings, todaySessions, onToggle, onModeChange, onReset, onSkip, onEditGoal }: TimerProps) {
  const modes: TimerMode[] = ['focus', 'short', 'long'];
  const radius = 143;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, timer.remaining / (timer.durationMinutes * 60));
  const angle = -Math.PI / 2 + progress * Math.PI * 2;
  const isResuming = timer.remaining < timer.durationMinutes * 60;
  const actionLabel = timer.running ? 'Pause' : isResuming ? 'Resume' : timer.mode === 'focus' ? 'Start focus' : 'Start break';
  const message = timer.mode === 'focus' ? 'Time to focus' : timer.mode === 'short' ? 'Take a little breather' : 'You have earned a little rest';

  return (
    <div className="timer-column">
      <section className={`timer-surface mode-${timer.mode} ${timer.running ? 'is-running' : ''}`} aria-label="Pomodoro timer">
        <div className="mode-tabs" role="tablist" aria-label="Timer mode">
          {modes.map((mode, index) => (
            <button key={mode} role="tab" id={`tab-${mode}`} tabIndex={timer.mode === mode ? 0 : -1} aria-selected={timer.mode === mode} aria-controls="timer-panel" className={timer.mode === mode ? 'mode-tab selected' : 'mode-tab'} onClick={() => onModeChange(mode)} onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
              onModeChange(modes[nextIndex]);
              document.getElementById(`tab-${modes[nextIndex]}`)?.focus();
            }}>
              {timer.mode === mode && <motion.span className="mode-tab-bg" layoutId="mode-indicator" transition={{ type: 'spring', stiffness: 360, damping: 32 }} />}
              <span>{MODE_LABELS[mode]}</span>
            </button>
          ))}
        </div>

        <div id="timer-panel" role="tabpanel" aria-labelledby={`tab-${timer.mode}`}>
          <div className="clock">
            <svg className="clock-ring" viewBox="0 0 310 310" fill="none" aria-hidden="true">
              <circle className="clock-track" cx="155" cy="155" r={radius} strokeWidth="2.5" />
              <circle className="clock-progress" cx="155" cy="155" r={radius} strokeWidth="3" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} transform="rotate(-90 155 155)" />
              <circle className="clock-endpoint-halo" cx={155 + radius * Math.cos(angle)} cy={155 + radius * Math.sin(angle)} r="8" />
              <circle className="clock-endpoint" cx={155 + radius * Math.cos(angle)} cy={155 + radius * Math.sin(angle)} r="4.5" />
              {[0, 1, 2, 3].map((tick) => <path key={tick} className="clock-tick" d="M155 28V34" strokeWidth="1.3" strokeLinecap="round" transform={`rotate(${tick * 90} 155 155)`} />)}
            </svg>
            <div className="clock-content">
              <span className="session-label">{timer.mode === 'focus' ? `SESSION ${Math.min(timer.cycle + 1, settings.longBreakEvery)} OF ${settings.longBreakEvery}` : timer.mode === 'short' ? 'A MOMENT FOR YOU' : 'TIME TO RECHARGE'}</span>
              <span className="clock-time" role="timer" aria-label={`${Math.floor(timer.remaining / 60)} minutes and ${timer.remaining % 60} seconds remaining`} aria-live="off">{formatTime(timer.remaining)}</span>
              <span className="clock-message"><span className="timer-status-dot" />{message}</span>
            </div>
          </div>

          <div className="timer-actions">
            <button className="icon-button timer-secondary" onClick={onReset} aria-label="Reset current timer" title="Reset timer (R)"><RotateCcw size={19} strokeWidth={1.7} /></button>
            <motion.button className="start-button" onClick={onToggle} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
              {timer.running ? <Pause size={18} fill="currentColor" strokeWidth={0} /> : <Play size={17} fill="currentColor" strokeWidth={0} />}
              {actionLabel}
            </motion.button>
            <button className="icon-button timer-secondary" onClick={onSkip} aria-label="Skip to the next session without recording progress" title="Skip session (N)"><SkipForward size={20} strokeWidth={1.7} /></button>
          </div>
          <p className="keyboard-hint"><kbd>space</kbd> to start or pause</p>
        </div>
      </section>

      <div className="daily-progress">
        <div className="daily-progress-top">
          <span className="daily-progress-label"><Sprout size={17} strokeWidth={1.7} /> A little progress, every day.</span>
          <button className="goal-button" onClick={onEditGoal} title="Change your daily goal"><strong>{todaySessions}</strong> / {settings.dailyGoal} sessions<span className="goal-today"> today</span></button>
        </div>
        <div className="daily-progress-track" role="progressbar" aria-label="Daily focus goal" aria-valuemin={0} aria-valuemax={settings.dailyGoal} aria-valuenow={Math.min(todaySessions, settings.dailyGoal)}>
          <motion.div initial={false} animate={{ width: `${Math.min(100, todaySessions / settings.dailyGoal * 100)}%` }} transition={{ duration: 0.7, ease: 'easeOut' }} />
        </div>
      </div>
    </div>
  );
}