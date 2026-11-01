import { describe, expect, it, vi } from 'vitest';
import type { PrismaTx } from '../../../persistence/prisma/prisma-client.js';
import { PrismaCatalogRepository } from './prisma-catalog.repository.js';

describe('Published taxonomy counts', () => {
  it('starts both independent reads before either finishes and preserves publication filters and result mapping', async () => {
    let resolveDestinations!: (rows: { destinationId: string; _count: { _all: number } }[]) => void;
    const groupDestinations = vi.fn(() => new Promise<{ destinationId: string; _count: { _all: number } }[]>((resolve) => { resolveDestinations = resolve; }));
    const groupCategories = vi.fn().mockResolvedValue([{ categoryId: 'category-1', _count: { _all: 2 } }, { categoryId: null, _count: { _all: 4 } }]);
    const repository = new PrismaCatalogRepository({ tourDestination: { groupBy: groupDestinations }, tour: { groupBy: groupCategories } } as unknown as PrismaTx);
    const result = repository.countPublishedTours();
    expect(groupDestinations).toHaveBeenCalledTimes(1);
    expect(groupCategories).toHaveBeenCalledTimes(1);
    const publication = { status: 'published', deletedAt: null };
    expect(groupDestinations).toHaveBeenCalledWith({ by: ['destinationId'], where: { tour: publication }, _count: { _all: true } });
    expect(groupCategories).toHaveBeenCalledWith({ by: ['categoryId'], where: publication, _count: { _all: true } });
    resolveDestinations([{ destinationId: 'destination-1', _count: { _all: 3 } }]);
    expect(await result).toEqual({ byDestination: new Map([['destination-1', 3]]), byCategory: new Map([['category-1', 2]]) });
  });

  it('does not retain counts across calls when catalog publication changes', async () => {
    const groupDestinations = vi.fn().mockResolvedValueOnce([{ destinationId: 'destination-1', _count: { _all: 3 } }]).mockResolvedValueOnce([{ destinationId: 'destination-1', _count: { _all: 2 } }]);
    const groupCategories = vi.fn().mockResolvedValue([]);
    const repository = new PrismaCatalogRepository({ tourDestination: { groupBy: groupDestinations }, tour: { groupBy: groupCategories } } as unknown as PrismaTx);
    expect((await repository.countPublishedTours()).byDestination.get('destination-1')).toBe(3);
    expect((await repository.countPublishedTours()).byDestination.get('destination-1')).toBe(2);
    expect(groupDestinations).toHaveBeenCalledTimes(2);
    expect(groupCategories).toHaveBeenCalledTimes(2);
  });

  it('propagates failed reads rather than returning partial or stale counts', async () => {
    const error = new Error('fixture database read unavailable');
    const repository = new PrismaCatalogRepository({ tourDestination: { groupBy: vi.fn().mockRejectedValue(error) }, tour: { groupBy: vi.fn().mockResolvedValue([]) } } as unknown as PrismaTx);
    await expect(repository.countPublishedTours()).rejects.toBe(error);
  });
});

describe('Public taxonomy cache', () => {
  const destinationRow = { id: 'd1', slug: 'puno', parentId: null, status: 'published', sortOrder: 0, coverStorageKey: null, translations: [] };
  const categoryRow = { id: 'c1', slug: 'aventura', sortOrder: 0, coverStorageKey: null, translations: [] };

  it('reuses destinations and categories within the TTL and shares one in-flight read between concurrent requests', async () => {
    let now = 1_000;
    const destinations = vi.fn().mockResolvedValue([destinationRow]);
    const categories = vi.fn().mockResolvedValue([categoryRow]);
    const repository = new PrismaCatalogRepository({ destination: { findMany: destinations }, category: { findMany: categories } } as unknown as PrismaTx, {
      taxonomyCacheMs: 30_000,
      now: () => now,
    });
    const [a, b] = await Promise.all([repository.listDestinations(), repository.listDestinations()]);
    expect(a).toEqual(b);
    await repository.listCategories();
    await repository.listCategories();
    expect(destinations).toHaveBeenCalledTimes(1);
    expect(categories).toHaveBeenCalledTimes(1);
    now += 30_001;
    await repository.listDestinations();
    expect(destinations).toHaveBeenCalledTimes(2);
  });

  it('does not cache failures, and is off by default (transactions and admin reads stay fresh)', async () => {
    const error = new Error('fixture database read unavailable');
    const destinations = vi.fn().mockRejectedValueOnce(error).mockResolvedValue([destinationRow]);
    const cached = new PrismaCatalogRepository({ destination: { findMany: destinations } } as unknown as PrismaTx, { taxonomyCacheMs: 30_000 });
    await expect(cached.listDestinations()).rejects.toBe(error);
    expect((await cached.listDestinations())[0]?.id).toBe('d1');

    const fresh = vi.fn().mockResolvedValue([categoryRow]);
    const uncached = new PrismaCatalogRepository({ category: { findMany: fresh } } as unknown as PrismaTx);
    await uncached.listCategories();
    await uncached.listCategories();
    expect(fresh).toHaveBeenCalledTimes(2);
  });

  it('reads only the calendar fields of a tour for departures', async () => {
    const findFirst = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 't1', slug: 'uros', status: 'published', bookingCutoffHours: 24 });
    const repository = new PrismaCatalogRepository({ tour: { findFirst } } as unknown as PrismaTx);
    expect(await repository.findTourRefBySlug('uros-en', 'en')).toEqual({ id: 't1', slug: 'uros', status: 'published', bookingCutoffHours: 24 });
    expect(findFirst).toHaveBeenNthCalledWith(2, {
      where: { deletedAt: null, translations: { some: { locale: 'en', slug: 'uros-en' } } },
      select: { id: true, slug: true, status: true, bookingCutoffHours: true },
    });
  });
});
