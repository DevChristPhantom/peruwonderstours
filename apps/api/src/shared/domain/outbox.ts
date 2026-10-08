/**
 * Outbox transaccional: el evento se escribe en la MISMA transacción que el cambio de
 * negocio y un relay lo publica después (correo, PDF, etc.). El payload no lleva datos
 * personales: solo identificadores; el consumidor del evento los carga de la base.
 */
export interface OutboxMessage {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  availableAt: Date;
  createdAt: Date;
}

export interface OutboxRepository {
  add(message: OutboxMessage): Promise<void>;
}
