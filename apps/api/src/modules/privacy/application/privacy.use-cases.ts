import { createHash } from 'node:crypto';
import { auditIp } from '../../../shared/application/audit.js';
import type { PiiCipher } from '../../../shared/application/pii-cipher.js';
import type { TransactionalRepositories, UnitOfWork } from '../../../shared/application/unit-of-work.js';
import { UnauthorizedError } from '../../../shared/domain/domain-error.js';
import type { Clock, IdGenerator } from '../../../shared/domain/ports.js';
import type { Locale } from '../../catalog/domain/tour.js';
import {
  MARKETING_PURPOSES,
  normalizeSubjectEmail,
  signUnsubscribeToken,
  verifyUnsubscribeToken,
  type ConsentPurpose,
  type LegalDocument,
  type MarketingPurpose,
} from '../domain/consent.js';

export interface PrivacySettingsView {
  marketingLinkSecret: string;
  marketingConsentVersion: string;
  privacyNoticeVersion: string;
  termsVersion: string;
  cancellationPolicyVersion: string;
  publicWebBaseUrl: string;
}

export interface ConsentMeta {
  ip: string | null;
  userAgent: string | null;
}

/** Textos mostrados en el checkout (su SHA-256 se guarda como prueba del texto exacto). */
export const CONSENT_TEXTS: Record<MarketingPurpose, string> = {
  marketing_email: 'Quiero recibir ofertas y novedades de Peru Wonders Tours por correo electrónico.',
  marketing_whatsapp: 'Quiero recibir ofertas y novedades de Peru Wonders Tours por WhatsApp/SMS.',
};

export class InvalidUnsubscribeLinkError extends UnauthorizedError {
  constructor() {
    super('invalid-unsubscribe-link', 'El enlace de baja no es válido. Escríbenos y te daremos de baja manualmente.');
  }
}

function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Consentimientos v2 (Ley 29733): acuses/aceptaciones legales separados de los
 * consentimientos; marketing por canal; revocación por enlace firmado sin cuenta.
 */
