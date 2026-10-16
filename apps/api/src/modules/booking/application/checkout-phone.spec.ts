import { validate } from 'class-validator';
import { createHarness } from '../../../../test/support/harness.js';
import { BOOKING_SETTINGS, IDS } from '../../../../test/support/fixtures.js';
import { AesGcmPiiCipher } from '../../../shared/infrastructure/aes-gcm-pii-cipher.js';
import { CheckoutCustomerDto } from '../interface/bookings.controller.js';
import { BookingUseCases } from './booking.use-cases.js';

describe('encrypted checkout phone', () => {
  it('accepts only E.164 at the API boundary', async () => {
    const dto = Object.assign(new CheckoutCustomerDto(), { email: 'fixture@example.test', firstName: 'Test', lastName: 'Customer', phone: '924278597' });
    expect((await validate(dto)).some(error => error.property === 'phone')).toBe(true);
    dto.phone = '+51924278597';
    expect(await validate(dto)).toEqual([]);
  });
  it('persists a new customer phone encrypted with row-specific AAD, including idempotent replay', async () => {
    const h = createHarness();
    const cipher = new AesGcmPiiCipher(Buffer.alloc(32, 7));
    const useCases = new BookingUseCases(h.uow, h.clock, h.ids, h.carts, BOOKING_SETTINGS, null, cipher);
    const cart = await h.cartWith([{ tourId: IDS.valle, travelDate: '2026-11-10' }]);
    const input = h.checkoutInput(cart, 'phone-checkout-key');
    input.customer.phone = '+51924278597';
    const result = await useCases.checkout(input);
    const customer = await h.uow.run(repos => repos.customers.findById(result.booking.toSnapshot().customerId));
    expect(customer?.phoneEnc).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(customer!.phoneEnc!).includes(Buffer.from(input.customer.phone))).toBe(false);
    expect(cipher.decrypt(customer!.phoneEnc!, `customers:phone_enc:${customer!.id}`)).toBe(input.customer.phone);
    expect(() => cipher.decrypt(customer!.phoneEnc!, 'customers:phone_enc:different-row')).toThrow();
    const replay = await useCases.checkout(input);
    expect(replay.booking.id).toBe(result.booking.id);
    expect(replay.replayed).toBe(true);
  });
  it('never overwrites an existing customer phone from an unverified guest checkout', async () => {
    const h = createHarness();
    const cipher = new AesGcmPiiCipher(Buffer.alloc(32, 7));
    const useCases = new BookingUseCases(h.uow, h.clock, h.ids, h.carts, BOOKING_SETTINGS, null, cipher);
    const first = h.checkoutInput(await h.cartWith([{ tourId: IDS.valle, travelDate: '2026-11-10' }]), 'phone-first-key');
    first.customer.phone = '+51924278597';
    const result = await useCases.checkout(first);
    const second = h.checkoutInput(await h.cartWith([{ tourId: IDS.titicaca, travelDate: '2026-11-12' }]), 'phone-second-key');
    second.paymentOption = 'full';
    second.customer.phone = '+5511999990001';
    await useCases.checkout(second);
    const customer = await h.uow.run(repos => repos.customers.findById(result.booking.toSnapshot().customerId));
    expect(cipher.decrypt(customer!.phoneEnc!, `customers:phone_enc:${customer!.id}`)).toBe(first.customer.phone);
  });
});
