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
