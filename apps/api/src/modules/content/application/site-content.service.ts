import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { ContentLocale } from '../../../shared/domain/i18n.js';

/** Vista pública curada de data/seed/site-content.json (Quiénes somos, FAQ, redes, horario). */
export interface PublicSiteContent {
  locale: ContentLocale;
  fallback: boolean;
  /** Textos heredados del sitio anterior: pendientes de validación del cliente. */
  legacy: true;
  about: { title: string | null; history: string[]; teamIntro: string[]; office: { heading: string | null; paragraphs: string[] }; images: string[] } | null;
  faqs: Array<{ question: string; answer: string }>;
  socialLinks: Array<{ network: string; url: string }>;
  contact: { phones: Array<{ number: string; whatsapp: boolean }>; hours: { days: string | null; open: string | null; close: string | null; timezone: string | null } | null };
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()) : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/**
 * Lista blanca explícita: NUNCA se publican correos del equipo, nombres de gerentes, datos de
 * empresa (`companyData`) ni direcciones marcadas como placeholder. Solo existe en español: en `en`
 * se responde con `fallback: true`.
 */
export function curateSiteContent(raw: unknown, locale: ContentLocale): PublicSiteContent {
  const root = obj(raw);
  const about = obj(root['aboutUs']);
  const team = obj(about['team']);
  const office = obj(about['headOffice']);
  const faqs = obj(root['faqs']);
  const contact = obj(root['contact']);
  const hours = obj(contact['hours']);
  const email = /[^\s@]+@[^\s@]+\.[^\s@]+/;
  const noEmail = (list: string[]) => list.filter((p) => !email.test(p));
  return {
    locale: 'es',
    fallback: locale !== 'es',
    legacy: true,
    about: Object.keys(about).length
      ? {
          title: str(about['title']),
          history: noEmail(strings(about['history'])),
          teamIntro: noEmail(strings(team['intro'])),
          office: { heading: str(office['heading']), paragraphs: noEmail(strings(office['paragraphs'])) },
          images: strings(about['images']).filter((u) => /^https:\/\//.test(u)),
        }
      : null,
    faqs: (Array.isArray(faqs['items']) ? faqs['items'] : [])
      .map((f) => ({ question: str(obj(f)['question']), answer: str(obj(f)['answer']) }))
      .filter((f): f is { question: string; answer: string } => Boolean(f.question && f.answer)),
    socialLinks: (Array.isArray(root['socialLinks']) ? root['socialLinks'] : []).flatMap((l) => {
      const o = obj(l);
      const url = str(o['urlEncoded']) ?? str(o['url']);
      const network = str(o['network']);
      return url && network && /^https:\/\//.test(url) ? [{ network, url: url.replace(/ /g, '%20') }] : [];
    }),
    contact: {
      phones: (Array.isArray(contact['phones']) ? contact['phones'] : []).flatMap((p) => {
        const o = obj(p);
        const number = str(o['number']);
        return number ? [{ number: number.replace(/\s+/g, ''), whatsapp: o['whatsapp'] === true }] : [];
      }),
      hours: Object.keys(hours).length ? { days: str(hours['days']), open: str(hours['open']), close: str(hours['close']), timezone: str(hours['timezone']) } : null,
    },
  };
}

export class SiteContentService {
  private raw: unknown | undefined;

  constructor(private readonly seedDir: string) {}

  async get(locale: ContentLocale): Promise<PublicSiteContent | null> {
    if (this.raw === undefined) {
      try {
        this.raw = JSON.parse(await readFile(join(resolve(this.seedDir), 'site-content.json'), 'utf8')) as unknown;
      } catch {
        this.raw = null;
      }
    }
    return this.raw ? curateSiteContent(this.raw, locale) : null;
  }
}
