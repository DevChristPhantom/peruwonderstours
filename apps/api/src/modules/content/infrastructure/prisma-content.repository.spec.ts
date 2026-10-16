import { describe, expect, it, vi } from 'vitest';
import type { PrismaTx } from '../../../persistence/prisma/prisma-client.js';
import { PrismaTestimonialRepository } from './prisma-content.repository.js';

describe('Public testimonial repository', () => {
  it('excludes legacy reviews in both public results and their total, even when consent exists', async () => {
    const count = vi.fn().mockResolvedValue(0);
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new PrismaTestimonialRepository({ testimonial: { count, findMany } } as unknown as PrismaTx);
    await expect(repository.listApproved({ locale: 'es', tourId: 'tour-fixture', featured: false, page: 2, pageSize: 8 })).resolves.toEqual({ items: [], total: 0 });

    const publicEligibility = {
      status: 'approved',
      deletedAt: null,
      // A mandatory conjunction: adding consent to an imported row cannot bypass it.
      origin: { not: 'legacy_site' },
      OR: [{ publishConsent: true }, { origin: 'admin' }],
    };
    const where = { AND: [publicEligibility, { locale: 'es' }, { tourId: 'tour-fixture' }, { isFeatured: false }] };
    expect(count).toHaveBeenCalledWith({ where });
    expect(findMany).toHaveBeenCalledWith({
      where,
      orderBy: [{ isFeatured: 'desc' }, { approvedAt: 'desc' }, { createdAt: 'desc' }],
      skip: 8,
      take: 8,
    });
  });
});
