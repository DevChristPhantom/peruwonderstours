import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** RFC 9457 application/problem+json (con extensiones code, traceId, errors, details). */
export class ProblemDetailsDto {
  @ApiProperty({ example: 'https://peruwonderstours.com/problems/booking-not-found' }) type: string;
  @ApiProperty({ example: 'No encontrado' }) title: string;
  @ApiProperty({ type: 'integer', example: 404 }) status: number;
  @ApiPropertyOptional() detail?: string;
  @ApiPropertyOptional() instance?: string;
  @ApiProperty({ example: 'booking-not-found', description: 'Código estable (kebab-case) para lógica del cliente.' }) code: string;
  @ApiPropertyOptional() traceId?: string;
  @ApiPropertyOptional({ type: 'array', items: { type: 'object', properties: { field: { type: 'string' }, messages: { type: 'array', items: { type: 'string' } } } } })
  errors?: Array<{ field: string; messages: string[] }>;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true }) details?: Record<string, unknown>;
}
