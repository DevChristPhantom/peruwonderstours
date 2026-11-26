import type { Prisma } from '../../generated/prisma/client.js';
import type { RequestMeta } from '../../shared/application/audit.js';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/domain/domain-error.js';
import type { StaffActor } from '../identity/application/staff-auth.use-cases.js';
import type { AdminDatabase } from '../backoffice/infrastructure/admin-database.js';
import { BOOKING_POLICY_SEED } from './booking-policy.seed.js';

/**
 * Políticas de reserva, pago y cancelación (PWT-LEG-001) editables desde el panel.
 *
 * - r0 es el texto aprobado que viene con el código (docs/legal). Cada guardado crea una revisión
 *   NUEVA e inmutable (`booking_policy_revisions`, trigger que impide UPDATE/DELETE): la versión que
 *   aceptó cada cliente nunca cambia, y la reserva guarda además una copia del texto aceptado.
 * - La versión `2.0-2026-11-25-rN` identifica la familia de reglas (días calendario, topes de
 *   retención) que usa el cálculo de cancelación del panel.
 */
export type PolicyLocale = 'es' | 'en' | 'pt';
export interface PolicyTranslation { title: string; body: string }
export type PolicyTranslations = Record<PolicyLocale, PolicyTranslation>;
export const POLICY_BASE_VERSION = '2.0-2026-11-25';
export interface PolicyDocument { version: string; revision: number; translations: PolicyTranslations; updatedAt: string }

const BASE_UPDATED_AT = '2026-11-25T05:00:00.000Z';
const VERSION_PATTERN = /^2\.0-2026-11-25-r\d{1,6}$/;

export function validatePolicyTranslations(raw: unknown): PolicyTranslations {
  if (!raw || typeof raw !== 'object') throw new ValidationError('invalid-policy', 'Completa los tres idiomas.');
  const result = {} as PolicyTranslations;
  for (const locale of ['es', 'en', 'pt'] as const) {
    const item = (raw as Record<string, unknown>)[locale] as Partial<PolicyTranslation> | undefined;
    const title = typeof item?.title === 'string' ? item.title.trim() : '';
    const body = typeof item?.body === 'string' ? item.body.replace(/\r\n/g, '\n').trim() : '';
    if (title.length < 3 || title.length > 200 || body.length < 100 || body.length > 60_000) {
      throw new ValidationError('invalid-policy', `Completa el título (3 a 200 caracteres) y el texto (100 a 60 000) en ${locale}.`, {
        errors: [{ field: `${locale}.${title.length < 3 || title.length > 200 ? 'title' : 'body'}`, messages: ['Revisa la longitud.'] }],
      });
    }
    if (/<\/?[a-z][^>]*>|javascript\s*:/i.test(body)) {
      throw new ValidationError('invalid-policy', 'Usa texto o Markdown sin etiquetas HTML.', { errors: [{ field: `${locale}.body`, messages: ['Sin HTML.'] }] });
    }
    result[locale] = { title, body };
  }
  return result;
}

function baseDocument(): PolicyDocument {
  return { version: `${POLICY_BASE_VERSION}-r0`, revision: 0, translations: structuredClone(BOOKING_POLICY_SEED), updatedAt: BASE_UPDATED_AT };
}

export class BookingPolicyService {
  constructor(private readonly db: AdminDatabase) {}

  /** Revisión vigente (o una concreta por `version`). Sin base de datos (modo seed/tests): r0. */
  async document(version?: string): Promise<PolicyDocument> {
    if (version !== undefined && !VERSION_PATTERN.test(version)) throw new NotFoundError('policy-version-not-found', 'Versión de políticas no encontrada.');
    if (version === `${POLICY_BASE_VERSION}-r0`) return baseDocument();
    const row = this.db.available
      ? await this.db.read((tx) => (version ? tx.bookingPolicyRevision.findUnique({ where: { version } }) : tx.bookingPolicyRevision.findFirst({ orderBy: { revision: 'desc' } })))
      : null;
    if (row) return { version: row.version, revision: row.revision, translations: validatePolicyTranslations(row.translations), updatedAt: row.createdAt.toISOString() };
    if (version) throw new NotFoundError('policy-version-not-found', 'Versión de políticas no encontrada.');
    return baseDocument();
  }

  async current(locale: PolicyLocale = 'es', version?: string) {
    const doc = await this.document(version);
    return { version: doc.version, revision: doc.revision, locale, ...doc.translations[locale], updatedAt: doc.updatedAt };
  }

  /** Guarda una revisión nueva. `expectedRevision` evita pisar cambios de otra persona. */
  async save(actor: StaffActor, meta: RequestMeta, expectedRevision: number, raw: unknown): Promise<PolicyDocument> {
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) throw new ValidationError('invalid-policy-revision', 'Revisión inválida.');
    const translations = validatePolicyTranslations(raw);
    return this.db.run(actor, meta, async (ctx) => {
      // Serializa la asignación del número de revisión entre procesos.
      await ctx.tx.$queryRaw`SELECT pg_advisory_xact_lock(7601126)`;
      const previous = await ctx.tx.bookingPolicyRevision.findFirst({ orderBy: { revision: 'desc' } });
      if ((previous?.revision ?? 0) !== expectedRevision) {
        throw new ConflictError('policy-version-conflict', 'Otra persona cambió las políticas. Recarga la página antes de guardar.');
      }
      const revision = expectedRevision + 1;
      const version = `${POLICY_BASE_VERSION}-r${revision}`;
      await ctx.tx.bookingPolicyRevision.create({
        data: { revision, version, translations: translations as unknown as Prisma.InputJsonValue, createdAt: ctx.now, createdBy: actor.userId },
      });
      await ctx.audit({ action: 'BOOKING_POLICY_REVISED', entityType: 'booking_policy_revision', entityId: null, before: { revision: expectedRevision }, after: { revision, version } });
      return { version, revision, translations, updatedAt: ctx.now.toISOString() };
    });
  }
}
