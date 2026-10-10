/**
 * Tipos de las respuestas del backoffice del Sprint 3 (contenido, contacto, medios, pagos manuales,
 * auditoría). Tomados de `apps/api/src/modules/backoffice/application/content-admin.service.ts`,
 * `payments-admin.service.ts`, `audit-query.service.ts` y `media/interface/media.controller.ts`.
 */
import type { Money, TranslationStatus } from "./types";

export type ContentLocale = "es" | "en";

/* ---------------------------------------------------------------- Destinos y categorías */
export type TaxonomyKind = "destination" | "category";

export interface TaxonomyTranslation {
  locale: ContentLocale;
  name: string;
  description: string | null;
  slug: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  translationStatus: TranslationStatus | null;
}

export interface TaxonomyItem {
  id: string;
  slug: string;
  /** Las categorías siempre vienen como `published`. */
  status: "draft" | "published";
  parentId: string | null;
  sortOrder: number;
  coverStorageKey: string | null;
  version: number;
  updatedAt: string;
  tourCount: number;
  translations: TaxonomyTranslation[];
}

/* ---------------------------------------------------------------- Blog */
export type BlogStatus = "draft" | "published" | "archived";

export interface BlogListItem {
  id: string;
  status: BlogStatus;
  publishedAt: string | null;
  coverStorageKey: string | null;
  tags: string[];
  version: number;
  updatedAt: string;
  title: string | null;
  translations: { locale: ContentLocale; slug: string; translationStatus: TranslationStatus | null }[];
}

export interface BlogTranslation {
  locale: ContentLocale;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  seoTitle: string | null;
  seoDescription: string | null;
  translationStatus: TranslationStatus | null;
}

export interface BlogPost {
  id: string;
  status: BlogStatus;
  coverStorageKey: string | null;
  publishedAt: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  version: number;
  deletedAt: string | null;
  translations: BlogTranslation[];
}

/* ---------------------------------------------------------------- Testimonios */
export type TestimonialStatus = "pending" | "approved" | "rejected";

export interface Testimonial {
  id: string;
  tourId: string | null;
  authorName: string;
  authorCountry: string | null;
  locale: ContentLocale;
  rating: number;
  body: string;
  publishConsent: boolean;
  status: TestimonialStatus;
  isFeatured: boolean;
  travelDate: string | null;
  origin: "web" | "legacy_site" | "admin";
  source: string | null;
  sourceUrl: string | null;
  createdAt: string;
  approvedAt: string | null;
  moderatedAt?: string | null;
  moderationNote?: string | null;
  approvedBy?: { id: string; fullName: string } | null;
}

/* ---------------------------------------------------------------- Contacto */
export type ContactStatus = "new" | "answered" | "archived";

export interface ContactListItem {
  id: string;
  name: string;
  email: string;
  subject: string;
  preview: string;
  tourSlug: string | null;
  locale: string | null;
  status: ContactStatus;
  createdAt: string;
  answeredAt: string | null;
  archivedAt: string | null;
}

export interface ContactListResponse {
  data: ContactListItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number; counts: Partial<Record<ContactStatus, number>> };
}

/** Detalle: el teléfono llega descifrado (lectura auditada). Solo se muestra en el servidor. */
export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  tourSlug: string | null;
  locale: string | null;
  status: ContactStatus;
  internalNote: string | null;
  privacyNoticeVersion: string | null;
  createdAt: string;
  answeredAt: string | null;
  answeredByUserId: string | null;
  archivedAt: string | null;
}

/* ---------------------------------------------------------------- Medios */
export interface UploadedMedia {
  storageKey: string;
  url: string;
  contentType: string;
  size: number;
  width: number | null;
  height: number | null;
  sha256: string;
  created: boolean;
}

/* ---------------------------------------------------------------- Pagos manuales (ADR-0003) */
export interface ManualPaymentItem {
  id: string;
  bookingCode: string;
  kind: "deposit" | "full" | "balance" | "refund";
  method: string | null;
  amount: Money;
  reference: string | null;
  receivedAt: string;
  recordedBy: { id: string; fullName: string } | null;
  isReversal: boolean;
  voidedAt: string | null;
  voidReason: string | null;
}

export interface ManualPaymentsReport {
  date: string;
  totals: { received: Money[]; refunded: Money[]; voided: Money[] };
  byUser: { user: { id: string; fullName: string } | null; count: number; received: Money[]; refunded: Money[]; voided: Money[] }[];
  items: ManualPaymentItem[];
}

export interface VoidPaymentResult {
  paymentId: string;
  reversalId: string;
  bookingStatus: string;
  paid: Money;
  balance: Money;
}

/* ---------------------------------------------------------------- Auditoría */
export interface AuditEntry {
  id: string;
  occurredAt: string;
  actorType: string;
  actorId: string | null;
  entityType: string;
  entityId: string | null;
  action: string;
  changedFields: string[] | null;
  before: unknown;
  after: unknown;
  requestId: string | null;
  ip: string | null;
}
