import { readFileSync } from 'node:fs';
import { curateSiteContent } from '../application/site-content.service.js';
import { pickTranslation } from '../../../shared/domain/i18n.js';
import { assertPlainText, canTransitionContact, createWebTestimonial } from './content.js';

const base = {
  id: 't1',
  now: new Date('2026-10-09T15:00:00Z'),
  authorName: '  Ana   Q. ',
  locale: 'es' as const,
  rating: 5,
  body: 'Un viaje inolvidable al lago Titicaca, muy bien organizado.',
  tourId: null,
  publishConsent: true,
  privacyNoticeVersion: 'p1',
};

describe('Contenido: testimonios, contacto, i18n y contenido institucional', () => {
  it('testimonio web: pendiente, texto normalizado y con consentimiento', () => {
    const t = createWebTestimonial(base);
    expect(t).toMatchObject({ status: 'pending', origin: 'web', authorName: 'Ana Q.', publishConsent: true, isFeatured: false });
  });

  it('rechaza URLs, dominios sueltos, HTML, calificación fuera de rango y falta de consentimiento', () => {
    for (const body of ['Ver https://x.io', 'escribe a www.spam.net ya', 'compra en ofertas.com hoy mismo', '<b>hola</b> amigos del viaje', 'texto &amp; entidades html']) {
      expect(() => assertPlainText('body', body)).toThrow();
    }
    expect(() => createWebTestimonial({ ...base, rating: 6 })).toThrow();
    expect(() => createWebTestimonial({ ...base, publishConsent: false })).toThrow(/autorizar/);
    expect(() => createWebTestimonial({ ...base, body: 'corto' })).toThrow();
  });

  it('bandeja de contacto: new -> answered | archived; archived -> new', () => {
    expect(canTransitionContact('new', 'answered')).toBe(true);
    expect(canTransitionContact('answered', 'archived')).toBe(true);
    expect(canTransitionContact('archived', 'new')).toBe(true);
    expect(canTransitionContact('answered', 'new')).toBe(false);
  });

  it('regla única de idioma: exacto, si no fallback a es', () => {
    const tr = [{ locale: 'es' as const, v: 1 }, { locale: 'en' as const, v: 2 }];
    expect(pickTranslation(tr, 'en')).toMatchObject({ locale: 'en', fallback: false });
    expect(pickTranslation([tr[0]!], 'en')).toMatchObject({ locale: 'es', fallback: true, value: { v: 1 } });
    expect(pickTranslation([], 'es')).toBeNull();
  });

  it('site-content: nunca publica correos del equipo ni datos de empresa', () => {
    const raw = {
      aboutUs: { title: 'Quiénes somos', history: ['Historia', 'Escríbenos a gerencia@x.com'], team: { intro: ['Equipo'] }, companyData: { Gerente: 'Yuri gerencia@x.com' }, images: ['https://a/b.jpg', 'http://c'] },
      faqs: { items: [{ question: '¿Q?', answer: 'R' }, { question: '', answer: 'x' }] },
      contact: { phones: [{ number: '+51 989 028 802', whatsapp: true }], emails: ['info@x.com'], hours: { days: 'Mon-Sat', open: '09:00', close: '19:00', timezone: 'America/Lima' } },
      socialLinks: [{ network: 'Facebook', url: 'https://facebook.com/x' }],
    };
    const out = curateSiteContent(raw, 'en');
    const json = JSON.stringify(out);
    expect(json).not.toMatch(/@x\.com/);
    expect(json).not.toContain('companyData');
    expect(out).toMatchObject({ locale: 'es', fallback: true, faqs: [{ question: '¿Q?', answer: 'R' }], contact: { phones: [{ number: '+51989028802', whatsapp: true }] } });
    expect(out.about?.images).toEqual(['https://a/b.jpg']);
  });

  it('site-content: excludes retired hosts and retired-brand social profiles without changing the archive', () => {
    const raw = {
      aboutUs: { images: ['https://turinet.turismoads.com/images/old.jpg', 'https://www.andeanperutours.com/images/old.jpg', 'https://peruwonderstours.test/new.jpg'] },
      socialLinks: [
        { network: 'Facebook', url: 'https://www.facebook.com/andeanperutours' },
        { network: 'TripAdvisor', urlEncoded: 'https://tripadvisor.test/Reviews-Andean%20Peru%20Tours.html' },
        { network: 'New profile', url: 'https://facebook.com/peruwonderstours' },
        { network: 'Old host', url: 'https://andeanperutours.com/social' },
      ],
    };
    const archive = JSON.stringify(raw);
    const result = curateSiteContent(raw, 'pt');
    expect(result.about?.images).toEqual(['https://peruwonderstours.test/new.jpg']);
    expect(result.socialLinks).toEqual([{ network: 'New profile', url: 'https://facebook.com/peruwonderstours' }]);
    expect(JSON.stringify(result)).not.toMatch(/andeanperutours|turinet\.turismoads|Andean%20Peru%20Tours/i);
    expect(JSON.stringify(raw)).toBe(archive);
  });

  it('does not publish retired host URLs from the actual archived site-content source', () => {
    const raw: unknown = JSON.parse(readFileSync(new URL('../../../../../../data/seed/site-content.json', import.meta.url), 'utf8'));
    expect(JSON.stringify(curateSiteContent(raw, 'es'))).not.toMatch(/andeanperutours\.com|turinet\.turismoads\.com/i);
  });
});
