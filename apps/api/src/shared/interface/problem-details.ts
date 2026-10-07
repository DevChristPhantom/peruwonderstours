import { BadRequestException, type ValidationError as ClassValidatorError } from '@nestjs/common';

/** RFC 9457 Problem Details. Extensiones: code, errors, details, traceId. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code: string;
  traceId?: string;
  errors?: Array<{ field: string; messages: string[] }>;
  details?: Record<string, unknown>;
}

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

/** Error de validación de DTO con la lista de campos (se serializa como problem+json 400). */
export class RequestValidationException extends BadRequestException {
  constructor(readonly fieldErrors: Array<{ field: string; messages: string[] }>) {
    super('validation-failed');
  }
}

function flatten(errors: ClassValidatorError[], parent = ''): Array<{ field: string; messages: string[] }> {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = error.constraints ? [{ field, messages: Object.values(error.constraints) }] : [];
    return [...own, ...flatten(error.children ?? [], field)];
  });
}

export function validationExceptionFactory(errors: ClassValidatorError[]): RequestValidationException {
  return new RequestValidationException(flatten(errors));
}
