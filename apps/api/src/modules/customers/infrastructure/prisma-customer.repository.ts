import type { PrismaTx } from '../../../persistence/prisma/prisma-client.js';
import type { Customer, CustomerRepository } from '../domain/customer.js';

type CustomerRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  country: string | null;
  phoneEnc?: Uint8Array | null;
  preferredLocale: 'es' | 'en' | 'pt';
  createdAt: Date;
};

function map(row: CustomerRow): Customer {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    country: row.country,
    phoneEnc: row.phoneEnc,
    preferredLocale: row.preferredLocale,
    createdAt: row.createdAt,
  };
}

export class PrismaCustomerRepository implements CustomerRepository {
  constructor(private readonly db: PrismaTx) {}

  async findByEmail(email: string): Promise<Customer | null> {
    const row = await this.db.customer.findUnique({ where: { email } });
    return row && !row.anonymizedAt ? map(row) : null;
  }

  async findById(id: string): Promise<Customer | null> {
    const row = await this.db.customer.findUnique({ where: { id } });
    return row ? map(row) : null;
  }

  async save(customer: Customer): Promise<void> {
    const data = {
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      country: customer.country,
      preferredLocale: customer.preferredLocale,
      ...(customer.phoneEnc !== undefined ? { phoneEnc: customer.phoneEnc ? Buffer.from(customer.phoneEnc) : null } : {}),
    };
    await this.db.customer.upsert({
      where: { id: customer.id },
      create: { id: customer.id, createdAt: customer.createdAt, ...data },
      update: data,
    });
  }
}
