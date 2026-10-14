import type { ContentLocale } from './i18n.js';

/** External web routes; tokens and internal API resource names remain unchanged. */
export function localizedWebPath(locale: ContentLocale, path: string): string {
  const pt: Record<string, string> = {
    'reserva/acceso': 'reserva/acesso',
    'cuenta/acceso': 'conta/acesso',
    'libro-de-reclamaciones/consulta': 'livro-de-reclamacoes/consulta',
    'privacidad/confirmar': 'privacidade/confirmar',
    'privacidad/baja': 'privacidade/cancelar-inscricao',
  };
  return `/${locale}/${locale === 'pt' ? (pt[path] ?? path) : path}`;
}
