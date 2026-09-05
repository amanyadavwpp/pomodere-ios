import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Download, Eye, EyeOff, FileText, KeyRound, LoaderCircle, LockKeyhole, Plus, Save, Search, ShieldCheck, Trash2, Upload, X } from 'lucide-react';
import { Dialog } from './Dialogs';
import type { NotebookController } from '../hooks/useNotebook';
import { hasNotebookCrypto, MAX_NOTE_LENGTH, MAX_NOTES } from '../lib/notebookCrypto';
import type { Note, NotebookEnvelope } from '../lib/notebookCrypto';
import { exportNotebookBackup, readNotebookBackup } from '../lib/notebookBackup';
import { makeId } from '../lib/model';

interface NotesProps {
  notebook: NotebookController;
  notify: (message: string) => void;
}

function PasswordField({ label, value, onChange, autoComplete = 'current-password', disabled, minLength }: { label: string; value: string; onChange: (value: string) => void; autoComplete?: 'current-password' | 'new-password'; disabled?: boolean; minLength?: number }) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  useEffect(() => {
    const hide = () => setVisible(false);
    window.addEventListener('pomodere:lock', hide);
    return () => window.removeEventListener('pomodere:lock', hide);
  }, []);
  return <div className="password-field"><label htmlFor={id}>{label}</label><div><input id={id} type={visible ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} autoCapitalize="none" autoCorrect="off" spellCheck={false} required minLength={minLength} maxLength={256} disabled={disabled} /><button type="button" className="icon-button" onClick={() => setVisible(!visible)} aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} aria-pressed={visible} disabled={disabled}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>;
}

function NotebookGate({ notebook }: { notebook: NotebookController }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const supported = hasNotebookCrypto();
  const creating = !notebook.configured;

  useEffect(() => {
    const clear = () => { setPassword(''); setConfirmation(''); setError(null); };
    window.addEventListener('pomodere:lock', clear);
    return () => window.removeEventListener('pomodere:lock', clear);
  }, []);

  if (notebook.loadError) return <div className="notebook-gate"><LockKeyhole size={34} strokeWidth={1.2} /><h2>Let's keep your notes safe.</h2><p className="notebook-gate-description" role="alert">{notebook.loadError}</p><p className="note-security-caption">Use Restore backup below. Your existing saved data will not be replaced without your confirmation.</p></div>;

  return <motion.section className="notebook-gate" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} aria-labelledby="notebook-gate-heading">
    <div className="notebook-lock-drawing" aria-hidden="true"><span /><LockKeyhole size={35} strokeWidth={1.2} /><span /></div>
    <h2 id="notebook-gate-heading">{creating ? 'Some thoughts are just for you.' : 'Your thoughts. Under lock.'}</h2>
    <p className="notebook-gate-description">{creating ? 'Give your notebook a password. A quiet home for your ideas, plans, and everything in between.' : 'Enter your notebook password to pick up where you left off.'}</p>
    <form className="notebook-gate-form" onSubmit={async (event) => {
      event.preventDefault();
      setError(null);
      if (creating && password !== confirmation) { setError('Your passwords do not match. Try typing them again.'); return; }
      if (creating && !acknowledged) return;
      try {
        const opened = creating ? await notebook.create(password) : await notebook.unlock(password);
        if (opened) { setPassword(''); setConfirmation(''); }
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Your notebook could not be opened. Please try again.'); }
    }}>
      <PasswordField label={creating ? 'Choose a password' : 'Notebook password'} value={password} onChange={setPassword} autoComplete={creating ? 'new-password' : 'current-password'} minLength={creating ? 8 : undefined} disabled={notebook.busy || !supported} />
      {creating && <><p className="password-hint">At least 8 characters. A long, unique passphrase is best.</p><PasswordField label="Confirm password" value={confirmation} onChange={setConfirmation} autoComplete="new-password" minLength={8} disabled={notebook.busy || !supported} /><label className="notebook-acknowledgment"><input type="checkbox" required checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} disabled={notebook.busy} /><span>I understand that a forgotten password cannot be recovered.</span></label></>}
      {!supported && <p className="note-form-error" role="alert">Secure encryption is not available here. Open Pomodere over HTTPS or in the configured iOS app. Your notes will never be saved without encryption.</p>}
      {error && <p className="note-form-error" role="alert">{error}</p>}
      <button className="primary-button notebook-unlock" disabled={notebook.busy || !supported || !password || (creating && (!confirmation || !acknowledged))}>{notebook.busy ? <LoaderCircle className="spinning" size={17} /> : <LockKeyhole size={16} />}{notebook.busy ? 'Just a moment...' : creating ? 'Create my private notebook' : 'Unlock notebook'}{!notebook.busy && <ArrowRight size={16} />}</button>
    </form>
    {!creating && <><button className="forgot-password-button" onClick={() => setHelp(!help)} aria-expanded={help}>Forgot your password?</button>{help && <p className="password-recovery-note">There is no password reset or back door. Try your password manager, or restore a backup whose password you remember. You can export your current encrypted backup below to keep it safe.</p>}</>}
    <p className="note-security-caption"><ShieldCheck size={14} />Both titles and text are encrypted on this device.</p>
  </motion.section>;
}

