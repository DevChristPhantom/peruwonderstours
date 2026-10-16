import assert from 'node:assert/strict';
import test from 'node:test';
import { isJournalTopic, journalTopic } from '../src/lib/content/journal-topics.ts';

test('CMS categories distinguish real stories, legends and default travel guides', () => {
  assert.equal(journalTopic(['puno', ' Historias ']), 'historias');
  assert.equal(journalTopic(['LEYENDAS', 'cusco']), 'leyendas');
  assert.equal(journalTopic(['trekking']), 'guias');
  assert.equal(journalTopic([]), 'guias');
  assert.equal(isJournalTopic(['historias', 'leyendas']), false);
  assert.equal(isJournalTopic('inventado'), false);
  assert.equal(isJournalTopic('leyendas'), true);
});
