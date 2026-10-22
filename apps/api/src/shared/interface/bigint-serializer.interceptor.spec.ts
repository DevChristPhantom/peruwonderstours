import { StreamableFile } from '@nestjs/common';
import { Readable } from 'node:stream';
import { toJsonSafe } from './bigint-serializer.interceptor.js';

describe('global bigint response serialization', () => {
  it('preserves StreamableFile identity without reading stream internals or invoking toJSON', () => {
    const stream = new Readable({ read() { throw new Error('Serializer must not read IO'); } });
    const file = new StreamableFile(stream, { type: 'video/mp4', length: 1024 });
    Object.defineProperty(file, 'toJSON', { get() { throw new Error('Serializer must not inspect stream internals'); } });
    expect(toJsonSafe(file)).toBe(file);
    expect(file.getStream()).toBe(stream);
    expect(stream.readableFlowing).toBeNull();
    stream.destroy();
  });
  it('still serializes safe and unsafe bigint values and custom JSON objects', () => {
    expect(toJsonSafe({ amount: 123n, large: 9007199254740992n, money: { toJSON: () => ({ cents: 250n }) }, rows: [2n] }))
      .toEqual({ amount: 123, large: '9007199254740992', money: { cents: 250 }, rows: [2] });
  });
  it('preserves binary buffers and dates as before', () => {
    const buffer = Buffer.from('data'), date = new Date('2026-10-22T00:00:00Z');
    expect(toJsonSafe(buffer)).toBe(buffer);
    expect(toJsonSafe(date)).toBe(date);
  });
});
