/**
 * Tipos de las respuestas del backoffice, tomados de los presenters de la API
 * (`apps/api/src/modules/backoffice/application/*.service.ts`, `identity/application/*`).
 * El OpenAPI exportado no describe estos cuerpos, por eso se mantienen a mano aquí.
 * Montos: céntimos enteros + moneda. Instantes: ISO 8601 UTC. Fechas de calendario: `YYYY-MM-DD`.
 */

export type Currency = "PEN" | "USD";
export interface Money {
  amount: number;
  currency: Currency;
}
export interface MoneyTotal extends Money {
  count: number;
}

/* ---------------------------------------------------------------- Auth del staff */
export interface StaffProfileView {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "operator" | "agent";
  permissions: string[];
  mfaEnabled: boolean;
  lastLoginAt: string | null;
}

export type LoginResponse =
  | { status: "mfa_required"; mfaToken: string; expiresAt: string }
  | { status: "mfa_enrollment_required"; enrollmentToken: string; expiresAt: string }
  | { status: "password_change_required"; passwordChangeToken: string; expiresAt: string };

export interface SessionTokens {
  tokenType: "Bearer";
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  sessionId: string;
  user: StaffProfileView;
  recoveryCodes?: string[];
  recoveryCodesRemaining?: number;
  usedRecoveryCode?: boolean;
}

export interface MfaEnrollment {
  otpauthUri: string;
  secret: string;
  issuer: string;
  label: string;
}

export interface SessionView {
  sessionId: string;
  createdAt: string;
  lastRotatedAt: string;
  expiresAt: string;
  absoluteExpiresAt: string;
  ip: string | null;
  userAgent: string | null;
  current: boolean;
}

export interface StaffUserSummary extends StaffProfileView {
  status: "active" | "suspended" | "disabled";
  lockedUntil: string | null;
  failedLoginCount: number;
  version: number;
  createdAt: string;
}

/* ---------------------------------------------------------------- Tablero */
export type TrafficLight = "green" | "yellow" | "red" | "overdue" | "suspended" | "done";

export interface Dashboard {
  generatedAt: string;
  timezone: string;
  sales: { today: MoneyTotal[]; month: MoneyTotal[]; refundsMonth: MoneyTotal[]; note: string };
  bookingsByStatus: Record<string, number>;
  balances: {
    dueNext7Days: { totals: MoneyTotal[]; bookings: { code: string; balance: Money; balanceDueAt: string }[] };
    overdue: MoneyTotal[];
  };
  complaints: { open: number; dueSoon: number; byTrafficLight: Record<Exclude<TrafficLight, "done">, number> };
  upcomingDepartures: {
    departureId: string;
    tourId: string;
    tourCode: string;
    tourTitle: string | null;
    departureDate: string;
    startTime: string;
    capacity: number;
    booked: number;
    held: number;
    occupancyPercent: number;
    isClosed: boolean;
  }[];
  privacyRequests: { open: number; overdue: number };
  emailOutbox: { pending: number; retrying: number; failed: number };
}

/* ---------------------------------------------------------------- Reservas */
export type BookingStatus = "pending" | "held" | "confirmed" | "partially_paid" | "paid" | "cancelled" | "refunded" | "completed";

export interface BookingListItem {
  id: string;
  code: string;
  status: BookingStatus;
  source: string;
  customer: { fullName: string; email: string };
  firstServiceDate: string;
  tours: { title: string; travelDate: string; paxCount: number }[];
  total: Money;
  paid: Money;
  balance: Money;
  refunded: Money;
  balanceDueAt: string | null;
  createdAt: string;
}

export interface RefundTier {
  minBusinessDaysBefore: number;
  refundPercent: number;
}

export interface CancellationQuote {
  businessDaysBefore: number;
  tier: RefundTier;
  refundAmount: Money;
  retainedAmount: Money;
  paid: Money;
  tiers: RefundTier[];
  policyNote: string;
}

export interface BookingPayment {
  id: string;
  kind: "deposit" | "full" | "balance" | "refund";
  provider: string;
  method: string | null;
  status: string;
  amount: Money;
  providerPaymentId: string | null;
  parentPaymentId: string | null;
  recordedBy: { id: string; fullName: string } | null;
  succeededAt: string | null;
  createdAt: string;
}

export interface EmailEvent {
  eventType: string;
  createdAt: string;
  publishedAt: string | null;
  attempts: number;
  lastError: string | null;
}

