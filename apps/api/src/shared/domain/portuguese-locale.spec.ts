import 'reflect-metadata';
import { validate } from 'class-validator';
import { CheckoutDto } from '../../modules/booking/interface/bookings.controller.js';
import { LocaleQueryDto } from '../../modules/catalog/interface/catalog.dto.js';
import { CustomerLoginLinkDto } from '../../modules/access/interface/access.controllers.js';
import { CONTENT_LOCALES, pickTranslation } from './i18n.js';
import { localizedWebPath } from './locale-path.js';

describe('Português Brasil locale contract', () => {
  it('accepts pt at catalog, checkout and access DTO boundaries and rejects unsupported locales', async () => {
    expect(CONTENT_LOCALES).toContain('pt');
    for (const Dto of [LocaleQueryDto, CheckoutDto, CustomerLoginLinkDto]) {
      const dto = new Dto();
      Object.assign(dto, { locale: 'pt' });
      expect((await validate(dto)).filter((e) => e.property === 'locale')).toEqual([]);
      Object.assign(dto, { locale: 'xx' });
      expect((await validate(dto)).some((e) => e.property === 'locale')).toBe(true);
    }
  });
  it('uses an exact Portuguese translation and marks editorial fallback explicitly', () => {
    const translations = [{ locale: 'es' as const, title: 'Valle Sagrado' }, { locale: 'pt' as const, title: 'Vale Sagrado' }];
    expect(pickTranslation(translations, 'pt')).toEqual({ value: translations[1], locale: 'pt', fallback: false });
    expect(pickTranslation(translations.slice(0, 1), 'pt')).toEqual({ value: translations[0], locale: 'es', fallback: true });
  });
  it.each([
    ['reserva/acceso', '/pt/reserva/acesso'],
    ['cuenta/acceso', '/pt/conta/acesso'],
    ['libro-de-reclamaciones/consulta', '/pt/livro-de-reclamacoes/consulta'],
    ['privacidad/confirmar', '/pt/privacidade/confirmar'],
    ['privacidad/baja', '/pt/privacidade/cancelar-inscricao'],
  ])('localizes external transactional path %s without changing ES/EN contracts', (path, expected) => {
    expect(localizedWebPath('pt', path)).toBe(expected);
    expect(localizedWebPath('es', path)).toBe(`/es/${path}`);
    expect(localizedWebPath('en', path)).toBe(`/en/${path}`);
  });
});
