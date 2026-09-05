import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNotebookEnvelope, MAX_BACKUP_BYTES } from './notebookCrypto';
import type { NotebookEnvelope } from './notebookCrypto';

export async function readNotebookBackup(file: File): Promise<NotebookEnvelope> {
  if (file.size > MAX_BACKUP_BYTES) throw new Error('This file is too large to be a Pomodere notebook backup.');
  let parsed: unknown;
  try { parsed = JSON.parse(await file.text()); } catch { throw new Error('Choose an encrypted Pomodere JSON backup file.'); }
  if (!isNotebookEnvelope(parsed)) throw new Error('This file is not a supported encrypted Pomodere backup.');
  return parsed;
}

export async function exportNotebookBackup(envelope: NotebookEnvelope): Promise<void> {
  const filename = `pomodere-notes-${new Date().toISOString().slice(0, 10)}.json`;
  const data = JSON.stringify(envelope, null, 2);
  if (Capacitor.isNativePlatform()) {
    const path = `notebook-backups/${filename}`;
    const { uri } = await Filesystem.writeFile({ directory: Directory.Cache, path, data, encoding: Encoding.UTF8, recursive: true });
    await Share.share({ title: 'Pomodere encrypted notebook', files: [uri], dialogTitle: 'Save your encrypted notebook' });
    return;
  }
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}