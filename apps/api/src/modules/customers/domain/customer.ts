import { ValidationError } from '../../../shared/domain/domain-error.js';
import type { Locale } from '../../catalog/domain/tour.js';

/** Cliente (invitado o con cuenta). PII mínima (Ley 29733); sin teléfono hasta tener cifrado. */
export interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  country: string | null;
  preferredLocale: Locale;
  createdAt: Date;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL.test(normalized) || normalized.length > 254) {
    throw new ValidationError('invalid-email', 'Correo electrónico inválido.');
  }
  return normalized;
}

export function createCustomer(params: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  country?: string | null;
  preferredLocale: Locale;
  now: Date;
}): Customer {
  const country = params.country ? params.country.toUpperCase() : null;
  if (country !== null && !/^[A-Z]{2}$/.test(country)) {
    throw new ValidationError('invalid-country', 'País inválido (ISO 3166-1 alfa-2).');
  }
  return {
    id: params.id,
    email: normalizeEmail(params.email),
    firstName: params.firstName.trim().slice(0, 100),
    lastName: params.lastName.trim().slice(0, 100),
    country,
    preferredLocale: params.preferredLocale,
    createdAt: params.now,
  };
}

export interface CustomerRepository {
  findByEmail(email: string): Promise<Customer | null>;
  findById(id: string): Promise<Customer | null>;
  save(customer: Customer): Promise<void>;
}
