export const MAX_NOTES = 50;
export const MAX_NOTE_LENGTH = 12000;
export const MAX_NOTEBOOK_LENGTH = 120000;
export const MAX_BACKUP_BYTES = 1500000;
export const PASSWORD_ITERATIONS = 600000;

export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

export interface NotebookEnvelope {
  format: 'pomodere-notebook';
  version: 1;
  algorithm: 'AES-GCM';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

export interface NotebookKey {
  key: CryptoKey;
  salt: string;
}

const encoder = new TextEncoder();
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export function hasNotebookCrypto(): boolean {
  return typeof globalThis.crypto?.subtle?.deriveKey === 'function';
}

function requireCrypto(): SubtleCrypto {
  if (!hasNotebookCrypto()) throw new Error('Password locking needs a secure browser connection (HTTPS or localhost), or the configured iOS app.');
  return globalThis.crypto.subtle;
}

function toBase64(bytes: Uint8Array): string {
  let text = '';
  for (let index = 0; index < bytes.length; index += 8192) text += String.fromCharCode(...bytes.subarray(index, index + 8192));
  return btoa(text);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const text = atob(value);
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index++) bytes[index] = text.charCodeAt(index);
  return bytes;
}

export function notebookLength(notes: Note[]): number {
  return notes.reduce((total, note) => total + note.title.length + note.body.length, 0);
}

export function isNoteList(value: unknown): value is Note[] {
  if (!Array.isArray(value) || value.length > MAX_NOTES) return false;
  const ids = new Set<string>();
  const valid = value.every((note: unknown) => {
    if (!note || typeof note !== 'object') return false;
    const item = note as Note;
    if (Object.keys(item).length !== 5 || Object.keys(item).some((key) => !['id', 'title', 'body', 'createdAt', 'updatedAt'].includes(key))) return false;
    if (typeof item.id !== 'string' || item.id.length > 100 || !item.id || ids.has(item.id)) return false;
    ids.add(item.id);
    return typeof item.title === 'string' && item.title.length <= 120 &&
      typeof item.body === 'string' && item.body.length <= MAX_NOTE_LENGTH &&
      Number.isFinite(item.createdAt) && item.createdAt > 0 && Number.isFinite(new Date(item.createdAt).getTime()) &&
      Number.isFinite(item.updatedAt) && item.updatedAt > 0 && Number.isFinite(new Date(item.updatedAt).getTime());
  });
  return valid && notebookLength(value) <= MAX_NOTEBOOK_LENGTH;
}

export function isNotebookEnvelope(value: unknown): value is NotebookEnvelope {
  if (!value || typeof value !== 'object') return false;
  const item = value as NotebookEnvelope;
  if (Object.keys(item).length !== 8 || Object.keys(item).some((key) => !['format', 'version', 'algorithm', 'kdf', 'iterations', 'salt', 'iv', 'ciphertext'].includes(key))) return false;
  return item.format === 'pomodere-notebook' && item.version === 1 && item.algorithm === 'AES-GCM' &&
    item.kdf === 'PBKDF2-SHA256' && item.iterations === PASSWORD_ITERATIONS &&
    typeof item.salt === 'string' && item.salt.length === 24 && BASE64.test(item.salt) && fromBase64(item.salt).length === 16 &&
    typeof item.iv === 'string' && item.iv.length === 16 && BASE64.test(item.iv) && fromBase64(item.iv).length === 12 &&
    typeof item.ciphertext === 'string' && item.ciphertext.length >= 24 && item.ciphertext.length <= MAX_BACKUP_BYTES && BASE64.test(item.ciphertext);
}

function authenticatedHeader(salt: string): Uint8Array<ArrayBuffer> {
  return encoder.encode(`pomodere-notebook:1:AES-GCM:PBKDF2-SHA256:${PASSWORD_ITERATIONS}:${salt}`);
}

export async function deriveNotebookKey(password: string, salt: string): Promise<NotebookKey> {
  const subtle = requireCrypto();
  const passwordBytes = encoder.encode(password);
  try {
    const material = await subtle.importKey('raw', passwordBytes, 'PBKDF2', false, ['deriveKey']);
    const key = await subtle.deriveKey(
      { name: 'PBKDF2', salt: fromBase64(salt), iterations: PASSWORD_ITERATIONS, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
    return { key, salt };
  } finally {
    passwordBytes.fill(0);
  }
}

export async function createNotebookKey(password: string): Promise<NotebookKey> {
  requireCrypto();
  if (password.trim().length < 8 || password.length > 256) throw new Error('Choose a password with at least 8 characters. A long, unique passphrase is best.');
  const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
  return deriveNotebookKey(password, salt);
}

export async function encryptNotebook(notes: Note[], material: NotebookKey): Promise<NotebookEnvelope> {
  if (!isNoteList(notes)) throw new Error('This notebook is too large or contains invalid note data.');
  const subtle = requireCrypto();
  // A fresh 96-bit IV is essential for every AES-GCM save with the same key.
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(notes));
  try {
    const encrypted = await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: authenticatedHeader(material.salt), tagLength: 128 }, material.key, plaintext);
    return { format: 'pomodere-notebook', version: 1, algorithm: 'AES-GCM', kdf: 'PBKDF2-SHA256', iterations: PASSWORD_ITERATIONS, salt: material.salt, iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(encrypted)) };
  } finally {
    plaintext.fill(0);
  }
}

export async function decryptNotebook(envelope: NotebookEnvelope, password: string): Promise<{ notes: Note[]; material: NotebookKey }> {
  if (!isNotebookEnvelope(envelope)) throw new Error('This is not a supported Pomodere notebook backup.');
  const material = await deriveNotebookKey(password, envelope.salt);
  const decrypted = await requireCrypto().decrypt(
    { name: 'AES-GCM', iv: fromBase64(envelope.iv), additionalData: authenticatedHeader(envelope.salt), tagLength: 128 },
    material.key,
    fromBase64(envelope.ciphertext),
  );
  const plaintext = new Uint8Array(decrypted);
  try {
    const notes: unknown = JSON.parse(new TextDecoder().decode(plaintext));
    if (!isNoteList(notes)) throw new Error('The notebook data could not be read.');
    return { notes, material };
  } finally {
    plaintext.fill(0);
  }
}