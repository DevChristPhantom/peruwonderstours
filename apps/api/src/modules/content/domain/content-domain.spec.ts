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
});