export interface BookingDetail {
  id: string;
  code: string;
  status: BookingStatus;
  source: string;
  locale: string;
  customer: { id: string; email: string; firstName: string; lastName: string; fullName: string; country: string | null; preferredLocale: string | null };
  paymentOption: "deposit" | "full";
  depositPercent: number | null;
  total: Money;
  deposit: Money;
  paid: Money;
  refunded: Money;
  balance: Money;
  refundDue: Money | null;
  balanceDueAt: string | null;
  holdExpiresAt: string | null;
  firstServiceDate: string;
  lastServiceDate: string;
  cancellationPolicyVersion: string | null;
  termsVersion: string | null;
  customerNotes: string | null;
  internalNotes: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  items: {
    id: string;
    tourId: string;
    tourTitle: string;
    status: string;
    travelDate: string;
    departureId: string | null;
    paxCount: number;
    subtotal: Money;
    lines: { paxType: string; residency: string; quantity: number; unitAmount: number; lineAmount: number }[];
  }[];
  travelers: { id: string; firstName: string; lastName: string; paxType: string; residency: string; nationality: string | null; isLead: boolean; documentType: string | null }[];
  payments: BookingPayment[];
  statusHistory: { from: string | null; to: string; reason: string | null; actorType: string; actorId: string | null; at: string }[];
  legalAcceptances: { document: string; documentVersion: string; createdAt: string; source: string }[];
  emails: EmailEvent[];
  cancellationQuote: CancellationQuote | null;
}

/* ---------------------------------------------------------------- Tours */
export type TourStatus = "draft" | "published" | "archived";

export interface TourListItem {
  id: string;
  code: string;
  slug: string;
  type: "tour" | "package" | "transfer";
  status: TourStatus;
  title: string | null;
  coverUrl: string | null;
  isFeatured: boolean;
  publishedAt: string | null;
  version: number;
  updatedAt: string;
  translations?: { locale: "es" | "en" | "pt"; translationStatus: TranslationStatus | null }[];
}

export interface ItineraryDay {
  day: number;
  title?: string | null;
  description: string;
  meals?: string[];
  overnight?: string | null;
}

export interface TourTranslation {
  locale: "es" | "en" | "pt";
  slug: string;
  title: string;
  summary: string;
  description: string | null;
  itinerary: ItineraryDay[];
  includes: string[];
  notIncluded: string[];
  recommendations: string[];
  faqs: { question: string; answer: string }[];
  importantNotes: string[];
  policies: string | null;
  meetingPoint: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  /** Metadato del panel (no se publica): null = revisada por el equipo. */
  translationStatus?: TranslationStatus | null;
  updatedAt: string;
}

export type TranslationStatus = "machine_reviewed_pending_client" | "client_approved" | "staff_written";

export interface TourMedia {
  id: string;
  kind: "image" | "video";
  storageKey: string;
  altEs: string | null;
  altEn: string | null;
  width: number | null;
  height: number | null;
  isCover: boolean;
  sortOrder: number;
}

export interface TourDetail {
  id: string;
  code: string;
  slug: string;
  type: "tour" | "package" | "transfer";
  status: TourStatus;
  category: { id: string; slug: string } | null;
  durationDays: number | null;
  durationNights: number | null;
  durationHours: number | null;
  minPax: number;
  maxPax: number | null;
  difficulty: "easy" | "moderate" | "challenging" | "extreme" | null;
  languages: string[];
  bookingCutoffHours: number;
  depositPercentOverride: number | null;
  requiresTravelerDocument: boolean;
  usesInventory: boolean;
  isFeatured: boolean;
  cancellationPolicyCode: string | null;
  publishedAt: string | null;
  version: number;
  updatedAt: string;
  updatedBy: { id: string; fullName: string } | null;
  destinations: { destinationId: string; isPrimary: boolean; sortOrder: number }[];
  translations: TourTranslation[];
  media: TourMedia[];
  activeRateCount: number;
  publication: { publishable: boolean; errors: { field: string; messages: string[] }[]; warnings: string[] };
}

/* ---------------------------------------------------------------- Precios */
export interface Season {
  id: string;
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  priority: number;
  version: number;
  updatedAt: string;
}

export interface Rate {
  id: string;
  tourId: string;
  seasonId: string | null;
  paxType: "adult" | "child" | "student" | "senior";
  residency: "national" | "foreign";
  price: Money;
  validFrom: string;
  validTo: string;
  minGroupSize: number;
  maxGroupSize: number | null;
  isActive: boolean;
  version: number;
  updatedAt: string;
  description: string;
}

