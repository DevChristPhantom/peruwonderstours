import { InMemoryDataStore } from '../../persistence/in-memory/in-memory-data-store.js';
import { InMemoryUnitOfWork } from '../../persistence/in-memory/in-memory-unit-of-work.js';
import { AccessLinkExpiredError, AccessLinkNotFoundError, InvalidAccessLinkError } from '../domain/access-grant.js';
import { DAY_MS, issueAccessToken, MINUTE_MS, redeemAccessLink, resolveSession, sessionGrantsAccess } from './access-grants.js';

let n = 0;
const ids = { next: () => `00000000-0000-7000-8000-${String(++n).padStart(12, '0')}` };
const T0 = new Date('2026-10-09T15:00:00Z');
const at = (ms: number) => new Date(T0.getTime() + ms);

describe('Enlaces mágicos y sesiones opacas (access-grants)', () => {
  const uow = new InMemoryUnitOfWork(new InMemoryDataStore());
  const subjectId = '11111111-1111-7111-8111-111111111111';

  it('un enlace se canjea UNA vez por una sesión; el reuso y el vencido dan 410', async () => {
    const link = await uow.run((r) => issueAccessToken(r, ids, { purpose: 'booking_link', subjectId, locale: 'en', ttlMs: 30 * MINUTE_MS, now: T0 }));
    expect(link.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(link.record.tokenHash).not.toContain(link.token);

    const { session } = await uow.run((r) => redeemAccessLink(r, ids, { token: link.token, purpose: 'booking_link', sessionTtlMs: 30 * DAY_MS, now: at(MINUTE_MS) }));
    expect(session.record).toMatchObject({ purpose: 'booking_session', subjectId, locale: 'en' });
    await expect(uow.run((r) => redeemAccessLink(r, ids, { token: link.token, purpose: 'booking_link', sessionTtlMs: DAY_MS, now: at(2 * MINUTE_MS) }))).rejects.toBeInstanceOf(AccessLinkExpiredError);

    const old = await uow.run((r) => issueAccessToken(r, ids, { purpose: 'booking_link', subjectId, locale: 'es', ttlMs: 30 * MINUTE_MS, now: T0 }));
    await expect(uow.run((r) => redeemAccessLink(r, ids, { token: old.token, purpose: 'booking_link', sessionTtlMs: DAY_MS, now: at(31 * MINUTE_MS) }))).rejects.toBeInstanceOf(AccessLinkExpiredError);
  });

  it('formato inválido 400, inexistente u otro propósito 404', async () => {
    await expect(uow.run((r) => redeemAccessLink(r, ids, { token: 'corto', purpose: 'booking_link', sessionTtlMs: DAY_MS, now: T0 }))).rejects.toBeInstanceOf(InvalidAccessLinkError);
    await expect(uow.run((r) => redeemAccessLink(r, ids, { token: 'a'.repeat(43), purpose: 'booking_link', sessionTtlMs: DAY_MS, now: T0 }))).rejects.toBeInstanceOf(AccessLinkNotFoundError);
    const login = await uow.run((r) => issueAccessToken(r, ids, { purpose: 'customer_login_link', subjectId, locale: 'es', ttlMs: MINUTE_MS, now: T0 }));
    await expect(uow.run((r) => redeemAccessLink(r, ids, { token: login.token, purpose: 'booking_link', sessionTtlMs: DAY_MS, now: T0 }))).rejects.toBeInstanceOf(AccessLinkNotFoundError);
  });

  it('una sesión da acceso solo a su sujeto y deja de valer al revocarse o vencer', async () => {
    const s = await uow.run((r) => issueAccessToken(r, ids, { purpose: 'customer_session', subjectId, locale: 'es', ttlMs: DAY_MS, now: T0 }));
    expect(await uow.run((r) => sessionGrantsAccess(r, { token: s.token, purpose: 'customer_session', subjectId, now: T0 }))).toBe(true);
    expect(await uow.run((r) => sessionGrantsAccess(r, { token: s.token, purpose: 'customer_session', subjectId: ids.next(), now: T0 }))).toBe(false);
    expect(await uow.run((r) => sessionGrantsAccess(r, { token: s.token, purpose: 'booking_session', subjectId, now: T0 }))).toBe(false);
    expect(await uow.run((r) => resolveSession(r, { token: s.token, purpose: 'customer_session', now: at(DAY_MS + 1) }))).toBeNull();
    await uow.run((r) => r.accessTokens.revoke(s.record.id, T0));
    expect(await uow.run((r) => resolveSession(r, { token: s.token, purpose: 'customer_session', now: T0 }))).toBeNull();
  });
});
