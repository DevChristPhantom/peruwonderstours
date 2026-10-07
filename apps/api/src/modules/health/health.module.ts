import { Controller, Get, Inject, Module, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { PERSISTENCE_BACKEND } from '../../shared/application/tokens.js';
import type { PersistenceBackend } from '../../persistence/persistence-backend.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(PERSISTENCE_BACKEND) private readonly backend: PersistenceBackend) {}

  @Get()
  @ApiOperation({ summary: 'Liveness: el proceso responde.' })
  @ApiOkResponse({ description: '`{ status: "ok", dataSource, uptimeSeconds }`' })
  live() {
    return { status: 'ok', dataSource: this.backend.kind, uptimeSeconds: Math.round(process.uptime()) };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness: la persistencia responde (SELECT 1 en PostgreSQL).' })
  @ApiServiceUnavailableResponse({ description: 'problem+json 503' })
  async ready() {
    try {
      await this.backend.ping();
    } catch {
      throw new ServiceUnavailableException('La base de datos no responde.');
    }
    return { status: 'ready', dataSource: this.backend.kind };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
