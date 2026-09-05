import { useCallback, useEffect, useRef, useState } from 'react';
import { createNotebookKey, decryptNotebook, encryptNotebook, isNoteList, isNotebookEnvelope } from '../lib/notebookCrypto';
import type { Note, NotebookEnvelope, NotebookKey } from '../lib/notebookCrypto';
import { persistRawStorage, readRawStorage } from '../lib/storage';
import { isAppActive } from '../lib/lifecycle';

const STORAGE_KEY = 'notes-vault';
const SAVE_ERROR = 'Your latest changes could not be saved. Unlock if needed, then retry saving before closing the app.';
const CHANGED_ERROR = 'This notebook changed in another window. Export a backup of these edits, then reload to open the currently saved notebook.';

function loadNotebook(): { envelope: NotebookEnvelope | null; error: string | null; raw: string | null } {
  let raw: string | null = null;
  try {
    raw = readRawStorage(STORAGE_KEY);
    if (!raw) return { envelope: null, error: null, raw };
    const parsed: unknown = JSON.parse(raw);
    if (!isNotebookEnvelope(parsed)) throw new Error('Invalid notebook');
    return { envelope: parsed, error: null, raw };
  } catch {
    return { envelope: null, error: 'Your saved notebook could not be read. It has not been changed. Try reopening the app, or restore a valid encrypted backup.', raw };
  }
}

