import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Clock3, Pencil, Sprout } from 'lucide-react';
import { localDay } from '../lib/model';
import type { FocusSession, Settings, Task } from '../lib/model';

interface ProgressProps {
  sessions: FocusSession[];
  tasks: Task[];
  settings: Settings;
  now: number;
  onEditGoal: () => void;
  onFocus: () => void;
}

export function ProgressView({ sessions, tasks, settings, now, onEditGoal, onFocus }: ProgressProps) {
  const [range, setRange] = useState<7 | 30>(7);
  const [selectedDay, setSelectedDay] = useState(localDay(now));
  const days = useMemo(() => Array.from({ length: range }, (_, index) => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - range + index + 1);
    const key = localDay(date);
    const daySessions = sessions.filter((session) => localDay(session.completedAt) === key);
    return { date, key, sessions: daySessions, minutes: daySessions.reduce((total, session) => total + session.minutes, 0) };
  }), [range, now, sessions]);
  const total = days.reduce((minutes, day) => minutes + day.minutes, 0);
  const max = Math.max(60, ...days.map((day) => day.minutes));
  const todaySessions = sessions.filter((session) => localDay(session.completedAt) === localDay(now));
  const todayProgress = Math.min(1, todaySessions.length / settings.dailyGoal);
  const selected = days.find((day) => day.key === selectedDay) ?? days[days.length - 1];
  const completedTasks = tasks.filter((task) => task.done && task.completedAt && localDay(task.completedAt) === localDay(now)).length;

  return <>
    <div className="page-intro progress-intro"><div><h1>Little by little, <em>look at you grow.</em></h1><p>Not about doing more. About making time for what matters.</p></div><button className="text-button back-to-focus" onClick={onFocus}>Back to focus<ArrowRight size={16} /></button></div>
    <div className="progress-layout">
      <section className="history-section" aria-labelledby="history-heading">
        <div className="history-heading"><h2 id="history-heading">Time, well spent.</h2><div className="range-tabs" aria-label="Progress date range"><button aria-pressed={range === 7} className={range === 7 ? 'selected' : ''} onClick={() => { setRange(7); setSelectedDay(localDay(now)); }}>This week</button><button aria-pressed={range === 30} className={range === 30 ? 'selected' : ''} onClick={() => setRange(30)}>30 days</button></div></div>
        <div className="focus-total"><strong>{total >= 60 ? Math.floor(total / 60) : total}</strong><span>{total >= 60 ? `h ${total % 60 ? `${total % 60} min` : ''}` : 'min'}<small>of uninterrupted possibility</small></span></div>
        <div className={`bar-chart ${range === 30 ? 'month-chart' : ''}`} role="group" aria-label={`Completed focus minutes over the last ${range} days`}>
          <div className="chart-grid" aria-hidden="true"><span>{max}m</span><span>{Math.round(max / 2)}m</span><span>0</span></div>
          <div className="chart-bars">{days.map((day, index) => <button key={day.key} className={`chart-day ${selected.key === day.key ? 'selected' : ''}`} onClick={() => setSelectedDay(day.key)} aria-label={`${day.date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}: ${day.minutes} focus minutes, ${day.sessions.length} sessions`} aria-pressed={selected.key === day.key} title={`${day.minutes} minutes`}><span className="bar-column"><motion.span className={`chart-bar ${day.minutes === 0 ? 'empty-bar' : ''}`} initial={{ height: 3 }} animate={{ height: Math.max(3, day.minutes / max * 170) }} transition={{ duration: 0.5, delay: index * 0.015 }} /></span><span className="chart-day-label">{range === 7 ? day.date.toLocaleDateString(undefined, { weekday: 'short' }) : index % 5 === 0 || index === 29 ? day.date.getDate() : ''}</span></button>)}</div>
        </div>
        <div className="selected-day-summary"><span>{selected.key === localDay(now) ? 'Today' : selected.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span><p><strong>{selected.minutes} minutes</strong> in {selected.sessions.length} {selected.sessions.length === 1 ? 'session' : 'sessions'}</p></div>
        {selected.sessions.length > 0 ? <ul className="session-history">{[...selected.sessions].reverse().map((session) => <li key={session.id}><span className="session-history-icon"><Check size={15} /></span><span>{tasks.find((task) => task.id === session.taskId)?.title ?? 'A little focused time'}<small>{new Date(session.completedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</small></span><strong>{session.minutes} min</strong></li>)}</ul> : <div className="history-empty"><Clock3 size={20} strokeWidth={1.4} /><p>{total === 0 ? 'Your next little session starts the story.' : 'A little breathing room. No sessions on this day.'}</p>{total === 0 && <button onClick={onFocus}>Make a little time<ArrowRight size={14} /></button>}</div>}
      </section>
      <aside className="daily-goal-panel"><div className="goal-heading"><Sprout size={19} strokeWidth={1.6} /><h2>Your daily rhythm</h2><button className="icon-button" onClick={onEditGoal} aria-label="Edit daily focus goal"><Pencil size={15} /></button></div><div className="goal-ring"><svg viewBox="0 0 180 180" fill="none" aria-hidden="true"><circle cx="90" cy="90" r="77" stroke="#e9e6db" strokeWidth="5" /><motion.circle cx="90" cy="90" r="77" stroke="#84916e" strokeWidth="5" strokeLinecap="round" strokeDasharray={484} initial={false} animate={{ strokeDashoffset: 484 * (1 - todayProgress) }} transform="rotate(-90 90 90)" /></svg><div><strong>{todaySessions.length}<span> / {settings.dailyGoal}</span></strong><span>sessions today</span></div></div><p className="goal-message">{todayProgress >= 1 ? 'Look at that. A little promise, kept.' : 'An intention, not an obligation.'}</p><p className="completed-task-note"><Check size={15} />{completedTasks} {completedTasks === 1 ? 'task' : 'tasks'} off your mind today</p><img className="progress-plant" src="/images/tomato-plant.png" alt="A tomato plant growing, one little tomato at a time" /><p className="progress-plant-caption">Progress has its own pace.</p></aside>
    </div>
  </>;
}