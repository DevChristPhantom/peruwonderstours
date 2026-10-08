import {
  applyDecorators,
  createParamDecorator,
  Inject,
  Injectable,
  SetMetadata,
  UseGuards,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiBearerAuth, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import type { RequestMeta } from '../../../shared/application/audit.js';
import { ForbiddenError } from '../../../shared/domain/domain-error.js';
import { ProblemDetailsDto } from '../../../shared/interface/problem-details.dto.js';
import { requestMeta } from '../../../shared/interface/request-meta.js';
import { StaffAuthUseCases, type StaffActor } from '../application/staff-auth.use-cases.js';
import { hasAllPermissions, type Permission } from '../domain/permissions.js';

const REQUIRED_PERMISSIONS = 'pwt:required-permissions';

type StaffRequest = Request & { staff?: StaffActor };

export function bearerToken(request: Request): string | undefined {
  const header = request.headers.authorization;
  if (typeof header !== 'string') return undefined;
  const match = /^Bearer\s+([A-Za-z0-9._-]+)$/.exec(header.trim());
  return match?.[1];
}

/**
 * Autentica el access token (JWT + sesión viva en `auth_sessions`) y exige TODOS los
 * permisos declarados con `@StaffAuth(...)`. Un 403 queda registrado en audit_log.
 */
@Injectable()
export class StaffAuthGuard implements CanActivate {
  constructor(
    @Inject(StaffAuthUseCases) private readonly auth: StaffAuthUseCases,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<StaffRequest>();
    const actor = await this.auth.authenticate(bearerToken(request));
    request.staff = actor;
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(REQUIRED_PERMISSIONS, [context.getHandler(), context.getClass()]) ?? [];
    if (!hasAllPermissions(actor.permissions, required)) {
      await this.auth.recordAccessDenied(actor, required, `${request.method} ${request.route?.path ?? request.path}`, requestMeta(request));
      throw new ForbiddenError('insufficient-permissions', 'No tienes permiso para realizar esta acción.', { required });
    }
    return true;
  }
}

/** Exige sesión del staff con MFA completado y los permisos indicados (ninguno = solo sesión). */
export function StaffAuth(...permissions: Permission[]): MethodDecorator & ClassDecorator {
  return applyDecorators(
    SetMetadata(REQUIRED_PERMISSIONS, permissions),
    UseGuards(StaffAuthGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ type: ProblemDetailsDto, description: 'access-token-required, invalid-access-token, access-token-expired, session-revoked' }),
    ApiForbiddenResponse({ type: ProblemDetailsDto, description: `insufficient-permissions${permissions.length ? ` (requiere: ${permissions.join(', ')})` : ''}` }),
  );
}

export { requestMeta };

/** Usuario autenticado por StaffAuthGuard. */
export const CurrentStaff = createParamDecorator((_data: unknown, ctx: ExecutionContext): StaffActor => {
  const actor = ctx.switchToHttp().getRequest<StaffRequest>().staff;
  if (!actor) throw new Error('CurrentStaff sin StaffAuthGuard');
  return actor;
});

/** IP, User-Agent y X-Request-Id de la petición (auditoría). */
export const ReqMeta = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestMeta => requestMeta(ctx.switchToHttp().getRequest<Request>()));
