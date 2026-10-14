import assert from 'node:assert/strict';
import test from 'node:test';
import { toUserError, cartIssueMessage } from '../src/lib/api/problems.ts';

test('Portuguese checkout errors retain actionable meaning and form-field mapping', () => {
  const soldOut = toUserError('sold-out', undefined, 'pt');
  assert.equal(soldOut.kind, 'sold-out');
  assert.match(soldOut.message, /Não há mais vagas/);
  assert.match(toUserError('payment-rejected', undefined, 'pt').message, /Nenhum valor foi cobrado/);
  assert.equal(toUserError('invalid-email', undefined, 'pt').field, 'email');
  assert.match(toUserError('hold-expired', undefined, 'pt').message, /vagas foram liberadas/);
});

test('Portuguese never leaks untranslated API detail and keeps throttling classification', () => {
  const unknown = toUserError('unknown-code', 'Mensaje original solo en español', 'pt');
  assert.match(unknown.message, /Não foi possível concluir/);
  assert.doesNotMatch(unknown.message, /Mensaje original/);
  const busy = toUserError('upstream-http-429', undefined, 'pt');
  assert.equal(busy.kind, 'busy');
  assert.match(busy.message, /Aguarde um minuto/);
  assert.match(cartIssueMessage('price_changed', 'total-changed', 'Titicaca', 'pt'), /^Titicaca: o preço mudou\.$/);
  assert.match(cartIssueMessage('unknown', 'sold-out', 'Titicaca', 'pt'), /Não há mais vagas/);
});
