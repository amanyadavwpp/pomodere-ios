import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createNotebookKey, decryptNotebook, encryptNotebook, isNotebookEnvelope, isNoteList, MAX_NOTE_LENGTH, PASSWORD_ITERATIONS } from '../src/lib/notebookCrypto.ts';

if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: webcrypto });

const password = 'a unique notebook passphrase';
const notes = [{ id: 'test-note', title: 'Private title', body: 'A private thought\nwith another line.', createdAt: 1760000000000, updatedAt: 1760000000000 }];

test('encrypts note titles and text, and restores them with the right password', async () => {
  const key = await createNotebookKey(password);
  const sealed = await encryptNotebook(notes, key);
  assert.equal(isNotebookEnvelope(sealed), true);
  assert.equal(key.key.extractable, false);
  assert.equal(sealed.iterations, PASSWORD_ITERATIONS);
  const serialized = JSON.stringify(sealed);
  assert.equal(serialized.includes(notes[0].title), false);
  assert.equal(serialized.includes(notes[0].body), false);
  assert.equal(serialized.includes(password), false);
  assert.deepEqual((await decryptNotebook(sealed, password)).notes, notes);
});

test('wrong passwords and modified ciphertext cannot unlock a notebook', async () => {
  const sealed = await encryptNotebook(notes, await createNotebookKey(password));
  await assert.rejects(decryptNotebook(sealed, 'a different notebook password'));
  const bytes = Buffer.from(sealed.ciphertext, 'base64');
  bytes[0] ^= 1;
  await assert.rejects(decryptNotebook({ ...sealed, ciphertext: bytes.toString('base64') }, password));
});

test('every save uses a different IV, even for the same text and key', async () => {
  const key = await createNotebookKey(password);
  const first = await encryptNotebook(notes, key);
  const second = await encryptNotebook(notes, key);
  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.ciphertext, second.ciphertext);
  assert.equal(first.salt, second.salt);
});

test('new passwords use new salts and do not alter an older backup', async () => {
  const oldBackup = await encryptNotebook(notes, await createNotebookKey(password));
  const newPassword = 'a completely new passphrase';
  const newBackup = await encryptNotebook(notes, await createNotebookKey(newPassword));
  assert.notEqual(oldBackup.salt, newBackup.salt);
  await assert.rejects(decryptNotebook(newBackup, password));
  assert.deepEqual((await decryptNotebook(oldBackup, password)).notes, notes);
  assert.deepEqual((await decryptNotebook(newBackup, newPassword)).notes, notes);
});

test('validates empty notebooks, text limits, duplicate IDs, and backup metadata', async () => {
  assert.equal(isNoteList([]), true);
  assert.equal(isNoteList([...notes, ...notes]), false);
  assert.equal(isNoteList([{ ...notes[0], updatedAt: 1e100 }]), false);
  assert.equal(isNoteList([{ ...notes[0], body: 'a'.repeat(MAX_NOTE_LENGTH + 1) }]), false);
  await assert.rejects(createNotebookKey('short'));
  const sealed = await encryptNotebook([], await createNotebookKey(password));
  assert.equal(isNotebookEnvelope({ ...sealed, iterations: 1 }), false);
  assert.equal(isNotebookEnvelope({ ...sealed, iv: 'not-an-iv' }), false);
  assert.equal(isNotebookEnvelope({ ...sealed, version: 9 }), false);
  assert.equal(isNotebookEnvelope({ ...sealed, password: 'must not be retained' }), false);
  assert.deepEqual((await decryptNotebook(sealed, password)).notes, []);
});

test('preserves Unicode and characters that need JSON escaping', async () => {
  const internationalNotes = [{ ...notes[0], title: 'Caf\u00e9', body: '\u65e5\u672c\u8a9e\nLine two\twith a tab\u0000' }];
  const sealed = await encryptNotebook(internationalNotes, await createNotebookKey(password));
  assert.deepEqual((await decryptNotebook(sealed, password)).notes, internationalNotes);
});