export class PrivacyUseCases {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly cipher: PiiCipher,
    private readonly settings: PrivacySettingsView,
  ) {}

  subjectHash(email: string): Uint8Array {
    return this.cipher.hash(normalizeSubjectEmail(email));
  }

  buildUnsubscribeToken(email: string, purposes: readonly MarketingPurpose[] = MARKETING_PURPOSES): string {
    return signUnsubscribeToken(
      { subjectHash: Buffer.from(this.subjectHash(email)).toString('hex'), purposes: [...purposes], issuedAt: Math.floor(this.clock.now().getTime() / 1000) },
      this.settings.marketingLinkSecret,
    );
  }

  buildUnsubscribeUrl(email: string): string {
    return `${this.settings.publicWebBaseUrl}/es/privacidad/baja?token=${encodeURIComponent(this.buildUnsubscribeToken(email))}`;
  }

  /** Para los correos: enlace de baja solo si hoy hay algún consentimiento de marketing vigente. */
  async unsubscribeUrlIfGranted(repos: TransactionalRepositories, email: string): Promise<string | null> {
    const hash = this.subjectHash(email);
    for (const purpose of MARKETING_PURPOSES) {
      if ((await repos.consents.latestBySubject(hash, purpose))?.granted) return this.buildUnsubscribeUrl(email);
    }
    return null;
  }

  /** Estado actual de las finalidades del enlace (para la página de baja del BFF). */
  previewUnsubscribe(token: string): Promise<{ purposes: Array<{ purpose: MarketingPurpose; granted: boolean }> }> {
    const claims = verifyUnsubscribeToken(token, this.settings.marketingLinkSecret);
    if (!claims) throw new InvalidUnsubscribeLinkError();
    const hash = Buffer.from(claims.subjectHash, 'hex');
    return this.uow.run(async (r) => ({
      purposes: await Promise.all(claims.purposes.map(async (purpose) => ({ purpose, granted: (await r.consents.latestBySubject(hash, purpose))?.granted ?? false }))),
    }));
  }

  /** Revocación (art. 10.4 / 26.5): una fila `granted=false, method=email_link` por finalidad. Idempotente. */
  unsubscribe(token: string, purposes: readonly MarketingPurpose[] | undefined, meta: ConsentMeta): Promise<{ revoked: MarketingPurpose[]; alreadyRevoked: MarketingPurpose[] }> {
    const claims = verifyUnsubscribeToken(token, this.settings.marketingLinkSecret);
    if (!claims) return Promise.reject(new InvalidUnsubscribeLinkError());
    const targets = purposes?.length ? claims.purposes.filter((p) => purposes.includes(p)) : claims.purposes;
    const hash = Buffer.from(claims.subjectHash, 'hex');
    return this.uow.run(async (r) => {
      const now = this.clock.now();
      const revoked: MarketingPurpose[] = [];
      const alreadyRevoked: MarketingPurpose[] = [];
      for (const purpose of targets) {
        const latest = await r.consents.latestBySubject(hash, purpose);
        if (latest && !latest.granted) {
          alreadyRevoked.push(purpose);
          continue;
        }
        await r.consents.insert({
          id: this.ids.next(),
          customerId: latest?.customerId ?? null,
          subjectEmailHash: hash,
          anonymousId: null,
          purpose,
          policyVersion: this.settings.marketingConsentVersion,
          textHash: null,
          locale: null,
          granted: false,
          method: 'email_link',
          ip: auditIp(meta.ip),
          userAgent: meta.userAgent?.slice(0, 400) ?? null,
          source: 'unsubscribe_link',
          createdAt: now,
        });
        revoked.push(purpose);
      }
      return { revoked, alreadyRevoked };
    });
  }

  /**
   * Checkout: acuse de la política de privacidad y aceptación de T&C/política de cancelación
   * (legal_acceptances) + elección de marketing por canal (consents, también si es "no").
   * Corre dentro de la transacción del checkout.
   */
  async recordCheckout(
    repos: TransactionalRepositories,
    params: { customerId: string; bookingId: string; email: string; locale: Locale; marketingEmail: boolean; marketingWhatsapp: boolean; meta: ConsentMeta; now: Date },
  ): Promise<void> {
    const hash = this.subjectHash(params.email);
    const ip = auditIp(params.meta.ip);
    const userAgent = params.meta.userAgent?.slice(0, 400) ?? null;
    const documents: Array<[LegalDocument, string]> = [
      ['privacy_policy_ack', this.settings.privacyNoticeVersion],
      ['terms_and_conditions', this.settings.termsVersion],
      ['cancellation_policy', this.settings.cancellationPolicyVersion],
    ];
    for (const [document, version] of documents) {
      await repos.legalAcceptances.insert({
        id: this.ids.next(),
        customerId: params.customerId,
        bookingId: params.bookingId,
        subjectEmailHash: hash,
        document,
        documentVersion: version,
        textHash: null,
        locale: params.locale,
        ip,
        userAgent,
        source: 'checkout',
        createdAt: params.now,
      });
    }
    const choices: Array<[ConsentPurpose & MarketingPurpose, boolean]> = [
      ['marketing_email', params.marketingEmail],
      ['marketing_whatsapp', params.marketingWhatsapp],
    ];
    for (const [purpose, granted] of choices) {
      const latest = await repos.consents.latestBySubject(hash, purpose);
      // Sin cambios no se agrega ruido; una casilla desmarcada no revoca un consentimiento previo
      // (la revocación es explícita: enlace de baja o perfil). La primera elección "no" sí queda registrada.
      if (granted ? latest?.granted === true : latest !== null) continue;
      await repos.consents.insert({
        id: this.ids.next(),
        customerId: params.customerId,
        subjectEmailHash: hash,
        anonymousId: null,
        purpose,
        policyVersion: this.settings.marketingConsentVersion,
        textHash: sha256Hex(CONSENT_TEXTS[purpose]),
        locale: params.locale,
        granted,
        method: 'checkbox',
        ip,
        userAgent,
        source: 'checkout',
        createdAt: params.now,
      });
    }
  }
}
