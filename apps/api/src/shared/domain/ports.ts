/** Reloj inyectable: el dominio nunca llama a `new Date()` directamente. */
export interface Clock {
  now(): Date;
}

/** Generador de identificadores (UUID v7 en producción). */
export interface IdGenerator {
  next(): string;
}
