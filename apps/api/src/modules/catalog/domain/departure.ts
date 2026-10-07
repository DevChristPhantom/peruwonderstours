import type { CalendarDate } from '../../../shared/domain/calendar-date.js';
import { BusinessRuleError, DomainError } from '../../../shared/domain/domain-error.js';

export interface DepartureSnapshot {
  id: string;
  tourId: string;
  departureDate: CalendarDate;
  /** Hora local de Lima "HH:MM" (00:00 si no tiene hora fija). */
  startTime: string;
  capacity: number;
  booked: number;
  held: number;
  isClosed: boolean;
  version: number;
}

export class SoldOutError extends DomainError {
  constructor(details: { departureId: string; requested: number; available: number; tourId?: string; date?: string }) {
    super('sold-out', 'Se agotó el cupo para la salida seleccionada.', 'conflict', details);
  }
}

export class InventoryInvariantError extends DomainError {
  constructor(message: string, details: Record<string, unknown>) {
    super('inventory-invariant-violated', message, 'conflict', details);
  }
}

/**
 * Salida con cupo. Invariante: booked + held <= capacity (también CHECK en la base).
 * Bloqueo optimista: cada mutación incrementa `version`; el repositorio persiste con
 * `WHERE version = persistedVersion` y falla si otro proceso la cambió antes.
 */
export class Departure {
  private constructor(
    private props: DepartureSnapshot,
    readonly persistedVersion: number,
  ) {}

  static restore(snapshot: DepartureSnapshot): Departure {
    return new Departure({ ...snapshot }, snapshot.version);
  }

  get id(): string {
    return this.props.id;
  }
  get tourId(): string {
    return this.props.tourId;
  }
  get departureDate(): CalendarDate {
    return this.props.departureDate;
  }
  get startTime(): string {
    return this.props.startTime;
  }
  get capacity(): number {
    return this.props.capacity;
  }
  get booked(): number {
    return this.props.booked;
  }
  get held(): number {
    return this.props.held;
  }
  get isClosed(): boolean {
    return this.props.isClosed;
  }
  get version(): number {
    return this.props.version;
  }
  get available(): number {
    return Math.max(0, this.props.capacity - this.props.booked - this.props.held);
  }

  isSellable(quantity: number): boolean {
    return !this.props.isClosed && this.available >= quantity;
  }

  /** Retiene cupo para un checkout. */
  hold(quantity: number): void {
    this.assertQuantity(quantity);
    if (!this.isSellable(quantity)) {
      throw new SoldOutError({
        departureId: this.id,
        tourId: this.tourId,
        date: this.departureDate,
        requested: quantity,
        available: this.props.isClosed ? 0 : this.available,
      });
    }
    this.props.held += quantity;
    this.bump();
  }

  /** Libera una retención (hold vencido o cancelado). */
  releaseHold(quantity: number): void {
    this.assertQuantity(quantity);
    if (this.props.held < quantity) {
      throw new InventoryInvariantError('No hay suficientes cupos retenidos para liberar.', {
        departureId: this.id,
        held: this.props.held,
        quantity,
      });
    }
    this.props.held -= quantity;
    this.bump();
  }

  /** Convierte una retención en venta (pago del adelanto o total). */
  confirmHold(quantity: number): void {
    this.assertQuantity(quantity);
    if (this.props.held < quantity) {
      throw new InventoryInvariantError('No hay suficientes cupos retenidos para confirmar.', {
        departureId: this.id,
        held: this.props.held,
        quantity,
      });
    }
    this.props.held -= quantity;
    this.props.booked += quantity;
    this.bump();
  }

  /** Libera cupos vendidos (cancelación de una reserva pagada). */
  releaseBooked(quantity: number): void {
    this.assertQuantity(quantity);
    if (this.props.booked < quantity) {
      throw new InventoryInvariantError('No hay suficientes cupos vendidos para liberar.', {
        departureId: this.id,
        booked: this.props.booked,
        quantity,
      });
    }
    this.props.booked -= quantity;
    this.bump();
  }

  toSnapshot(): DepartureSnapshot {
    return { ...this.props };
  }

  private bump(): void {
    this.props.version += 1;
  }

  private assertQuantity(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BusinessRuleError('invalid-quantity', 'La cantidad debe ser un entero positivo.', { quantity });
    }
  }
}

export type HoldStatus = 'active' | 'converted' | 'released' | 'expired';

export interface InventoryHold {
  id: string;
  departureId: string;
  cartItemId: string | null;
  bookingItemId: string | null;
  quantity: number;
  status: HoldStatus;
  expiresAt: Date;
  releasedAt: Date | null;
}