export function useNotebook() {
  const [initial] = useState(loadNotebook);
  const [envelope, setEnvelope] = useState(initial.envelope);
  const [loadError, setLoadError] = useState(initial.error);
  const [notes, setNotes] = useState<Note[]>([]);
  const [locked, setLocked] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);
  const notesRef = useRef<Note[]>([]);
  const keyRef = useRef<NotebookKey | null>(null);
  const envelopeRef = useRef(envelope);
  const storedRaw = useRef(initial.raw);
  const revision = useRef(0);
  const savedRevision = useRef(0);
  const generation = useRef(0);
  const busyRef = useRef(false);
  const saveTimeout = useRef<number | null>(null);
  const writes = useRef<Promise<NotebookEnvelope | null>>(Promise.resolve(envelope));
  const recovery = useRef<{ notes: Note[]; salt: string; revision: number } | null>(null);

  const clearSaveTimeout = useCallback(() => {
    if (saveTimeout.current !== null) window.clearTimeout(saveTimeout.current);
    saveTimeout.current = null;
  }, []);

  const persistEnvelope = useCallback(async (sealed: NotebookEnvelope) => {
    const expected = storedRaw.current;
    const raw = JSON.stringify(sealed);
    const persist = async () => {
      // Never silently replace a notebook or password changed in another browser window.
      if (readRawStorage(STORAGE_KEY) !== expected) throw new Error(CHANGED_ERROR);
      await persistRawStorage(STORAGE_KEY, raw);
      storedRaw.current = raw;
    };
    if (navigator.locks) await navigator.locks.request('pomodere-notebook-storage', persist);
    else await persist();
  }, []);

  const queueSave = useCallback((snapshot: Note[], material: NotebookKey, version: number) => {
    const job = writes.current.catch(() => null).then(async () => {
      if (version <= savedRevision.current && envelopeRef.current?.salt === material.salt) return envelopeRef.current;
      const sealed = await encryptNotebook(snapshot, material);
      await persistEnvelope(sealed);
      envelopeRef.current = sealed;
      setEnvelope(sealed);
      savedRevision.current = Math.max(savedRevision.current, version);
      if (recovery.current?.salt === material.salt && recovery.current.revision <= version) recovery.current = null;
      if (version === revision.current) { setSaveStatus('saved'); setSaveError(null); }
      return sealed;
    }).catch((cause) => {
      const message = cause instanceof Error && cause.message === CHANGED_ERROR ? CHANGED_ERROR : SAVE_ERROR;
      if (version === revision.current) { setSaveStatus('error'); setSaveError(message); }
      throw new Error(message);
    });
    writes.current = job;
    return job;
  }, [persistEnvelope]);

  const save = useCallback(async () => {
    clearSaveTimeout();
    const material = keyRef.current;
    if (!material) return writes.current;
    setSaveStatus('saving');
    try {
      const result = await queueSave(notesRef.current, material, revision.current);
      if (savedRevision.current === revision.current) { setSaveStatus('saved'); setSaveError(null); }
      return result;
    } catch {
      throw new Error(SAVE_ERROR);
    }
  }, [clearSaveTimeout, queueSave]);

  const lock = useCallback(() => {
    generation.current += 1;
    document.documentElement.classList.add('notebook-locked');
    clearSaveTimeout();
    const material = keyRef.current;
    const snapshot = notesRef.current;
    keyRef.current = null;
    notesRef.current = [];
    setNotes([]);
    setLocked(true);
    if (material && revision.current > savedRevision.current) {
      // Hide immediately; only encrypted data is written. A failed save remains recoverable in memory after authentication.
      recovery.current = { notes: snapshot, salt: material.salt, revision: revision.current };
      void queueSave(snapshot, material, revision.current).catch(() => undefined);
    }
  }, [clearSaveTimeout, queueSave]);

  const updateNotes = useCallback((next: Note[]) => {
    if (!keyRef.current || busyRef.current) return false;
    if (!isNoteList(next)) { setSaveError('This notebook has reached its text limit. Shorten a note or delete one before adding more.'); return false; }
    notesRef.current = next;
    setNotes(next);
    revision.current += 1;
    setSaveStatus('saving');
    setSaveError(null);
    clearSaveTimeout();
    const material = keyRef.current;
    const version = revision.current;
    saveTimeout.current = window.setTimeout(() => { void queueSave(next, material, version).catch(() => undefined); }, 350);
    return true;
  }, [clearSaveTimeout, queueSave]);

  const beginAuthentication = useCallback(() => {
    if (busyRef.current) throw new Error('Please wait for the current operation to finish.');
    busyRef.current = true;
    setBusy(true);
    return ++generation.current;
  }, []);

  const finishAuthentication = useCallback(() => { busyRef.current = false; setBusy(false); }, []);

  const reveal = useCallback((next: Note[], material: NotebookKey, token: number) => {
    if (token !== generation.current || !isAppActive()) return false;
    document.documentElement.classList.remove('notebook-locked');
    notesRef.current = next;
    keyRef.current = material;
    setNotes(next);
    setLocked(false);
    return true;
  }, []);

  const unlock = useCallback(async (password: string) => {
    const token = beginAuthentication();
    try {
      await writes.current.catch(() => null);
      if (!recovery.current && readRawStorage(STORAGE_KEY) !== storedRaw.current) {
        const latest = loadNotebook();
        if (latest.error || !latest.envelope) throw new Error(latest.error ?? 'Your notebook is no longer saved in this browser.');
        storedRaw.current = latest.raw;
        envelopeRef.current = latest.envelope;
        setEnvelope(latest.envelope);
        writes.current = Promise.resolve(latest.envelope);
        revision.current = 0;
        savedRevision.current = 0;
        setSaveStatus('saved');
        setSaveError(null);
      }
      const current = envelopeRef.current;
      if (!current) throw new Error('There is no saved notebook to unlock.');
      let opened: Awaited<ReturnType<typeof decryptNotebook>>;
      try { opened = await decryptNotebook(current, password); }
      catch { throw new Error('That password could not unlock this notebook. Check your password and try again.'); }
      const recovered = recovery.current?.salt === opened.material.salt ? recovery.current : null;
      if (!reveal(recovered?.notes ?? opened.notes, opened.material, token)) return false;
      if (recovered) {
        setSaveStatus('saving');
        void queueSave(recovered.notes, opened.material, recovered.revision).catch(() => undefined);
      }
      return true;
    } finally { finishAuthentication(); }
  }, [beginAuthentication, finishAuthentication, queueSave, reveal]);

  const create = useCallback(async (password: string) => {
    if (envelopeRef.current || loadError) throw new Error('A notebook already exists or needs recovery.');
    const token = beginAuthentication();
    try {
      const material = await createNotebookKey(password);
      if (token !== generation.current || !isAppActive()) return false;
      const sealed = await encryptNotebook([], material);
      if (token !== generation.current || !isAppActive()) return false;
      await persistEnvelope(sealed);
      envelopeRef.current = sealed;
      setEnvelope(sealed);
      writes.current = Promise.resolve(sealed);
      setSaveStatus('saved');
      setSaveError(null);
      return reveal([], material, token);
    } finally { finishAuthentication(); }
  }, [beginAuthentication, finishAuthentication, loadError, persistEnvelope, reveal]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const token = beginAuthentication();
    try {
      const current = await save();
      if (!current || !keyRef.current) throw new Error('Unlock your notebook first.');
      try { await decryptNotebook(current, currentPassword); }
      catch { throw new Error('Your current password is not correct. Nothing has been changed.'); }
      const material = await createNotebookKey(newPassword);
      if (token !== generation.current || !isAppActive()) return false;
      const snapshot = notesRef.current;
      const sealed = await encryptNotebook(snapshot, material);
      if (token !== generation.current || !isAppActive()) return false;
      await persistEnvelope(sealed);
      envelopeRef.current = sealed;
      setEnvelope(sealed);
      writes.current = Promise.resolve(sealed);
      recovery.current = null;
      return reveal(snapshot, material, token);
    } finally { finishAuthentication(); }
  }, [beginAuthentication, finishAuthentication, persistEnvelope, reveal, save]);

  const restore = useCallback(async (backup: NotebookEnvelope, password: string) => {
    const token = beginAuthentication();
    try {
      let opened: Awaited<ReturnType<typeof decryptNotebook>>;
      try { opened = await decryptNotebook(backup, password); }
      catch { throw new Error('This backup could not be unlocked. Check its password; your existing notes have not been changed.'); }
      if (keyRef.current) await save();
      else await writes.current.catch(() => null);
      if (token !== generation.current || !isAppActive()) return false;
      await persistEnvelope(backup);
      envelopeRef.current = backup;
      setEnvelope(backup);
      writes.current = Promise.resolve(backup);
      revision.current = 0;
      savedRevision.current = 0;
      recovery.current = null;
      setLoadError(null);
      setSaveStatus('saved');
      setSaveError(null);
      return reveal(opened.notes, opened.material, token);
    } finally { finishAuthentication(); }
  }, [beginAuthentication, finishAuthentication, persistEnvelope, reveal, save]);

  const getBackup = useCallback(async () => {
    const material = keyRef.current;
    const snapshot = notesRef.current;
    if (material) {
      try { await save(); } catch { /* An encrypted export can rescue edits even when device storage fails. */ }
      return encryptNotebook(snapshot, material);
    }
    const latest = await writes.current;
    const result = latest ?? envelopeRef.current;
    if (!result) throw new Error('Create a notebook before exporting a backup.');
    return result;
  }, [save]);

  useEffect(() => {
    window.addEventListener('pomodere:lock', lock);
    window.addEventListener('pomodere:privacy-lock', lock);
    return () => {
      window.removeEventListener('pomodere:lock', lock);
      window.removeEventListener('pomodere:privacy-lock', lock);
      clearSaveTimeout();
    };
  }, [lock, clearSaveTimeout]);

  useEffect(() => {
    if (locked) return;
    let timeout: number;
    const resetIdle = () => { window.clearTimeout(timeout); timeout = window.setTimeout(lock, 5 * 60 * 1000); };
    resetIdle();
    window.addEventListener('pointerdown', resetIdle, { passive: true });
    window.addEventListener('keydown', resetIdle);
    window.addEventListener('input', resetIdle);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('pointerdown', resetIdle);
      window.removeEventListener('keydown', resetIdle);
      window.removeEventListener('input', resetIdle);
    };
  }, [locked, lock]);

  useEffect(() => {
    const warnBeforeClose = (event: BeforeUnloadEvent) => {
      if (revision.current > savedRevision.current) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warnBeforeClose);
    return () => window.removeEventListener('beforeunload', warnBeforeClose);
  }, []);

  return { notes, locked, busy, configured: envelope !== null, loadError, saveStatus, saveError, updateNotes, save, lock, unlock, create, changePassword, restore, getBackup };
}

export type NotebookController = ReturnType<typeof useNotebook>;