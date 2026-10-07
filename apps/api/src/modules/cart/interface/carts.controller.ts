import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { APP_SETTINGS, type AppSettings } from '../../../config/app-settings.js';
import { assertCalendarDate } from '../../../shared/domain/calendar-date.js';
import { Money } from '../../../shared/domain/money.js';
import { money } from '../../../shared/interface/common.dto.js';
import { CartToken } from '../../../shared/interface/http-params.js';
import type { PaymentOptions, PaymentPlan } from '../../booking/domain/payment-plan.js';
import { findTranslation, snapshotTitle } from '../../catalog/domain/tour.js';
import { CartUseCases, type CartDetails } from '../application/cart.use-cases.js';
import { AddCartItemDto, CreateCartDto } from './cart.dto.js';

export function presentCart(details: CartDetails) {
  const { cart, tours, issues } = details;
  return {
    id: cart.id,
    status: cart.status,
    currency: cart.currency,
    locale: cart.locale,
    expiresAt: cart.expiresAt,
    items: cart.items.map((item) => {
      const tour = tours.get(item.tourId);
      return {
        id: item.id,
        tourId: item.tourId,
        tourSlug: tour ? (findTranslation(tour, cart.locale)?.slug ?? tour.slug) : null,
        tourTitle: tour ? snapshotTitle(tour, cart.locale) : null,
        departureId: item.departureId,
        travelDate: item.travelDate,
        priceLockedUntil: item.priceLockedUntil,
        pax: item.lines.map((l) => ({
          paxType: l.paxType,
          residency: l.residency,
          quantity: l.quantity,
          unitAmount: money(Money.of(l.unitAmount, item.currency)),
          lineAmount: money(Money.of(l.lineAmount, item.currency)),
        })),
        subtotal: money(Money.of(item.subtotalAmount, item.currency)),
      };
    }),
    itemCount: cart.items.length,
    total: money(cart.total()),
    issues: issues.map((i) => ({
      itemId: i.itemId,
      type: i.type,
      code: i.code,
      blocking: i.blocking,
      message: i.message,
      previousSubtotal: i.previousSubtotal ? money(i.previousSubtotal) : undefined,
      currentSubtotal: i.currentSubtotal ? money(i.currentSubtotal) : undefined,
    })),
    canCheckout: cart.status === 'active' && cart.items.length > 0 && !issues.some((i) => i.blocking),
  };
}

function presentPlan(plan: PaymentPlan) {
  return {
    option: plan.option,
    depositPercent: plan.depositPercent,
    total: money(plan.total),
    payNow: money(plan.deposit),
    balance: money(plan.balance),
    balanceDueAt: plan.balanceDueAt,
    fullPaymentReason: plan.fullPaymentReason,
  };
}

export function presentPaymentOptions(options: PaymentOptions) {
  return {
    total: money(options.total),
    firstServiceDate: options.firstServiceDate,
    depositAvailable: options.deposit !== null,
    depositUnavailableReason: options.depositUnavailableReason,
    deposit: options.deposit ? presentPlan(options.deposit) : null,
    full: presentPlan(options.full),
  };
}

@ApiTags('cart')
@ApiHeader({ name: 'X-Cart-Token', required: false, description: 'Token opaco devuelto al crear el carrito (obligatorio salvo en POST /carts).' })
@Controller('carts')
export class CartsController {
  constructor(
    @Inject(CartUseCases) private readonly carts: CartUseCases,
    @Inject(APP_SETTINGS) private readonly settings: AppSettings,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear carrito anónimo. Devuelve `token` UNA sola vez: guárdalo y envíalo en X-Cart-Token.' })
  @ApiCreatedResponse({ description: '`{ data: { token, cart } }`' })
  async create(@Body() body: CreateCartDto) {
    const { token, details } = await this.carts.create({ currency: body.currency, locale: body.locale });
    return { data: { token, cart: presentCart(details) } };
  }

  @Get(':cartId')
  @ApiOperation({ summary: 'Ver carrito con revalidación de cupo, fecha y precio (sin modificarlo).' })
  async get(@Param('cartId', new ParseUUIDPipe()) cartId: string, @CartToken() token: string | undefined) {
    return { data: presentCart(await this.carts.get(cartId, token)) };
  }

  @Post(':cartId/items')
  @ApiOperation({ summary: 'Añadir un tour con fecha y pasajeros (cotiza y congela el precio).' })
  @ApiCreatedResponse({ description: '`{ data: { itemId, cart } }`' })
  async addItem(@Param('cartId', new ParseUUIDPipe()) cartId: string, @CartToken() token: string | undefined, @Body() body: AddCartItemDto) {
    const { item, details } = await this.carts.addItem(cartId, token, {
      tourId: body.tourId,
      travelDate: assertCalendarDate(body.travelDate, 'travelDate'),
      departureId: body.departureId ?? null,
      lines: body.pax.map((p) => ({ paxType: p.paxType, residency: p.residency, quantity: p.quantity })),
    });
    return { data: { itemId: item.id, cart: presentCart(details) } };
  }

  @Delete(':cartId/items/:itemId')
  @ApiOperation({ summary: 'Quitar un ítem del carrito.' })
  async removeItem(
    @Param('cartId', new ParseUUIDPipe()) cartId: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @CartToken() token: string | undefined,
  ) {
    return { data: presentCart(await this.carts.removeItem(cartId, token, itemId)) };
  }

  @Post(':cartId/recalculate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Recotizar ítems y aplicar precios actualizados (RN-12).' })
  async recalculate(@Param('cartId', new ParseUUIDPipe()) cartId: string, @CartToken() token: string | undefined) {
    return { data: presentCart(await this.carts.recalculate(cartId, token)) };
  }

  @Get(':cartId/payment-options')
  @ApiOperation({ summary: 'Opciones de pago (adelanto vs 100 %) antes del checkout (HU-4.2).' })
  @ApiOkResponse({ description: 'Incluye motivo cuando el adelanto no está disponible.' })
  async paymentOptions(@Param('cartId', new ParseUUIDPipe()) cartId: string, @CartToken() token: string | undefined) {
    return { data: presentPaymentOptions(await this.carts.paymentOptions(cartId, token, this.settings.booking.policy)) };
  }
}