function ChangePasswordDialog({ notebook, onClose, notify }: NotesProps & { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  return <Dialog title="A new little key." description="Your notes stay the same. Only their password changes." onClose={() => { if (!notebook.busy) onClose(); }} className="notebook-password-dialog"><form onSubmit={async (event) => {
    event.preventDefault(); setError(null);
    if (next !== confirmation) { setError('Your new passwords do not match.'); return; }
    try {
      if (await notebook.changePassword(current, next)) { onClose(); notify('Notebook password updated. Export a fresh backup when you can.'); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The password could not be changed.'); }
  }}><PasswordField label="Current password" value={current} onChange={setCurrent} disabled={notebook.busy} /><PasswordField label="New password" value={next} onChange={setNext} minLength={8} autoComplete="new-password" disabled={notebook.busy} /><PasswordField label="Confirm new password" value={confirmation} onChange={setConfirmation} minLength={8} autoComplete="new-password" disabled={notebook.busy} /><p className="password-hint">Use at least 8 characters. Older backups still need the password used when you exported them.</p>{error && <p className="note-form-error" role="alert">{error}</p>}<button className="primary-button notebook-unlock" disabled={notebook.busy}>{notebook.busy ? <LoaderCircle size={16} className="spinning" /> : <KeyRound size={16} />}{notebook.busy ? 'Updating password...' : 'Save new password'}</button></form></Dialog>;
}

function RestoreNotebookDialog({ notebook, backup, onClose, notify }: NotesProps & { backup: NotebookEnvelope; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const replacing = notebook.configured || Boolean(notebook.loadError);
  useEffect(() => {
    const clear = () => setPassword('');
    window.addEventListener('pomodere:lock', clear);
    return () => window.removeEventListener('pomodere:lock', clear);
  }, []);
  return <Dialog title="Bring your thoughts along." description="Enter the password used for this encrypted backup. We will check it before changing anything." onClose={() => { if (!notebook.busy) onClose(); }} className="notebook-password-dialog"><form onSubmit={async (event) => {
    event.preventDefault(); setError(null);
    if (replacing && !confirmed) return;
    try {
      if (await notebook.restore(backup, password)) { onClose(); notify('Your notebook is restored on this device.'); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'This backup could not be restored.'); }
  }}><PasswordField label="Backup password" value={password} onChange={setPassword} disabled={notebook.busy} />{replacing && <label className="notebook-acknowledgment restore-warning"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} required disabled={notebook.busy} /><span>Replace the entire notebook on this device. I have exported anything I want to keep. This cannot be undone.</span></label>}{error && <p className="note-form-error" role="alert">{error}</p>}<button className="primary-button notebook-unlock" disabled={notebook.busy || !password || (replacing && !confirmed)}>{notebook.busy ? <LoaderCircle size={16} className="spinning" /> : <Upload size={16} />}{notebook.busy ? 'Checking your backup...' : 'Restore notebook'}</button></form></Dialog>;
}

export function NotesView({ notebook, notify }: NotesProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [changePassword, setChangePassword] = useState(false);
  const [backup, setBackup] = useState<NotebookEnvelope | null>(null);
  const [deleting, setDeleting] = useState<Note | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const selected = notebook.notes.find((note) => note.id === selectedId) ?? notebook.notes[0] ?? null;
  const filtered = [...notebook.notes].filter((note) => `${note.title}\n${note.body}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())).sort((left, right) => right.updatedAt - left.updatedAt);
  const wordCount = selected?.body.trim() ? selected.body.trim().split(/\s+/).length : 0;

  useEffect(() => {
    if (notebook.locked) { setChangePassword(false); setDeleting(null); setSearch(''); setSelectedId(null); setEditorOpen(false); }
  }, [notebook.locked]);

  const newNote = () => {
    if (notebook.notes.length >= MAX_NOTES) { notify('Your notebook has 50 notes. Remove one to make a little room.'); return; }
    const note: Note = { id: makeId(), title: '', body: '', createdAt: Date.now(), updatedAt: Date.now() };
    if (notebook.updateNotes([note, ...notebook.notes])) { setSelectedId(note.id); setEditorOpen(true); setSearch(''); }
  };

  const updateSelected = (field: 'title' | 'body', value: string) => {
    if (selected) notebook.updateNotes(notebook.notes.map((note) => note.id === selected.id ? { ...note, [field]: value, updatedAt: Date.now() } : note));
  };

  const saveNote = async () => {
    try { await notebook.save(); notify('A little thought, safely saved.'); } catch { /* The editor displays the actionable save error. */ }
  };

  return <>
    <div className="page-intro notes-intro"><div><h1>A little space <em>for your thoughts.</em></h1><p>Put it on paper. Keep it just for you.</p></div>{!notebook.locked && <button className="notebook-lock-button" onClick={notebook.lock} disabled={notebook.busy}><LockKeyhole size={16} />Lock notebook</button>}</div>
    <div className="notes-private">
      {notebook.saveError && <div className="notebook-save-error" role="alert"><p>{notebook.saveError}</p>{!notebook.locked && <button onClick={() => void saveNote()}>Retry saving</button>}</div>}
      {notebook.locked ? <NotebookGate key={notebook.configured ? 'unlock' : 'create'} notebook={notebook} /> : <div className={`notebook-layout ${editorOpen ? 'mobile-editor-open' : ''}`}>
        <aside className="notebook-sidebar" aria-label="Saved notes"><div className="notebook-sidebar-heading"><h2>Your little notebook<span>{notebook.notes.length}</span></h2><button className="icon-button" onClick={newNote} aria-label="Create a new note" disabled={notebook.busy}><Plus size={20} strokeWidth={1.6} /></button></div>
          <label className="note-search"><Search size={16} strokeWidth={1.6} /><span className="sr-only">Search your notes</span><input type="search" placeholder="Find a thought..." value={search} onChange={(event) => setSearch(event.target.value)} autoComplete="off" />{search && <button className="icon-button" aria-label="Clear note search" onClick={() => setSearch('')}><X size={14} /></button>}</label>
          <ul className="note-list">{filtered.map((note) => <li key={note.id}><button className={selected?.id === note.id ? 'note-list-item selected' : 'note-list-item'} onClick={() => { setSelectedId(note.id); setEditorOpen(true); }} aria-pressed={selected?.id === note.id} disabled={notebook.busy}><span className="note-list-title">{note.title.trim() || 'Untitled thought'}</span><span className="note-list-preview">{note.body.trim() || 'A fresh page, ready for you.'}</span><time dateTime={new Date(note.updatedAt).toISOString()}>{new Date(note.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></button></li>)}</ul>
          {filtered.length === 0 && <p className="note-list-empty">{search ? 'No thoughts found. Try a different word.' : 'Your first little thought belongs here.'}</p>}
          <button className="add-task-button new-note-button" onClick={newNote} disabled={notebook.busy || notebook.notes.length >= MAX_NOTES}><Plus size={17} />New note</button>
          <p className="notebook-sidebar-footnote"><LockKeyhole size={13} />Your words stay on this device.</p>
        </aside>
        <section className="note-editor" aria-label="Note editor" onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void saveNote(); }
        }}>
          {selected ? <>
            <div className="note-editor-toolbar"><button className="icon-button note-back-button" onClick={() => setEditorOpen(false)} aria-label="Back to your notes"><ArrowLeft size={20} /></button><span className={`note-save-state ${notebook.saveStatus}`} role="status">{notebook.saveStatus === 'saving' ? <LoaderCircle size={13} className="spinning" /> : notebook.saveStatus === 'error' ? <Save size={13} /> : <Check size={13} />}{notebook.saveStatus === 'saving' ? 'Saving securely...' : notebook.saveStatus === 'error' ? 'Not saved yet' : 'Saved & encrypted'}</span><div><button className="icon-button" onClick={() => setDeleting(selected)} aria-label="Delete this note" disabled={notebook.busy}><Trash2 size={17} strokeWidth={1.6} /></button><button className="note-save-button" onClick={() => void saveNote()} disabled={notebook.busy}><Save size={15} />Save<span className="save-note-word"> note</span></button></div></div>
            <label className="sr-only" htmlFor="note-title">Note title</label><input id="note-title" className="note-title-field" placeholder="A little thought..." value={selected.title} onChange={(event) => updateSelected('title', event.target.value)} maxLength={120} autoComplete="off" disabled={notebook.busy} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); document.getElementById('note-body')?.focus(); } }} />
            <label className="sr-only" htmlFor="note-body">Note text</label><textarea id="note-body" className="note-body-field" placeholder="An idea, a reminder, a little something to come back to. Start anywhere." value={selected.body} onChange={(event) => updateSelected('body', event.target.value)} maxLength={MAX_NOTE_LENGTH} disabled={notebook.busy} spellCheck={false} autoCorrect="off" />
            <div className="note-editor-footer"><span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span><span>{selected.body.length.toLocaleString()} / {MAX_NOTE_LENGTH.toLocaleString()}</span></div>
          </> : <div className="notebook-empty"><FileText size={38} strokeWidth={1.1} /><h2>Make a little room.</h2><p>No perfect words needed.<br />Just a thought you want to keep.</p><button className="primary-button" onClick={newNote} disabled={notebook.busy}>Write your first note<ArrowRight size={16} /></button></div>}
        </section>
      </div>}
      {!notebook.locked && <div className="notebook-privacy-line"><p><ShieldCheck size={14} />Locks when you leave Notes, switch apps, or are inactive for 5 minutes.</p><button onClick={() => setChangePassword(true)} disabled={notebook.busy}><KeyRound size={14} />Change password</button></div>}
    </div>
    <div className="notebook-backups"><div><h3>A little peace of mind.</h3><p>Moving to your iPhone? Take an encrypted backup with you.</p></div><div className="notebook-backup-actions">{notebook.configured && <button onClick={async () => {
      setBackupBusy(true); setBackupError(null);
      try { await exportNotebookBackup(await notebook.getBackup()); }
      catch (cause) { if (!(cause instanceof DOMException && cause.name === 'AbortError')) setBackupError('The backup could not be exported. If you closed the share sheet, try again when you are ready. Otherwise, save your notes and retry.'); }
      finally { setBackupBusy(false); }
    }} disabled={backupBusy || notebook.busy}>{backupBusy ? <LoaderCircle size={15} className="spinning" /> : <Download size={15} />}Export backup</button>}<button onClick={() => fileRef.current?.click()} disabled={backupBusy || notebook.busy}><Upload size={15} />Restore backup</button><input className="sr-only" type="file" accept=".json,application/json" tabIndex={-1} ref={fileRef} aria-label="Choose an encrypted notebook backup" onChange={async (event) => {
      const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
      setBackupError(null);
      try { setBackup(await readNotebookBackup(file)); }
      catch (cause) { setBackupError(cause instanceof Error ? cause.message : 'This file could not be read.'); }
    }} /></div>{backupError && <p className="note-form-error backup-error" role="alert">{backupError}</p>}</div>
    <p className="notebook-storage-note">No account or cloud sync. Keep a backup: uninstalling the app or clearing its data removes your notebook.</p>
    <AnimatePresence>
      {changePassword && !notebook.locked && <ChangePasswordDialog key="password" notebook={notebook} notify={notify} onClose={() => setChangePassword(false)} />}
      {backup && <RestoreNotebookDialog key="restore" notebook={notebook} backup={backup} notify={notify} onClose={() => setBackup(null)} />}
      {deleting && !notebook.locked && <Dialog key="delete" title="Let this thought go?" description="This note will be permanently removed from your notebook. There is no undo." onClose={() => setDeleting(null)} className="delete-note-dialog"><div className="confirm-note-actions"><button className="secondary-button" onClick={() => setDeleting(null)}>Keep note</button><button className="primary-button" onClick={() => {
        if (notebook.updateNotes(notebook.notes.filter((note) => note.id !== deleting.id))) { setDeleting(null); if (selected?.id === deleting.id) { setSelectedId(null); setEditorOpen(false); } void notebook.save().then(() => notify('A little more room in your notebook.')).catch(() => undefined); }
      }} disabled={notebook.busy}><Trash2 size={15} />Delete note</button></div></Dialog>}
    </AnimatePresence>
  </>;
}