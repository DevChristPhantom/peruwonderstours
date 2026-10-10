import { randomUUID } from 'node:crypto';
import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainError, type DomainErrorKind } from '../domain/domain-error.js';
import { toJsonSafe } from './bigint-serializer.interceptor.js';
import { PROBLEM_CONTENT_TYPE, RequestValidationException, type ProblemDetails } from './problem-details.js';

const STATUS_BY_KIND: Record<DomainErrorKind, number> = {
  validation: HttpStatus.BAD_REQUEST,
  unauthorized: HttpStatus.UNAUTHORIZED,
  not_found: HttpStatus.NOT_FOUND,
  conflict: HttpStatus.CONFLICT,
  gone: HttpStatus.GONE,
  precondition_required: HttpStatus.PRECONDITION_REQUIRED,
  unprocessable: HttpStatus.UNPROCESSABLE_ENTITY,
  unavailable: HttpStatus.SERVICE_UNAVAILABLE,
  forbidden: HttpStatus.FORBIDDEN,
  rate_limited: HttpStatus.TOO_MANY_REQUESTS,
};

const TITLES: Record<number, string> = {
  400: 'Solicitud inválida',
  401: 'No autorizado',
  403: 'Prohibido',
  404: 'No encontrado',
  405: 'Método no permitido',
  409: 'Conflicto',
  410: 'Recurso expirado',
  413: 'Contenido demasiado grande',
  415: 'Tipo de contenido no soportado',
  422: 'Regla de negocio incumplida',
  428: 'Precondición requerida',
  429: 'Demasiadas solicitudes',
  500: 'Error interno',
  503: 'Servicio no disponible',
};

/**
 * I10: código estable en INGLÉS (kebab-case) para los errores HTTP genéricos (rutas inexistentes,
 * rate limit, 405...). Antes se derivaba del título en español ("no-encontrado").
 */
const GENERIC_CODES: Record<number, string> = {
  400: 'bad-request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not-found',
  405: 'method-not-allowed',
  409: 'conflict',
  410: 'gone',
  413: 'payload-too-large',
  415: 'unsupported-media-type',
  422: 'unprocessable-entity',
  428: 'precondition-required',
  429: 'too-many-requests',
  500: 'internal-error',
  503: 'service-unavailable',
};

export function genericProblemCode(status: number): string {
  return GENERIC_CODES[status] ?? (status >= 500 ? 'internal-error' : 'error');
}

/**
 * Filtro global: toda respuesta de error sale como RFC 9457 `application/problem+json`.
 * Nunca expone stack traces ni mensajes internos en 5xx.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Problem');

  constructor(private readonly typeBaseUrl: string) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const traceId = (request.headers['x-request-id'] as string | undefined)?.slice(0, 64) ?? randomUUID();
    const problem = this.toProblem(exception, request.originalUrl ?? request.url, traceId);

    if (problem.status >= 500) {
      this.logger.error(`${request.method} ${request.originalUrl} -> ${problem.status} [${traceId}]`, exception instanceof Error ? exception.stack : String(exception));
    }
    if (response.headersSent) return;
    const retryAfter = exception instanceof DomainError ? exception.details['retryAfterSeconds'] : undefined;
    if (typeof retryAfter === 'number' && retryAfter > 0) response.setHeader('Retry-After', String(Math.ceil(retryAfter)));
    if (problem.status === 401 && /\/api\/v1\/(admin|auth)\//.test(request.originalUrl ?? '')) response.setHeader('WWW-Authenticate', 'Bearer');
    response.status(problem.status).type(PROBLEM_CONTENT_TYPE).send(JSON.stringify(toJsonSafe(problem)));
  }

  private toProblem(exception: unknown, instance: string, traceId: string): ProblemDetails {
    if (exception instanceof RequestValidationException) {
      return {
        type: `${this.typeBaseUrl}/validation-failed`,
        title: 'Datos de entrada inválidos',
        status: 400,
        detail: 'Revisa los campos indicados.',
        instance,
        code: 'validation-failed',
        traceId,
        errors: exception.fieldErrors,
      };
    }
    if (exception instanceof DomainError) {
      const status = STATUS_BY_KIND[exception.kind];
      // Reglas de dominio con lista de campos: mismo formato que la validación de DTO.
      const { errors, ...rest } = exception.details as { errors?: ProblemDetails['errors'] } & Record<string, unknown>;
      if (Array.isArray(errors)) {
        return {
          type: `${this.typeBaseUrl}/${exception.code}`,
          title: exception.code === 'validation-failed' ? 'Datos de entrada inválidos' : (TITLES[status] ?? 'Error'),
          status,
          detail: exception.message,
          instance,
          code: exception.code,
          traceId,
          errors,
          ...(Object.keys(rest).length > 0 ? { details: rest } : {}),
        };
      }
      return {
        type: `${this.typeBaseUrl}/${exception.code}`,
        title: TITLES[status] ?? 'Error',
        status,
        detail: exception.message,
        instance,
        code: exception.code,
        traceId,
        ...(Object.keys(exception.details).length > 0 ? { details: exception.details } : {}),
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string' ? body : typeof (body as { message?: unknown }).message === 'string' ? (body as { message: string }).message : undefined;
      return {
        type: 'about:blank',
        title: TITLES[status] ?? 'Error',
        status,
        detail: status >= 500 ? undefined : message,
        instance,
        code: genericProblemCode(status),
        traceId,
      };
    }
    return {
      type: 'about:blank',
      title: TITLES[500]!,
      status: 500,
      detail: 'Ocurrió un error inesperado. Si persiste, contáctanos indicando el traceId.',
      instance,
      code: 'internal-error',
      traceId,
    };
  }
}
