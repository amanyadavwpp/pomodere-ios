import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Ellipsis, Pencil, Plus, Trash2, X } from 'lucide-react';
import { TomatoMark } from './Brand';
import type { Task } from '../lib/model';

interface TaskListProps {
  tasks: Task[];
  activeId: string | null;
  running: boolean;
  onSelect: (id: string) => void;
  onAdd: (title: string, estimate: number) => void;
  onEdit: (id: string, title: string, estimate: number) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

function TaskEditor({ task, onSave, onCancel }: { task?: Task; onSave: (title: string, estimate: number) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [estimate, setEstimate] = useState(task?.estimate ?? 1);
  return (
    <motion.form className="task-editor" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} onSubmit={(event) => {
      event.preventDefault();
      if (title.trim()) onSave(title.trim(), estimate);
    }}>
      <label className="sr-only" htmlFor={`task-title-${task?.id ?? 'new'}`}>Task name</label>
      <input id={`task-title-${task?.id ?? 'new'}`} className="task-title-input" placeholder="What would you like to focus on?" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required autoFocus onKeyDown={(event) => { if (event.key === 'Escape') onCancel(); }} />
      <div className="task-editor-bottom">
        <label className="estimate-input">Sessions <input type="number" value={estimate} min="1" max="12" required aria-label="Estimated focus sessions" onChange={(event) => setEstimate(Number(event.target.value))} /></label>
        <div className="task-editor-actions"><button type="button" className="icon-button small-icon" onClick={onCancel} aria-label="Cancel task"><X size={17} /></button><button className="small-primary" disabled={!title.trim()}>{task ? 'Save' : 'Add task'}</button></div>
      </div>
    </motion.form>
  );
}

export function TaskList({ tasks, activeId, running, onSelect, onAdd, onEdit, onToggle, onDelete }: TaskListProps) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const unfinished = tasks.filter((task) => !task.done);
  const completed = tasks.filter((task) => task.done);

  useEffect(() => {
    if (!menu) return;
    const close = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('[data-task-menu]')) setMenu(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        document.getElementById(`task-options-${menu}`)?.focus();
        setMenu(null);
      }
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', escape);
    };
  }, [menu]);

  const renderTask = (task: Task) => (
    <motion.li key={task.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }} transition={{ duration: 0.22 }} className={`task-item ${task.id === activeId && !task.done ? 'active' : ''} ${task.done ? 'completed' : ''}`}>
      {editing === task.id ? <TaskEditor task={task} onCancel={() => setEditing(null)} onSave={(title, estimate) => { onEdit(task.id, title, estimate); setEditing(null); }} /> : <>
        <div className="task-row">
          <button className="task-checkbox" role="checkbox" aria-checked={task.done} aria-label={`Mark ${task.title} ${task.done ? 'incomplete' : 'complete'}`} onClick={() => onToggle(task.id)}>{task.done && <Check size={12} strokeWidth={2.5} />}</button>
          <button className="task-copy" onClick={() => !task.done && onSelect(task.id)} aria-label={task.done ? task.title : `Focus on ${task.title}. ${task.completedSessions} of ${task.estimate} planned sessions completed.`} disabled={task.done}>
            <span className="task-title">{task.title}</span>
            <span className="task-meta"><TomatoMark small /><span>{task.completedSessions} / {task.estimate}</span>{task.id === activeId && !task.done && <span className="task-active-label">{running ? 'FOCUSING' : 'UP NEXT'}</span>}</span>
          </button>
          <div className="task-menu-anchor" data-task-menu>
            <button id={`task-options-${task.id}`} className={`icon-button task-more ${menu === task.id ? 'is-open' : ''}`} aria-label={`Options for ${task.title}`} aria-expanded={menu === task.id} aria-haspopup="menu" aria-controls={menu === task.id ? `task-menu-${task.id}` : undefined} onClick={() => {
              const opening = menu !== task.id;
              setMenu(opening ? task.id : null);
              if (opening) requestAnimationFrame(() => document.getElementById(`task-menu-${task.id}`)?.querySelector<HTMLButtonElement>('button')?.focus());
            }}><Ellipsis size={19} /></button>
            <AnimatePresence>{menu === task.id && <motion.div id={`task-menu-${task.id}`} className="task-menu" role="menu" aria-label={`Options for ${task.title}`} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} onKeyDown={(event) => {
              if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
              const index = items.indexOf(document.activeElement as HTMLButtonElement);
              const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
              items[nextIndex]?.focus();
            }}>
              <button role="menuitem" onClick={() => { setEditing(task.id); setMenu(null); }}><Pencil size={14} />Edit task</button>
              <button role="menuitem" className="delete-action" onClick={() => { onDelete(task.id); setMenu(null); }}><Trash2 size={14} />Delete task</button>
            </motion.div>}</AnimatePresence>
          </div>
        </div>
      </>}
    </motion.li>
  );

  return (
    <section className="task-panel" aria-labelledby="task-heading">
      <div className="task-panel-heading"><h2 id="task-heading">A little plan.</h2><span className="task-count">{unfinished.length} {unfinished.length === 1 ? 'task' : 'tasks'}</span></div>
      <p className="section-description">Less on your mind. More in the moment.</p>

      <ul className="task-items"><AnimatePresence initial={false}>{unfinished.map(renderTask)}</AnimatePresence></ul>
      {unfinished.length === 0 && !adding && <div className="task-empty"><SproutDoodle /><p>{completed.length ? 'A little lighter already.' : 'A fresh page, just for you.'}</p><span>{completed.length ? 'Enjoy the space, or make room for something new.' : 'Add one small thing you want to make time for.'}</span></div>}

      {adding ? <TaskEditor onCancel={() => setAdding(false)} onSave={(title, estimate) => { onAdd(title, estimate); setAdding(false); }} /> : <button className="add-task-button" onClick={() => { setAdding(true); setEditing(null); }}><Plus size={17} strokeWidth={1.6} />Add a task</button>}

      {completed.length > 0 && <div className="completed-tasks"><button className="completed-toggle" onClick={() => setShowCompleted(!showCompleted)} aria-expanded={showCompleted}><ChevronDown size={14} className={showCompleted ? 'rotated' : ''} />Completed<span>{completed.length}</span></button><AnimatePresence>{showCompleted && <motion.ul className="task-items" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>{completed.map(renderTask)}</motion.ul>}</AnimatePresence></div>}

      <div className="growing-note">
        <div className="plant-illustration"><img src="/images/tomato-plant.png" alt="" aria-hidden="true" /></div>
        <div><p>Good things grow<br />a little at a time.</p><span>So does your focus.</span></div>
      </div>
    </section>
  );
}

function SproutDoodle() {
  return <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 28V13M16 20C7 20 5 14 5 10C13 10 16 13 16 20ZM16 14C16 6 23 4 28 4C27 12 23 15 16 14Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}