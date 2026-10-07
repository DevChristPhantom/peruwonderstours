import type { Cart } from './cart.js';

export interface CartRepository {
  findById(id: string): Promise<Cart | null>;
  save(cart: Cart): Promise<void>;
  /** Carritos activos vencidos (job de expiración). */
  findExpiredActive(now: Date, limit: number): Promise<Cart[]>;
}