/* ---------------------------------------------------------------- Salidas */
export interface Departure {
  id: string;
  tourId: string;
  departureDate: string;
  startTime: string;
  capacity: number;
  booked: number;
  held: number;
  available: number;
  isClosed: boolean;
  version: number;
  updatedAt: string;
}

export interface BulkDeparturesResult {
  created: number;
  skipped: string[];
  dates: string[];
  usesInventory: boolean;
}

/* ---------------------------------------------------------------- Libro de Reclamaciones */
export type ComplaintStatus = "received" | "in_review" | "answered" | "closed" | "settled";

export interface ComplaintListItem {
  id: string;
  code: string;
  sheetNumber: string;
  type: "reclamo" | "queja";
  declaredType: "reclamo" | "queja" | null;
  status: ComplaintStatus;
  channel: "web" | "backup_book" | "office_assisted";
  consumerName: string;
  submittedAt: string;
  responseDueAt: string;
  respondedAt: string | null;
  responseSentAt: string | null;
  acknowledgmentSentAt: string | null;
  trafficLight: TrafficLight;
  businessDaysElapsed: number;
  businessDaysRemaining: number;
  settlement: { offeredAt: string; expiresAt: string | null; acceptedAt: string | null; rejectedAt: string | null } | null;
  reclassified: boolean;
  lateTranscription: boolean;
}

export interface ComplaintDetail {
  id: string;
  code: string;
  sheetNumber: string;
  type: "reclamo" | "queja";
  declaredType: "reclamo" | "queja" | null;
  status: ComplaintStatus;
  channel: "web" | "backup_book" | "office_assisted";
  backupSheetNumber: string | null;
  transcribedAt: string | null;
  lateTranscription: boolean;
  bookingId: string | null;
  /** H-17: código de reserva escrito por el consumidor y NO verificado (sin token ni correo coincidente). */
  declaredBookingCode?: string | null;
  provider: { legalName: string; ruc: string; establishmentAddress: string; establishmentCode: string | null };
  consumer: { fullName: string; docType: string; docNumber: string; address: string; email: string; phone: string | null; isMinor: boolean };
  guardian: { fullName: string | null; address: string | null; email: string | null; phone: string | null } | null;
  good: { type: "product" | "service"; description: string; claimedAmount: Money | null };
  detail: string;
  consumerRequest: string;
  responseChannel: "email" | "letter";
  conformityAcceptedAt: string | null;
  submittedAt: string;
  responseDueAt: string;
  originalResponseDueAt: string | null;
  trafficLight: TrafficLight;
  businessDaysElapsed: number;
  businessDaysRemaining: number;
  response: { text: string | null; respondedAt: string | null; respondedBy: { id: string; fullName: string } | null; sentAt: string | null; deliveryRef: string | null };
  acknowledgment: { sentAt: string | null; deliveryRef: string | null; pdfSha256: string | null };
  reclassification: { at: string; by: { id: string; fullName: string } | null; reason: string | null } | null;
  settlement: {
    offerText: string | null;
    offeredAt: string;
    expiresAt: string | null;
    acceptedAt: string | null;
    acceptanceEvidence: string | null;
    rejectedAt: string | null;
  } | null;
  legalNotices: string[];
  emails: EmailEvent[];
}

export interface TranscriptionResult {
  id: string;
  code: string;
  sheetNumber: string;
  backupSheetNumber: string;
  submittedAt: string;
  transcribedAt: string;
  responseDueAt: string;
  lateTranscription: boolean;
  warning: string | null;
}

/* ---------------------------------------------------------------- ARCO */
export type DsrType = "information" | "access" | "portability" | "rectification" | "cancellation" | "opposition" | "revoke_consent";
export type DsrStatus = "received" | "in_progress" | "answered" | "rejected" | "withdrawn";

export interface PrivacyRequest {
  id: string;
  code: string;
  type: DsrType;
  status: DsrStatus;
  subjectName: string;
  subjectEmail: string;
  customerId: string | null;
  channel: "email" | "web" | "office" | "phone" | "letter";
  detail: string;
  receivedAt: string;
  dueAt: string;
  overdue: boolean;
  extended: boolean;
  extendedAt: string | null;
  extensionReason: string | null;
  response: { text: string; respondedAt: string | null; respondedBy: { id: string; fullName: string } | null } | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}
