import { randomBytes } from 'node:crypto';
import type { Clock, IdGenerator } from '../domain/ports.js';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/** Reloj controlable para pruebas. */
export class FixedClock implements Clock {
  constructor(private current: Date) {}
  now(): Date {
    return new Date(this.current.getTime());
  }
  set(value: Date): void {
    this.current = new Date(value.getTime());
  }
  advanceMinutes(minutes: number): void {
    this.current = new Date(this.current.getTime() + minutes * 60_000);
  }
}

/**
 * UUID v7 (RFC 9562): 48 bits de milisegundos Unix + versión + 74 bits aleatorios.
 * Monótono dentro del mismo milisegundo (contador en los bits rand_a) para B-tree.
 */
export class UuidV7Generator implements IdGenerator {
  private lastMs = 0;
  private counter = 0;

  next(): string {
    let ms = Date.now();
    if (ms <= this.lastMs) {
      ms = this.lastMs;
      this.counter = (this.counter + 1) & 0x0fff;
      if (this.counter === 0) ms = ++this.lastMs;
    } else {
      this.lastMs = ms;
      this.counter = randomBytes(2).readUInt16BE(0) & 0x07ff;
    }
    const bytes = randomBytes(16);
    bytes.writeUIntBE(ms, 0, 6);
    bytes[6] = 0x70 | ((this.counter >> 8) & 0x0f);
    bytes[7] = this.counter & 0xff;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
}
