import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../../shared/domain/domain-error.js';
import { assertPromotionRules, isPromotionLive, type PromotionRulesInput } from './promotion.js';

const now = new Date('2027-01-10T12:00:00Z');
const live = { status: 'published' as const, startsAt: null, endsAt: null, deletedAt: null };
const base: PromotionRulesInput = { ctaKind: 'whatsapp', tourId: null, ctaPath: null, startsAt: null, endsAt: null, eventStartsOn: null, eventEndsOn: null };

function fieldsOf(fn: () => void): string[] {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    return ((error as ValidationError).details?.errors as Array<{ field: string }>).map((e) => e.field);
  }
  return [];
}

describe('isPromotionLive', () => {
  it('shows only published, not deleted promotions inside their window', () => {
    expect(isPromotionLive(live, now)).toBe(true);
    expect(isPromotionLive({ ...live, status: 'draft' }, now)).toBe(false);
    expect(isPromotionLive({ ...live, deletedAt: now }, now)).toBe(false);
    expect(isPromotionLive({ ...live, startsAt: new Date('2027-01-11T00:00:00Z') }, now)).toBe(false);
    expect(isPromotionLive({ ...live, endsAt: now }, now)).toBe(false);
    expect(isPromotionLive({ ...live, startsAt: new Date('2027-01-01T00:00:00Z'), endsAt: new Date('2027-02-15T00:00:00Z') }, now)).toBe(true);
  });
});

describe('assertPromotionRules', () => {
  it('accepts a WhatsApp call to action without tour or path', () => {
    expect(fieldsOf(() => assertPromotionRules(base))).toEqual([]);
  });

  it('requires the package for tour buttons and an internal path for page buttons', () => {
    expect(fieldsOf(() => assertPromotionRules({ ...base, ctaKind: 'tour' }))).toEqual(['tourId']);
    expect(fieldsOf(() => assertPromotionRules({ ...base, ctaKind: 'page' }))).toEqual(['ctaPath']);
    expect(fieldsOf(() => assertPromotionRules({ ...base, ctaKind: 'page', ctaPath: '/destinos/tours-en-puno' }))).toEqual([]);
  });

  it('never accepts external or protocol-relative links (no open redirects from an ad)', () => {
    for (const ctaPath of ['https://evil.example', '//evil.example', 'javascript:alert(1)', '/Destinos', '/a b']) {
      expect(fieldsOf(() => assertPromotionRules({ ...base, ctaKind: 'page', ctaPath }))).toEqual(['ctaPath']);
    }
  });

  it('rejects inverted broadcast windows and event dates', () => {
    expect(fieldsOf(() => assertPromotionRules({ ...base, startsAt: now, endsAt: now }))).toEqual(['endsAt']);
    expect(fieldsOf(() => assertPromotionRules({ ...base, eventStartsOn: '2027-02-10', eventEndsOn: '2027-02-01' }))).toEqual(['eventEndsOn']);
    expect(fieldsOf(() => assertPromotionRules({ ...base, eventStartsOn: '2027-02-01', eventEndsOn: '2027-02-01' }))).toEqual([]);
  });
});
